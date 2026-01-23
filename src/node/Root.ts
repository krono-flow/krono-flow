import AbstractNode from './AbstractNode';
import Container from './Container';
import { RootProps } from '../format';
import ca from '../gl/ca';
import inject from '../util/inject';
import { renderWebgl, Struct } from '../refresh/struct';
import frame from '../animation/frame';
import { StyleUnit, VISIBILITY } from '../style/define';
import { getLevel, isReflow, RefreshLevel } from '../refresh/level';
import { checkReflow } from '../refresh/reflow';
import { initShaders } from '../gl/webgl';
import mainVert from '../gl/main.vert';
import mainFrag from '../gl/main.frag';
import prVert from '../gl/pr.vert';
import prFrag from '../gl/pr.frag';
import boxFrag from '../gl/box.frag';
import dualDownFrag from '../gl/dualDown.frag';
import dualUpFrag from '../gl/dualUp.frag';
import motionFrag from '../gl/motion.frag';
import radialFrag from '../gl/radial.frag';
import simpleVert from '../gl/simple.vert';
import cmFrag from '../gl/cm.frag';
import maskFrag from '../gl/mask.frag';
import maskGrayFrag from '../gl/maskGray.frag';
import bloomFrag from '../gl/bloom.frag';
import bloomBlurFrag from '../gl/bloomBlur.frag';
import dualDown13Frag from '../gl/dualDown13.frag';
import dualUp13Frag from '../gl/dualUp13.frag';
import lightDarkFrag from '../gl/lightDark.frag';
import AbstractAnimation from '../animation/AbstractAnimation';
import AniController from '../animation/AniController';
import { CAN_PLAY, REFRESH, REFRESH_COMPLETE, WAITING } from '../refresh/refreshEvent';
import codec from '../codec';
import { EncodeOptions } from '../codec/define';
import CacheProgram from '../gl/CacheProgram';
import config from '../config';

class Root extends Container {
  canvas?: HTMLCanvasElement;
  ctx?: WebGLRenderingContext | WebGL2RenderingContext;
  isWebgl2: boolean;
  refs: Record<string, AbstractNode>;
  structs: Struct[]; // 队列代替递归Tree的数据结构
  task: Array<((sync: boolean) => void) | undefined>; // 异步绘制任务回调列表
  aniTask: AbstractAnimation[]; // 动画任务，空占位
  rl: RefreshLevel; // 一帧内画布最大刷新等级记录
  programs: Record<string, CacheProgram>;
  private readonly frameCb: (delta: number) => void; // 帧动画回调
  aniController: AniController;
  audioContext?: AudioContext;
  contentLoadingCount: number; // 各子节点控制（如视频）加载中++，完成后--，为0时说明渲染完整
  lastContentLoadingCount: number;
  firstDraw: boolean;

  declare props: RootProps;

  constructor(props: RootProps, children: AbstractNode[] = []) {
    super(props, children);
    this.root = this;
    this.refs = {};
    this.structs = [];
    this.task = [];
    this.aniTask = [];
    this.rl = RefreshLevel.REFLOW;
    this.programs = {};
    this.frameCb = (delta: number) => {
      // 优先执行所有动画的差值更新计算，如有更新会调用addUpdate触发task添加，实现本帧绘制
      const aniTaskClone = this.aniTask.slice(0);
      aniTaskClone.forEach(item => {
        item.onRunning(delta);
      });
      // 异步绘制任务回调清空，有任务时才触发本帧刷新
      const taskClone = this.task.splice(0);
      if (taskClone.length) {
        this.draw();
      }
      aniTaskClone.forEach(item => {
        item.afterRunning();
      });
      taskClone.forEach(item => {
        if (item) {
          item(false);
        }
      });
      // 没有下一帧的任务和动画，结束帧动画
      if (!this.task.length && !this.aniTask.length) {
        frame.offFrame(this.frameCb);
      }
    };
    // nodejs没有
    if (typeof AudioContext !== 'undefined') {
      this.audioContext = new AudioContext();
    }
    this.aniController = new AniController(this.audioContext);
    this.contentLoadingCount = 0;
    this.lastContentLoadingCount = 0;
    this.firstDraw = true;
    this.isWebgl2 = false;
  }

  appendTo(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const attributes = Object.assign(ca, this.props.contextAttributes);
    // gl的初始化和配置
    let gl: WebGL2RenderingContext | WebGLRenderingContext = canvas.getContext('webgl2', attributes) as WebGL2RenderingContext;
    if (gl) {
      this.isWebgl2 = true;
    }
    else {
      gl = canvas.getContext('webgl', attributes) as WebGLRenderingContext;
      this.isWebgl2 = false;
    }
    if (!gl) {
      throw new Error('Webgl unsupported!');
    }
    this.appendToGl(gl);
  }

  appendToGl(gl: WebGL2RenderingContext | WebGLRenderingContext) {
    // 不能重复
    if (this.ctx) {
      inject.error('Duplicate appendToGl');
      return;
    }
    this.ctx = gl;
    config.init(
      gl.getParameter(gl.MAX_TEXTURE_SIZE),
      gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS),
      gl.getParameter(gl.MAX_VARYING_VECTORS),
    );
    this.initProgram(gl);
    // 渲染前布局和设置关系结构
    this.reLayout();
    this.didMount();
    this.structs = this.structure(0);
    this.asyncDraw();
  }

  reLayout() {
    this.checkRoot();
    this.layout({
      w: this.computedStyle.width,
      h: this.computedStyle.height,
    });
  }

  private checkRoot() {
    const { width, height } = this.style;
    const canvas = this.canvas;
    if (width.u === StyleUnit.AUTO) {
      if (canvas) {
        width.u = StyleUnit.PX;
        this.computedStyle.width = width.v = Math.max(1, canvas.width);
      }
    }
    else {
      this.computedStyle.width = Math.max(1, this.style.width.v as number);
    }
    if (height.u === StyleUnit.AUTO) {
      if (canvas) {
        height.u = StyleUnit.PX;
        this.computedStyle.height = height.v = Math.max(1, canvas.height);
      }
    }
    else {
      this.computedStyle.height = Math.max(1, this.style.height.v as number);
    }
    this.ctx?.viewport(0, 0, this.computedStyle.width, this.computedStyle.height);
  }

  /**
   * 添加更新，分析repaint/reflow和上下影响，异步刷新
   * sync是updateStyle()时没有变化，cb会返回true标明同步执行
   */
  addUpdate(
    node: AbstractNode, // 发生变更的节点
    keys: string[], // 发生变更的样式key
    focus: RefreshLevel = RefreshLevel.NONE, // 初始值默认空，可能图片src变了默认传重绘
    cb?: (sync: boolean) => void,
  ) {
    if (!this.isMounted) {
      return RefreshLevel.NONE;
    }
    let lv = focus;
    if (keys && keys.length) {
      for (let i = 0, len = keys.length; i < len; i++) {
        const k = keys[i];
        lv |= getLevel(k);
      }
    }
    const res = this.calUpdate(node, lv);
    if (res) {
      this.asyncDraw(cb);
    }
    else {
      cb && cb(true);
    }
    return lv;
  }

  calUpdate(
    node: AbstractNode,
    lv: RefreshLevel,
  ) {
    if (lv === RefreshLevel.NONE || !this.isMounted) {
      return false;
    }
    // reflow/repaint/<repaint分级
    const isRf = isReflow(lv);
    if (isRf) {
      // 除了特殊如窗口缩放变更canvas画布会影响根节点，其它都只会是变更节点自己
      if (node === this) {
        this.reLayout();
      }
      else {
        checkReflow(node, lv);
      }
    }
    else {
      const isRp = lv >= RefreshLevel.REPAINT;
      if (isRp) {
        node.calRepaintStyle(lv);
      }
      else {
        const { style, computedStyle } = node;
        if (lv & RefreshLevel.TRANSFORM_ALL) {
          node.calMatrix(lv);
        }
        if (lv & (RefreshLevel.PERSPECTIVE | RefreshLevel.TRANSLATE | RefreshLevel.TRANSFORM_ALL)) {
          node.calPerspective();
        }
        if (lv & (RefreshLevel.PERSPECTIVE_SELF | RefreshLevel.TRANSLATE | RefreshLevel.TRANSFORM_ORIGIN | RefreshLevel.TRANSFORM_ALL)) {
          node.calPerspectiveSelf();
        }
        if (lv & RefreshLevel.OPACITY) {
          node.calOpacity();
        }
        if (lv & RefreshLevel.FILTER) {
          node.calFilter(lv);
        }
        if (lv & RefreshLevel.MIX_BLEND_MODE) {
          computedStyle.mixBlendMode = style.mixBlendMode.v;
        }
        let cleared = false;
        if (lv & RefreshLevel.MASK) {
          node.clearMask();
          cleared = true;
          node.calMask();
        }
        if (lv & RefreshLevel.BREAK_MASK) {
          const oldMask = node.mask;
          node.calMask();
          const newMask = node.mask;
          // breakMask向前查找重置mask，必须是有效的，即设置为true时之前要有mask引用
          if (computedStyle.breakMask && oldMask) {
            oldMask.clearMask();
          }
          // 取消的话如果前面有mask才会有效即有newMask节点
          else if (!computedStyle.breakMask && newMask) {
            //
          }
          // 无效的视为无刷新
          else {
            lv = lv & (RefreshLevel.FULL ^ RefreshLevel.BREAK_MASK);
          }
          if (!computedStyle.breakMask || oldMask) {
            let prev = node.prev;
            while (prev) {
              if (prev.computedStyle.maskMode) {
                prev.clearMask();
                break;
              }
              if (prev.computedStyle.breakMask) {
                break;
              }
              prev = prev.prev;
            }
          }
        }
        // mask的任何其它变更都要清空重绘，必须CACHE以上，CACHE是跨帧渲染用级别
        if (computedStyle.maskMode && !cleared && lv) {
          node.clearMask();
        }
      }
    }
    // 除root的reflow外，任何reflow/repaint都要向上清除
    node.clearTexCacheUpward();
    node.refreshLevel |= lv;
    this.rl |= lv;
    let mask = node.mask;
    // 检查mask影响，这里是作为被遮罩对象存在的关系检查，不会有连续，mask不能同时被mask
    if (mask && !(lv & RefreshLevel.MASK) && !(lv & RefreshLevel.BREAK_MASK)) {
      mask.clearMask();
    }
    let parent = node.parent;
    while (parent) {
      if (parent.computedStyle.visibility === VISIBILITY.HIDDEN) {
        return false;
      }
      parent = parent.parent;
    }
    return lv > RefreshLevel.NONE;
  }

  asyncDraw(cb?: (sync: boolean) => void) {
    const { task, aniTask } = this;
    if (!task.length && !aniTask.length) {
      frame.onFrame(this.frameCb);
    }
    task.push(cb);
  }

  cancelAsyncDraw(cb: (sync: boolean) => void) {
    const { task, aniTask } = this;
    const i = task.indexOf(cb);
    if (i > -1) {
      task.splice(i, 1);
      if (!task.length && !aniTask.length) {
        frame.offFrame(this.frameCb);
      }
    }
  }

  // 总控动画，所有节点的动画引用都会存下来
  addAnimation(animation: AbstractAnimation) {
    const { task, aniTask } = this;
    if (!task.length && !aniTask.length) {
      // 如果之前asyncDraw本帧渲染回调frameCb，可能会添加动画，而之前的frameCb没有删除会重复
      frame.offFrame(this.frameCb);
      frame.onFrame(this.frameCb);
    }
    if (aniTask.indexOf(animation) === -1) {
      aniTask.push(animation);
    }
  }

  removeAnimation(animation: AbstractAnimation) {
    const { task, aniTask } = this;
    const i = aniTask.indexOf(animation);
    if (i > -1) {
      aniTask.splice(i, 1);
      if (!task.length && !aniTask.length) {
        frame.offFrame(this.frameCb);
      }
    }
  }

  draw() {
    if (!this.isMounted) {
      return;
    }
    const rl = this.rl;
    if (rl > RefreshLevel.NONE) {
      this.clear();
      this.rl = RefreshLevel.NONE;
      if (this.ctx) {
        renderWebgl(this.ctx, this);
        this.emit(REFRESH);
        if (this.contentLoadingCount) {
          if (!this.lastContentLoadingCount) {
            this.emit(WAITING);
          }
        }
        else {
          // 等待到加载完成，或者第一次渲染且没有任何加载资源
          if (this.lastContentLoadingCount || this.firstDraw) {
            this.emit(CAN_PLAY);
          }
          this.emit(REFRESH_COMPLETE);
        }
        this.lastContentLoadingCount = this.contentLoadingCount;
        this.firstDraw = false;
      }
    }
  }

  clear() {
    const gl = this.ctx;
    if (gl) {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
  }

  private initProgram(gl: WebGL2RenderingContext | WebGLRenderingContext) {
    const isWebgl2 = this.isWebgl2;
    this.programs.main = new CacheProgram(gl, initShaders(gl, mainVert, mainFrag), {
      uniform: ['u_clip', 'u_texture', 'u_opacity'],
      attrib: ['a_position', 'a_texCoords'],
    });
    if (isWebgl2) {
      this.programs.pr = new CacheProgram(gl, initShaders(gl, prVert, prFrag), {
        uniform: [
          'u_texture[0]',
          'u_texture[1]',
          'u_texture[2]',
          'u_texture[3]',
          'u_texture[4]',
          'u_texture[5]',
          'u_texture[6]',
          'u_texture[7]',
          'u_texture[8]',
          'u_texture[9]',
          'u_texture[10]',
          'u_texture[11]',
          'u_texture[12]',
          'u_texture[13]',
          'u_texture[14]',
          'u_texture[15]',
        ],
        attrib: ['a_position', 'a_texCoords', 'a_opacity', 'a_clip', 'a_textureIndex'],
      });
    }
    this.programs.box = new CacheProgram(gl, initShaders(gl, simpleVert, boxFrag), {
      uniform: ['u_texture', 'u_pw', 'u_ph', 'u_r', 'u_direction'],
      attrib: ['a_position', 'a_texCoords'],
    });
    this.programs.dualDown = new CacheProgram(gl, initShaders(gl, simpleVert, dualDownFrag), {
      uniform: ['u_xy', 'u_texture'],
      attrib: ['a_position', 'a_texCoords'],
    });
    this.programs.dualUp = new CacheProgram(gl, initShaders(gl, simpleVert, dualUpFrag), {
      uniform: ['u_x', 'u_y', 'u_texture'],
      attrib: ['a_position', 'a_texCoords'],
    });
    this.programs.motion = new CacheProgram(gl, initShaders(gl, simpleVert, motionFrag), {
      uniform: ['u_kernel', 'u_velocity', 'u_texture', 'u_limit'],
      attrib: ['a_position', 'a_texCoords'],
    });
    this.programs.radial = new CacheProgram(gl, initShaders(gl, simpleVert, radialFrag), {
      uniform: ['u_kernel', 'u_center', 'u_ratio', 'u_texture'],
      attrib: ['a_position', 'a_texCoords'],
    });
    this.programs.cm = new CacheProgram(gl, initShaders(gl, simpleVert, cmFrag), {
      uniform: ['u_m', 'u_m[0]', 'u_texture'],
      attrib: ['a_position', 'a_texCoords'],
    });
    this.programs.mask = new CacheProgram(gl, initShaders(gl, simpleVert, maskFrag), {
      uniform: ['u_texture1', 'u_texture2'],
      attrib: ['a_position', 'a_texCoords'],
    });
    this.programs.maskGray = new CacheProgram(gl, initShaders(gl, simpleVert, maskGrayFrag), {
      uniform: ['u_texture1', 'u_texture2', 'u_d'],
      attrib: ['a_position', 'a_texCoords'],
    });
    this.programs.bloom = new CacheProgram(gl, initShaders(gl, simpleVert, bloomFrag), {
      uniform: ['u_texture1', 'u_texture2', 'u_threshold'],
      attrib: ['a_position', 'a_texCoords'],
    });
    this.programs.bloomBlur = new CacheProgram(gl, initShaders(gl, simpleVert, bloomBlurFrag), {
      uniform: ['u_texture', 'u_threshold'],
      attrib: ['a_position', 'a_texCoords'],
    });
    this.programs.dualDown13 = new CacheProgram(gl, initShaders(gl, simpleVert, dualDown13Frag), {
      uniform: ['u_xy', 'u_texture'],
      attrib: ['a_position', 'a_texCoords'],
    });
    this.programs.dualUp13 = new CacheProgram(gl, initShaders(gl, simpleVert, dualUp13Frag), {
      uniform: ['u_xy', 'u_texture1', 'u_texture2'],
      attrib: ['a_position', 'a_texCoords'],
    });
    this.programs.lightDark = new CacheProgram(gl, initShaders(gl, simpleVert, lightDarkFrag), {
      uniform: ['u_texture', 'u_velocity', 'u_radius'],
      attrib: ['a_position', 'a_texCoords'],
    });
    CacheProgram.useProgram(gl, this.programs.main);
  }

  async encode(encodeOptions?: EncodeOptions) {
    const EC = codec.getEncoder();
    return new EC().start(this, encodeOptions);
  }
}

export default Root;
