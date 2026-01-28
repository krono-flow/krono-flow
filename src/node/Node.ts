import AbstractNode, { NodeType } from './AbstractNode';
import { getDefaultComputedStyle, getDefaultJStyle, JStyle, Props } from '../format';
import {
  calNormalLineHeight,
  calSize,
  cloneStyle,
  equalStyle,
  getCssFillStroke,
  getCssFilter,
  getCssMbm,
  getCssObjectFit,
  getCssStrokePosition,
  normalize,
} from '../style/css';
import {
  ComputedGradient,
  ComputedStyle,
  DISPLAY,
  FILL_RULE,
  GRADIENT,
  MIX_BLEND_MODE,
  STROKE_LINE_CAP,
  STROKE_LINE_JOIN,
  STROKE_POSITION,
  Style,
  StyleUnit,
  VISIBILITY,
} from '../style/define';
import { Struct } from '../refresh/struct';
import { RefreshLevel } from '../refresh/level';
import { assignBbox, ceilBbox, resetBbox } from '../math/bbox';
import { assignMatrix, calRectPoints, EMPTY_MATRIX, identity, multiply, toE, } from '../math/matrix';
import Container from './Container';
import { calMatrixByOrigin, calPerspectiveMatrix, calTransform, } from '../style/transform';
import { d2r, H } from '../math/geom';
import CanvasCache from '../refresh/CanvasCache';
import TextureCache from '../refresh/TextureCache';
import AbstractAnimation, { Options } from '../animation/AbstractAnimation';
import CssAnimation, { JKeyFrame } from '../animation/CssAnimation';
import { calComputedFill, calComputedFilter, calComputedStroke } from '../style/compute';
import { clone } from '../util/type';
import { color2rgbaStr } from '../style/color';
import inject, { OffScreen } from '../util/inject';
import { canvasPolygon } from '../refresh/paint';
import { getConic, getLinear, getRadial } from '../style/gradient';
import { getCanvasGCO } from '../style/mbm';
import { JCssAnimations, JRichAnimations, JTimeAnimations } from '../parser/define';
import { gaussSize, motionSize, radialSize } from '../math/blur';

class Node extends AbstractNode {
  _x: number;
  _y: number;
  _style: Style;
  _computedStyle: ComputedStyle;
  _struct: Struct;
  _opacity: number; // 世界透明度
  _transform: Float32Array; // 不包含transformOrigin
  _matrix: Float32Array; // 包含transformOrigin
  _matrixWorld: Float32Array; // 世界transform
  _perspectiveMatrix: Float32Array; // 透视矩阵作用于所有孩子
  _perspectiveMatrixSelf: Float32Array;
  canvasCache: CanvasCache | null; // 先渲染到2d上作为缓存
  textureCache: TextureCache | null; // 从canvasCache生成的纹理缓存
  textureTotal: TextureCache | null; // 局部子树缓存
  textureFilter: TextureCache | null; // 有filter时的缓存
  textureMask: TextureCache | null;
  textureTarget: TextureCache | null; // 指向自身所有缓存中最优先的那个
  tempOpacity: number; // 局部根节点merge汇总临时用到的2个
  tempMatrix: Float32Array;
  tempBbox: Float32Array | null; // 这个比较特殊，在可视范围外的merge没有变化会一直保存，防止重复计算
  _rect: Float32Array; // 真实内容组成的内容框，group/geom特殊计算
  _bbox: Float32Array; // 以rect为基础，包含边框包围盒
  _filterBbox: Float32Array; // 包含filter/阴影内内容外的包围盒
  _animationList: AbstractAnimation[]; // 节点上所有的动画列表
  animationRecords?: (JCssAnimations | JTimeAnimations | JRichAnimations)[];

  protected contentLoadingNum: number; // 标识当前一共有多少显示资源在加载中

  constructor(props: Props) {
    super(props);
    this.type = NodeType.NODE;
    this.isNode = true;
    this._x = 0;
    this._y = 0;
    this._style = normalize(getDefaultJStyle(props.style));
    this._computedStyle = getDefaultComputedStyle();
    this._struct = {
      node: this,
      num: 0,
      total: 0,
      lv: 0,
      next: 0,
    };
    this._opacity = 0;
    this._transform = identity();
    this._matrix = identity();
    this._matrixWorld = identity();
    this._perspectiveMatrix = EMPTY_MATRIX;
    this._perspectiveMatrixSelf = EMPTY_MATRIX;
    this.hasContent = false;
    this._animationList = [];
    this.contentLoadingNum = 0;
    this.canvasCache = null;
    this.textureCache = null;
    this.textureTotal = null;
    this.textureFilter = null;
    this.textureMask = null;
    this.textureTarget = null;
    // merge过程中相对于merge顶点作为局部根节点时暂存的数据
    this.tempOpacity = 1;
    this.tempMatrix = identity();
    this._rect = new Float32Array([0, 0, 0, 0]);
    this._bbox = new Float32Array([0, 0, 0, 0]);
    this._filterBbox = new Float32Array([0, 0, 0, 0]);
    this.tempBbox = null;
  }

  override didMount() {
    super.didMount();
    this.didMountAnimate();
  }

  protected didMountAnimate() {
    // 添加dom之前的动画需生效
    this._animationList.forEach(item => {
      this.root!.aniController.addAni(item);
      if (item.autoPlay && item.pending) {
        item.play();
      }
    });
    // json定义的
    if (this.animationRecords) {
      for (let i = 0, len = this.animationRecords.length; i < len; i++) {
        const item = this.animationRecords[i];
        if ('keyframes' in item) {
          // 和richAnimation区别出来
          if (item.keyframes.length && !('rich' in item.keyframes[0])) {
            this.animate(item.keyframes, item.options);
          }
          this.animationRecords.splice(i, 1);
          i--;
          len--;
        }
      }
    }
  }

  structure(lv: number) {
    const temp = this._struct;
    temp.lv = lv;
    return [temp];
  }

  // x/y是布局时递归下来的绝对世界坐标，w/h是父节点尺寸（abs布局是相对父节点）；特殊子节点复写如Text、Img自适应尺寸
  protected lay(x: number, y: number, w: number, h: number) {
    const { style, _computedStyle: computedStyle } = this;
    const { left, top, right, bottom, width, height } = style;
    // 检查是否按相对边固定（px/%）还是尺寸固定，如左右vs宽度
    let fixedLeft = false;
    let fixedTop = false;
    let fixedRight = false;
    let fixedBottom = false;
    if (left.u !== StyleUnit.AUTO) {
      fixedLeft = true;
      computedStyle.left = calSize(left, w);
      this._x = x + computedStyle.left;
    }
    if (right.u !== StyleUnit.AUTO) {
      fixedRight = true;
      computedStyle.right = calSize(right, w);
    }
    if (top.u !== StyleUnit.AUTO) {
      fixedTop = true;
      computedStyle.top = calSize(top, h);
      this._y = computedStyle.top + y;
    }
    if (bottom.u !== StyleUnit.AUTO) {
      fixedBottom = true;
      computedStyle.bottom = calSize(bottom, h);
    }
    // 左右决定width
    if (fixedLeft && fixedRight) {
      computedStyle.width = Math.max(0, w - computedStyle.left - computedStyle.right);
    }
    else if (fixedLeft) {
      if (width.u !== StyleUnit.AUTO) {
        computedStyle.width = Math.max(0, calSize(width, w));
      }
      else {
        computedStyle.width = 0;
      }
      computedStyle.right = w - computedStyle.left - computedStyle.width;
    }
    else if (fixedRight) {
      if (width.u !== StyleUnit.AUTO) {
        computedStyle.width = Math.max(0, calSize(width, w));
      }
      else {
        computedStyle.width = 0;
      }
      computedStyle.left = w - computedStyle.right - computedStyle.width - x;
    }
    else {
      if (width.u !== StyleUnit.AUTO) {
        computedStyle.width = Math.max(0, calSize(width, w));
      }
      else {
        computedStyle.width = 0;
      }
      computedStyle.left = x;
      computedStyle.right = w - computedStyle.width;
    }
    // 上下决定height
    if (fixedTop && fixedBottom) {
      computedStyle.height = Math.max(0, h - computedStyle.top - computedStyle.bottom);
    }
    else if (fixedTop) {
      if (height.u !== StyleUnit.AUTO) {
        computedStyle.height = Math.max(0, calSize(height, h));
      }
      else {
        computedStyle.height = 0;
      }
      computedStyle.bottom = h - computedStyle.top - computedStyle.height;
    }
    else if (fixedBottom) {
      if (height.u !== StyleUnit.AUTO) {
        computedStyle.height = Math.max(0, calSize(height, h));
      }
      else {
        computedStyle.height = 0;
      }
      computedStyle.top = h - computedStyle.bottom - computedStyle.height - y;
    }
    else {
      if (height.u !== StyleUnit.AUTO) {
        computedStyle.height = Math.max(0, calSize(height, h));
      }
      else {
        computedStyle.height = 0;
      }
      computedStyle.top = y;
      computedStyle.bottom = h - computedStyle.height;
    }
  }

  protected layoutBefore(x: number, y: number, w: number, h: number) {
    this.refreshLevel = RefreshLevel.REFLOW;
    // 布局时计算所有样式，更新时根据不同级别调用
    this.calReflowStyle();
    this._x = x;
    this._y = y;
    this.lay(x, y, w, h);
  }

  protected layoutAfter() {
    resetBbox(this._rect, 0, 0, this._computedStyle.width, this._computedStyle.height);
    // repaint和matrix计算需要x/y/width/height
    this.calRepaintStyle(RefreshLevel.REFLOW);
  }

  layoutFlow(parent: Node, x: number, y: number, w: number, h: number, isMeasure = false) {
    this.layoutBefore(x, y, w, h);
    if (isMeasure) {
    }
    else {
      const { _style: style, _computedStyle: computedStyle } = this;
      const { display, width } = style;
      if (display.v === DISPLAY.BLOCK && width.u === StyleUnit.AUTO) {
        computedStyle.width = w;
      }
      this.layoutAfter();
    }
  }

  layoutAbs(parent: Container, x: number, y: number, w: number, h: number) {
    this.layoutBefore(x, y, w, h);
    // absolute强制block
    this._computedStyle.display = DISPLAY.BLOCK;
    this.layoutAfter();
  }

  calReflowStyle() {
    const { _style: style, _computedStyle: computedStyle, parent } = this;
    computedStyle.position = style.position.v;
    computedStyle.display = style.display.v;
    computedStyle.fontFamily = style.fontFamily.v;
    computedStyle.fontSize = style.fontSize.v;
    computedStyle.fontWeight = style.fontWeight.v;
    computedStyle.fontStyle = style.fontStyle.v;
    const lineHeight = style.lineHeight;
    if (lineHeight.u === StyleUnit.AUTO) {
      computedStyle.lineHeight = calNormalLineHeight(computedStyle);
    }
    else {
      computedStyle.lineHeight = lineHeight.v;
    }
    computedStyle.width = computedStyle.height = 0; // 归零方便debug，后续有min值约束
    const width = style.width;
    const height = style.height;
    if (parent) {
      if (width.u !== StyleUnit.AUTO) {
        computedStyle.width = Math.max(0, calSize(width, parent.width));
      }
      if (height.u !== StyleUnit.AUTO) {
        computedStyle.height = Math.max(0, calSize(height, parent.height));
      }
    }
    // 不应该没有parent，Root会自己强制计算要求px，但防止特殊逻辑比如添加自定义矢量fake计算还是兜底
    else {
      if (width.u === StyleUnit.PX) {
        computedStyle.width = Math.max(0, width.v);
      }
      if (height.u === StyleUnit.PX) {
        computedStyle.height = Math.max(0, height.v);
      }
    }
    computedStyle.letterSpacing = style.letterSpacing.v;
    computedStyle.paragraphSpacing = style.paragraphSpacing.v;
    computedStyle.textAlign = style.textAlign.v;
    computedStyle.textVerticalAlign = style.textVerticalAlign.v;
  }

  calRepaintStyle(lv: RefreshLevel) {
    const { _style: style, _computedStyle: computedStyle } = this;
    computedStyle.visibility = style.visibility.v;
    computedStyle.textDecoration = style.textDecoration.map(item => item.v);
    computedStyle.textShadow = style.textShadow.v;
    computedStyle.color = style.color.v;
    computedStyle.backgroundColor = style.backgroundColor.v;
    computedStyle.fill = calComputedFill(style.fill);
    computedStyle.fillEnable = style.fillEnable.map((item) => item.v);
    computedStyle.fillOpacity = style.fillOpacity.map((item) => item.v);
    computedStyle.fillMode = style.fillMode.map((item) => item.v);
    computedStyle.fillRule = style.fillRule.v;
    computedStyle.stroke = calComputedStroke(style.stroke);
    computedStyle.strokeEnable = style.strokeEnable.map((item) => item.v);
    computedStyle.strokeWidth = style.strokeWidth.map((item) => item.v);
    computedStyle.strokePosition = style.strokePosition.map((item) => item.v);
    computedStyle.strokeMode = style.strokeMode.map((item) => item.v);
    computedStyle.strokeDasharray = style.strokeDasharray.map((item) => item.v);
    computedStyle.strokeLinecap = style.strokeLinecap.v;
    computedStyle.strokeLinejoin = style.strokeLinejoin.v;
    computedStyle.strokeMiterlimit = style.strokeMiterlimit.v;
    computedStyle.mixBlendMode = style.mixBlendMode.v;
    computedStyle.pointerEvents = style.pointerEvents.v;
    computedStyle.objectFit = style.objectFit.v;
    computedStyle.borderTopLeftRadius = style.borderTopLeftRadius.v;
    computedStyle.borderTopRightRadius = style.borderTopRightRadius.v;
    computedStyle.borderBottomLeftRadius = style.borderBottomLeftRadius.v;
    computedStyle.borderBottomRightRadius = style.borderBottomRightRadius.v;
    computedStyle.overflow = style.overflow.v;
    this.clearTexCache(true);
    this.calBbox();
    // 只有重布局或者改transform才影响，普通repaint不变
    if (lv & RefreshLevel.REFLOW_TRANSFORM) {
      this.calMatrix(lv);
    }
    if (lv & RefreshLevel.REFLOW_PERSPECTIVE) {
      this.calPerspective();
    }
    if (lv & RefreshLevel.REFLOW_PERSPECTIVE_SELF) {
      this.calPerspectiveSelf();
    }
    // 同matrix
    if (lv & RefreshLevel.REFLOW_OPACITY) {
      this.calOpacity();
    }
    if (lv & RefreshLevel.REFLOW_FILTER) {
      this.calFilter(lv);
    }
    if (lv & RefreshLevel.REFLOW_REPAINT_MASK) {
      this.calMask();
    }
    this.calFilterBbox();
    this.tempBbox = null;
  }

  protected calRect() {
    this._rect[0] = 0;
    this._rect[1] = 0;
    this._rect[2] = this._computedStyle.width;
    this._rect[3] = this._computedStyle.height;
  }

  protected calBbox() {
    assignBbox(this._bbox, this._rect);
  }

  protected calFilterBbox() {
    const fb = assignBbox(this._filterBbox, this._bbox);
    const filter = this._computedStyle.filter;
    filter.forEach(item => {
      const { u } = item;
      if (u === StyleUnit.GAUSS_BLUR) {
        const spread = gaussSize(item.radius);
        fb[0] -= spread;
        fb[1] -= spread;
        fb[2] += spread;
        fb[3] += spread;
      }
      else if (u === StyleUnit.RADIAL_BLUR) {
        const { left, top, right, bottom } = radialSize(item.radius, fb[2] - fb[0], fb[3] - fb[1], item.center[0], item.center[1]);
        fb[0] -= left;
        fb[1] -= top;
        fb[2] += right;
        fb[3] += bottom;
      }
      else if (u === StyleUnit.MOTION_BLUR) {
        const { x, y } = motionSize(item.radius, item.angle);
        fb[0] -= x;
        fb[1] -= y;
        fb[2] += x;
        fb[3] += y;
      }
    });
  }

  calMask() {
    const { _style: style, _computedStyle: computedStyle } = this;
    computedStyle.maskMode = style.maskMode.v;
    computedStyle.breakMask = style.breakMask.v;
    // append时还得看prev的情况，如果自己也是mask，下面会修正，merge也会判断
    let prev = this.prev;
    if (prev && !computedStyle.breakMask) {
      if (prev.computedStyle.maskMode) {
        this.mask = prev;
      }
      else if (prev.mask) {
        this.mask = prev.mask;
      }
    }
    if (computedStyle.maskMode) {
      // mask不能同时被mask
      this.mask = undefined;
      let next = this.next;
      while (next) {
        // 初始连续mask的情况，next的computedStyle还未生成，紧接着后续节点自己calMask()会修正
        if (next.computedStyle.maskMode) {
          next.mask = this;
          break;
        }
        if (next.computedStyle.breakMask) {
          break;
        }
        // 本身是mask的话，忽略breakMask，后续肯定都是自己的遮罩对象
        next.mask = this;
        next = next.next;
      }
    }
    else {
      // 不是mask的话，要看本身是否被遮罩，决定next是否有被遮罩
      let target = computedStyle.breakMask ? undefined : this.mask;
      this.mask = target;
      let next = this.next;
      while (next) {
        if (next.computedStyle.maskMode) {
          next.mask = target;
          break;
        }
        if (next.computedStyle.breakMask) {
          break;
        }
        next.mask = target;
        next = next.next;
      }
    }
    this.clearMask();
  }

  calFilter(lv: RefreshLevel) {
    const { _style: style, _computedStyle: computedStyle } = this;
    computedStyle.filter = calComputedFilter(style.filter, computedStyle.width, computedStyle.height);
    // repaint已经做了
    if (lv < RefreshLevel.REPAINT) {
      this.calFilterBbox();
      this.tempBbox = null;
      this.textureFilter?.release();
      this.resetTextureTarget();
    }
  }

  calMatrix(lv: RefreshLevel) {
    const { _style: style, _computedStyle: computedStyle, _matrix: matrix, _transform: transform } = this;
    // 每次更新标识且id++，获取matrixWorld或者每帧渲染会置true，首次0时强制进入，虽然布局过程中会调用，防止手动调用不可预期
    if (this.hasCacheMw || !this.localMwId) {
      this.hasCacheMw = false;
      this.localMwId++;
    }
    let optimize = true;
    if (
      lv >= RefreshLevel.REFLOW ||
      (lv & RefreshLevel.SCALE_X && !computedStyle.scaleX) || // 优化计算scale不能为0，无法计算倍数差
      (lv & RefreshLevel.SCALE_Y && !computedStyle.scaleY) ||
      (lv & RefreshLevel.ROTATE_Z && (computedStyle.rotateX || computedStyle.rotateY || computedStyle.skewX || computedStyle.skewY)) ||
      (lv & RefreshLevel.ROTATE_X) || // 暂时忽略这2种旋转，应该和z一样考虑优化
      (lv & RefreshLevel.ROTATE_Y) ||
      (lv & RefreshLevel.TRANSFORM_ORIGIN)
    ) {
      optimize = false;
    }
    if (optimize) {
      if (lv & RefreshLevel.TRANSLATE_X) {
        const v = calSize(style.translateX, this.computedStyle.width);
        const diff = v - computedStyle.translateX;
        computedStyle.translateX = v;
        transform[12] += diff;
        matrix[12] += diff;
      }
      if (lv & RefreshLevel.TRANSLATE_Y) {
        const v = calSize(style.translateY, this.computedStyle.height);
        const diff = v - computedStyle.translateY;
        computedStyle.translateY = v;
        transform[13] += diff;
        matrix[13] += diff;
      }
      if (lv & RefreshLevel.ROTATE_Z) {
        const v = style.rotateZ.v;
        computedStyle.rotateZ = v;
        const r = d2r(v);
        const sin = Math.sin(r),
          cos = Math.cos(r);
        const x = computedStyle.scaleX,
          y = computedStyle.scaleY;
        matrix[0] = transform[0] = cos * x;
        matrix[1] = transform[1] = sin * y;
        matrix[4] = transform[4] = -sin * x;
        matrix[5] = transform[5] = cos * y;
        const t = computedStyle.transformOrigin,
          ox = t[0],
          oy = t[1];
        matrix[12] = transform[12] + ox - transform[0] * ox - oy * transform[4];
        matrix[13] = transform[13] + oy - transform[1] * ox - oy * transform[5];
      }
      if (lv & RefreshLevel.SCALE) {
        if (lv & RefreshLevel.SCALE_X) {
          const v = style.scaleX.v;
          const x = v / computedStyle.scaleX;
          computedStyle.scaleX = v;
          transform[0] *= x;
          transform[4] *= x;
          matrix[0] *= x;
          matrix[4] *= x;
        }
        if (lv & RefreshLevel.SCALE_Y) {
          const v = style.scaleY.v;
          const y = v / computedStyle.scaleY;
          computedStyle.scaleY = v;
          transform[1] *= y;
          transform[5] *= y;
          matrix[1] *= y;
          matrix[5] *= y;
        }
        const t = computedStyle.transformOrigin,
          ox = t[0],
          oy = t[1];
        matrix[12] = transform[12] + ox - transform[0] * ox - transform[4] * oy;
        matrix[13] = transform[13] + oy - transform[1] * ox - transform[5] * oy;
        matrix[14] = transform[14] - transform[2] * ox - transform[6] * oy;
      }
      // if (lv & RefreshLevel.TRANSFORM_ORIGIN) {
      //   const tfo = style.transformOrigin.map((item, i) => {
      //     return calSize(item, i ? this.computedStyle.height : this.computedStyle.width);
      //   });
      //   const t = calMatrixByOrigin(transform, tfo[0], tfo[1]);
      //   assignMatrix(matrix, t);
      // }
    }
    else {
      toE(transform);
      const tfo = style.transformOrigin.map((item, i) => {
        return calSize(item, i ? this.computedStyle.height : this.computedStyle.width);
      });
      computedStyle.transformOrigin = tfo as [number, number];
      // 一般走这里，特殊将left/top和translate合并一起加到matrix上，这样渲染视为[0, 0]开始
      computedStyle.translateX = calSize(style.translateX, this.computedStyle.width);
      computedStyle.translateY = calSize(style.translateY, this.computedStyle.height);
      computedStyle.translateZ = calSize(style.translateZ, this.computedStyle.width);
      const rotateX = style.rotateX ? style.rotateX.v : 0;
      const rotateY = style.rotateY ? style.rotateY.v : 0;
      const rotateZ = style.rotateZ ? style.rotateZ.v : 0;
      const skewX = style.skewX ? style.skewX.v : 0;
      const skewY = style.skewY ? style.skewY.v : 0;
      const scaleX = style.scaleX ? style.scaleX.v : 1;
      const scaleY = style.scaleY ? style.scaleY.v : 1;
      computedStyle.rotateX = rotateX;
      computedStyle.rotateY = rotateY;
      computedStyle.rotateZ = rotateZ;
      computedStyle.skewX = skewX;
      computedStyle.skewY = skewY;
      computedStyle.scaleX = scaleX;
      computedStyle.scaleY = scaleY;
      calTransform({
        translateX: computedStyle.left + computedStyle.translateX,
        translateY: computedStyle.top + computedStyle.translateY,
        translateZ: computedStyle.translateZ,
        rotateX,
        rotateY,
        rotateZ,
        skewX,
        skewY,
        scaleX,
        scaleY,
      }, transform);
      const t = calMatrixByOrigin(transform, tfo[0], tfo[1]);
      assignMatrix(matrix, t);
    }
  }

  // 和matrix计算很像，但没有特殊优化，同样影响matrixWorld
  calPerspective() {
    const { _style: style, _computedStyle: computedStyle } = this;
    if (this.hasCacheMw || !this.localMwId) {
      this.hasCacheMw = false;
      this.localMwId++;
    }
    const pfo = style.perspectiveOrigin.map((item, i) => {
      return calSize(item, i ? this.computedStyle.height : this.computedStyle.width);
    });
    computedStyle.perspectiveOrigin = pfo as [number, number];
    computedStyle.perspective = calSize(style.perspective, this.computedStyle.width);
    if (computedStyle.perspective >= 1) {
      this._perspectiveMatrix = calPerspectiveMatrix(computedStyle.perspective, pfo[0], pfo[1]);
    }
    else {
      this._perspectiveMatrix = EMPTY_MATRIX;
    }
  }

  calPerspectiveSelf() {
    const { _style: style, _computedStyle: computedStyle, transform } = this;
    if (this.hasCacheMw || !this.localMwId) {
      this.hasCacheMw = false;
      this.localMwId++;
    }
    computedStyle.perspectiveSelf = calSize(style.perspectiveSelf, this.computedStyle.width);
    if (computedStyle.perspectiveSelf >= 1) {
      const tfo = computedStyle.transformOrigin;
      this._perspectiveMatrixSelf = calPerspectiveMatrix(computedStyle.perspectiveSelf, tfo[0] + transform[12], tfo[1] + transform[13]);
    }
    else {
      this._perspectiveMatrixSelf = EMPTY_MATRIX;
    }
  }

  calOpacity() {
    const { _style: style, _computedStyle: computedStyle } = this;
    if (this.hasCacheOp || !this.localOpId) {
      this.hasCacheOp = false;
      this.localOpId++;
    }
    computedStyle.opacity = style.opacity.v;
  }

  // 是否有内容，由各个子类自己实现
  calContent() {
    this.hasContent = this._computedStyle.backgroundColor[3] > 0;
    return this.hasContent;
  }

  calContentLoading() {
    const computedStyle = this._computedStyle;
    if (!computedStyle.width || !computedStyle.height) {
      return 0;
    }
    return this.contentLoadingNum;
  }

  renderCanvas() {
    let canvasCache = this.canvasCache;
    if (canvasCache && canvasCache.available) {
      canvasCache.release();
    }
    if (this.hasContent) {
      const bbox = ceilBbox(this.bbox.slice(0));
      const x = bbox[0],
        y = bbox[1];
      const w = bbox[2] - x,
        h = bbox[3] - y;
      canvasCache = this.canvasCache = new CanvasCache(w, h, -x, -y);
      canvasCache.available = true;
      this.renderCanvasBgc(canvasCache);
    }
  }

  renderCanvasBgc(canvasCache: CanvasCache) {
    const backgroundColor = this._computedStyle.backgroundColor;
    if (backgroundColor[3] > 0) {
      const coords = this.getBackgroundCoords(-canvasCache.dx, -canvasCache.dy);
      canvasCache.list.forEach(item => {
        const { x, y, os: { ctx } } = item;
        ctx.fillStyle = color2rgbaStr(backgroundColor);
        ctx.beginPath();
        canvasPolygon(ctx, coords, -x, -y);
        ctx.closePath();
        ctx.fill();
      });
    }
  }

  renderFillStroke(coords: number[][][], isClosed = true, computedStyle = this._computedStyle) {
    if (!coords.length) {
      return;
    }
    const bbox = ceilBbox(this.bbox.slice(0));
    const x = bbox[0],
      y = bbox[1];
    const w = bbox[2] - x,
      h = bbox[3] - y;
    const dx = -x,
      dy = -y;
    const {
      fill,
      fillOpacity,
      fillRule,
      fillEnable,
      fillMode,
      stroke,
      strokeEnable,
      strokeWidth,
      strokePosition,
      strokeMode,
      strokeDasharray,
      strokeLinecap,
      strokeLinejoin,
      strokeMiterlimit,
    } = computedStyle;

    const canvasCache = (this.canvasCache?.available ? this.canvasCache : new CanvasCache(w, h, dx, dy));
    canvasCache.available = true;
    const list = canvasCache.list;
    for (let i = 0, len = list.length; i < len; i++) {
      const item = list[i];
      const { x, y, os: { ctx } } = item;
      const dx2 = -x;
      const dy2 = -y;
      ctx.setLineDash(strokeDasharray);
      ctx.beginPath();
      coords.forEach((item) => {
        canvasPolygon(ctx, item, dx2, dy2);
      });
      if (isClosed) {
        ctx.closePath();
      }
      // 先下层的fill
      for (let j = 0, len = fill.length; j < len; j++) {
        if (!fillEnable[j] || !fillOpacity[j]) {
          continue;
        }
        let f = fill[j];
        // 椭圆的径向渐变无法直接完成，用mask来模拟，即原本用纯色填充，然后离屏绘制渐变并用matrix模拟椭圆，再合并
        let ellipse: OffScreen | undefined;
        const mode = fillMode[j];
        ctx.globalAlpha = fillOpacity[j];
        if (Array.isArray(f)) {
          if (f[3] <= 0) {
            continue;
          }
          ctx.fillStyle = color2rgbaStr(f);
        }
        // 非纯色
        else {
          // 渐变
          {
            f = f as ComputedGradient;
            if (f.t === GRADIENT.LINEAR) {
              const gd = getLinear(f.stops, f.d, 0, 0, w - dx * 2, h - dy * 2);
              const lg = ctx.createLinearGradient(gd.x1 + dx2, gd.y1 + dy2, gd.x2 + dx2, gd.y2 + dy2);
              gd.stop.forEach((item) => {
                lg.addColorStop(item.offset, color2rgbaStr(item.color));
              });
              ctx.fillStyle = lg;
            }
            else if (f.t === GRADIENT.RADIAL) {
              const gd = getRadial(f.stops, f.d, 0, 0, w - dx * 2, h - dy * 2);
              const rg = ctx.createRadialGradient(
                gd.cx + dx2,
                gd.cy + dy2,
                0,
                gd.cx + dx2,
                gd.cy + dy2,
                gd.total,
              );
              gd.stop.forEach((item) => {
                rg.addColorStop(item.offset, color2rgbaStr(item.color));
              });
              // 椭圆渐变，由于有缩放，用clip确定绘制范围，然后缩放长短轴绘制椭圆
              const m = gd.matrix;
              if (m) {
                ellipse = inject.getOffscreenCanvas(w, h);
                const ctx2 = ellipse.ctx;
                ctx2.beginPath();
                coords.forEach((item) => {
                  canvasPolygon(ctx2, item, dx2, dy2);
                });
                if (isClosed) {
                  ctx2.closePath();
                }
                ctx2.clip();
                ctx2.fillStyle = rg;
                ctx2.setTransform(m[0], m[1], m[4], m[5], m[12], m[13]);
                ctx2.fill(fillRule === FILL_RULE.EVEN_ODD ? 'evenodd' : 'nonzero');
              }
              else {
                ctx.fillStyle = rg;
              }
            }
            else if (f.t === GRADIENT.CONIC) {
              const gd = getConic(f.stops, f.d, 0, 0, w - dx * 2, h - dy * 2);
              const cg = ctx.createConicGradient(gd.angle, gd.cx + dx2, gd.cy + dy2);
              gd.stop.forEach((item) => {
                cg.addColorStop(item.offset, color2rgbaStr(item.color));
              });
              ctx.fillStyle = cg;
            }
          }
        }
        if (mode !== MIX_BLEND_MODE.NORMAL) {
          ctx.globalCompositeOperation = getCanvasGCO(mode);
        }
        if (ellipse) {
          ctx.drawImage(ellipse.canvas, 0, 0);
          ellipse.release();
        }
        else {
          ctx.fill(fillRule === FILL_RULE.EVEN_ODD ? 'evenodd' : 'nonzero');
        }
        if (mode !== MIX_BLEND_MODE.NORMAL) {
          ctx.globalCompositeOperation = 'source-over';
        }
      }
      // fill有opacity和mode，设置记得还原
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      // 线帽设置
      if (strokeLinecap === STROKE_LINE_CAP.ROUND) {
        ctx.lineCap = 'round';
      }
      else if (strokeLinecap === STROKE_LINE_CAP.SQUARE) {
        ctx.lineCap = 'square';
      }
      else {
        ctx.lineCap = 'butt';
      }
      if (strokeLinejoin === STROKE_LINE_JOIN.ROUND) {
        ctx.lineJoin = 'round';
      }
      else if (strokeLinejoin === STROKE_LINE_JOIN.BEVEL) {
        ctx.lineJoin = 'bevel';
      }
      else {
        ctx.lineJoin = 'miter';
      }
      ctx.miterLimit = strokeMiterlimit;
      // 再上层的stroke
      for (let j = 0, len = stroke.length; j < len; j++) {
        if (!strokeEnable[j] || !strokeWidth[j]) {
          continue;
        }
        const s = stroke[j];
        const p = strokePosition[j];
        ctx.globalCompositeOperation = getCanvasGCO(strokeMode[j]);
        // 颜色
        if (Array.isArray(s)) {
          ctx.strokeStyle = color2rgbaStr(s);
        }
        // 或者渐变
        else {
          if (s.t === GRADIENT.LINEAR) {
            const gd = getLinear(s.stops, s.d, 0, 0, w + x * 2, h+ y * 2);
            const lg = ctx.createLinearGradient(gd.x1 + dx2, gd.y1 + dy2, gd.x2 + dx2, gd.y2 + dy2);
            gd.stop.forEach((item) => {
              lg.addColorStop(item.offset, color2rgbaStr(item.color));
            });
            ctx.strokeStyle = lg;
          }
          else if (s.t === GRADIENT.RADIAL) {
            const gd = getRadial(s.stops, s.d, 0, 0, w - dx * 2, h - dy * 2);
            const rg = ctx.createRadialGradient(
              gd.cx + dx2,
              gd.cy + dy2,
              0,
              gd.cx + dx2,
              gd.cy + dy2,
              gd.total,
            );
            gd.stop.forEach((item) => {
              rg.addColorStop(item.offset, color2rgbaStr(item.color));
            });
            // 椭圆渐变，由于有缩放，先离屏绘制白色stroke记a，再绘制变换的结果整屏fill记b，b混合到a上用source-in即可只显示重合的b
            const m = gd.matrix;
            if (m) {
              const ellipse = inject.getOffscreenCanvas(item.w, item.h);
              const ctx2 = ellipse.ctx;
              ctx2.setLineDash(ctx.getLineDash());
              ctx2.lineCap = ctx.lineCap;
              ctx2.lineJoin = ctx.lineJoin;
              ctx2.miterLimit = ctx.miterLimit;
              ctx2.lineWidth = strokeWidth[j];
              ctx2.strokeStyle = '#FFF';
              ctx2.beginPath();
              coords.forEach((item) => {
                canvasPolygon(ctx2, item, dx2, dy2);
              });
              if (isClosed) {
                ctx2.closePath();
              }
              if (p === STROKE_POSITION.INSIDE && isClosed) {
                ctx2.lineWidth = strokeWidth[j] * 2;
                ctx2.save();
                ctx2.clip();
                ctx2.stroke();
                ctx2.restore();
              }
              else if (p === STROKE_POSITION.OUTSIDE && isClosed) {
                ctx2.lineWidth = strokeWidth[j] * 2;
                ctx2.stroke();
                ctx2.save();
                ctx2.clip();
                ctx2.globalCompositeOperation = 'destination-out';
                ctx2.strokeStyle = '#FFF';
                ctx2.stroke();
                ctx2.restore();
              }
              else {
                ctx2.stroke();
              }
              ctx2.fillStyle = rg;
              ctx2.globalCompositeOperation = 'source-in';
              ctx2.setTransform(m[0], m[1], m[4], m[5], m[12], m[13]);
              ctx2.fillRect(0, 0, w, h);
              ctx.drawImage(ellipse.canvas, 0, 0);
              ellipse.release();
              continue;
            }
            else {
              ctx.strokeStyle = rg;
            }
          }
          else if (s.t === GRADIENT.CONIC) {
            const gd = getConic(s.stops, s.d, 0, 0, w - dx * 2, h - dy * 2);
            const cg = ctx.createConicGradient(gd.angle, gd.cx + dx2, gd.cy + dy2);
            gd.stop.forEach((item) => {
              cg.addColorStop(item.offset, color2rgbaStr(item.color));
            });
            ctx.strokeStyle = cg;
          }
        }
        // 注意canvas只有居中描边，内部需用clip模拟，外部比较复杂需离屏擦除
        let os: OffScreen | undefined, ctx2: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | undefined;
        if (p === STROKE_POSITION.INSIDE && isClosed) {
          ctx.lineWidth = strokeWidth[j] * 2;
        }
        else if (p === STROKE_POSITION.OUTSIDE && isClosed) {
          os = inject.getOffscreenCanvas(item.w, item.h);
          ctx2 = os.ctx;
          ctx2.setLineDash(ctx.getLineDash());
          ctx2.lineCap = ctx.lineCap;
          ctx2.lineJoin = ctx.lineJoin;
          ctx2.miterLimit = ctx.miterLimit;
          ctx2.strokeStyle = ctx.strokeStyle;
          ctx2.lineWidth = strokeWidth[j] * 2;
          ctx2.beginPath();
          coords.forEach((item) => {
            canvasPolygon(ctx2!, item, dx2, dy2);
          });
        }
        else {
          ctx.lineWidth = strokeWidth[j];
        }
        if (isClosed) {
          if (ctx2) {
            ctx2.closePath();
          }
        }
        if (p === STROKE_POSITION.INSIDE && isClosed) {
          ctx.save();
          ctx.clip();
          ctx.stroke();
          ctx.restore();
        }
        else if (p === STROKE_POSITION.OUTSIDE && isClosed) {
          ctx2!.stroke();
          ctx2!.save();
          ctx2!.clip();
          ctx2!.globalCompositeOperation = 'destination-out';
          ctx2!.strokeStyle = '#FFF';
          ctx2!.stroke();
          ctx2!.restore();
          ctx.drawImage(os!.canvas, 0, 0);
          os!.release();
        }
        else {
          ctx.stroke();
        }
      }
      // 还原
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  genTexture(gl: WebGL2RenderingContext | WebGLRenderingContext) {
    this.renderCanvas();
    this.textureCache?.release();
    const canvasCache = this.canvasCache;
    if (canvasCache?.available) {
      this.textureTarget = this.textureCache = new TextureCache(gl, ceilBbox(this.bbox.slice(0)), canvasCache);
      canvasCache.release();
    }
    else {
      this.textureTarget = this.textureCache = null;
    }
  }

  resetTextureTarget() {
    const { textureCache, textureTotal, textureFilter } = this;
    if (textureFilter?.available) {
      this.textureTarget = textureFilter;
    }
    if (textureTotal?.available) {
      this.textureTarget = textureTotal;
    }
    if (textureCache?.available) {
      this.textureTarget = textureCache;
    }
  }

  updateStyle(style: Partial<JStyle>, cb?: (sync: boolean) => void) {
    const formatStyle = normalize(style);
    return this.updateFormatStyle(formatStyle, cb);
  }

  updateFormatStyle(style: Partial<Style>, cb?: (sync: boolean) => void): RefreshLevel {
    const keys = this.updateFormatStyleData(style);
    // 无变更
    if (!keys.length) {
      cb && cb(true);
    }
    else if (this.root) {
      return this.root.addUpdate(this, keys, undefined, cb);
    }
    return RefreshLevel.NONE;
  }

  updateFormatStyleData(style: Partial<Style>) {
    const keys: (keyof Style)[] = [];
    for (let k in style) {
      if (style.hasOwnProperty(k)) {
        if (!equalStyle(style, this.style, k as keyof Style)) {
          // @ts-ignore
          this.style[k] = style[k as keyof Style];
          keys.push(k as keyof Style);
        }
      }
    }
    return keys;
  }

  clearTexCache(includeSelf = false) {
    if (includeSelf) {
      this.refreshLevel |= RefreshLevel.REPAINT;
      this.textureCache?.release();
    }
    this.textureTotal?.release();
    this.textureFilter?.release();
  }

  clearTexCacheUpward(includeSelf = false) {
    let parent = this.parent;
    while (parent) {
      parent.clearTexCache(includeSelf);
      parent = parent.parent;
    }
  }

  clearMask(upwards = true) {
    this.textureMask?.release();
    this.resetTextureTarget();
    this.struct.next = 0;
    this.refreshLevel |= RefreshLevel.MASK;
    // mask切换影响父级组的bbox
    if (upwards) {
      let p = this.parent;
      while (p && p !== this.root) {
        p.clearTexCache();
        p.calRect();
        p.calBbox();
        p.calFilterBbox();
        p.tempBbox = null;
        p = p.parent;
      }
    }
  }

  refresh(lv: RefreshLevel = RefreshLevel.REPAINT, cb?: ((sync: boolean) => void)) {
    this.root?.addUpdate(this, [], lv, cb);
  }

  getBackgroundCoords(x = 0, y = 0) {
    const computedStyle = this._computedStyle;
    const { borderTopLeftRadius, borderTopRightRadius, borderBottomLeftRadius, borderBottomRightRadius } = computedStyle;
    // 限制圆角半径，不能超过宽高一半
    const min = Math.min(computedStyle.width * 0.5, computedStyle.height * 0.5);
    const tl = Math.min(min, borderTopLeftRadius);
    const tr = Math.min(min, borderTopRightRadius);
    const bl = Math.min(min, borderBottomLeftRadius);
    const br = Math.min(min, borderBottomRightRadius);
    let coords: number[][];
    if (tl === 0 && tr === 0 && bl === 0 && br === 0) {
      coords = [
        [x, y],
        [computedStyle.width, y],
        [computedStyle.width, computedStyle.height],
        [x, computedStyle.height],
        [x, y],
      ];
    }
    else {
      coords = [
        [tl, y],
        [computedStyle.width - tr, y],
        [computedStyle.width - tr + tr * H, y, computedStyle.width, tr * H, computedStyle.width, tr],
        [computedStyle.width, computedStyle.height - br],
        [computedStyle.width, computedStyle.height - br + br * H, computedStyle.width - br + br * H, computedStyle.height, computedStyle.width - br, computedStyle.height],
        [bl, computedStyle.height],
        [bl * H, computedStyle.height, x, computedStyle.height - bl + bl * H, x, computedStyle.height - bl],
        [x, tl],
        [x, tl - tl * H, tl - tl * H, y, tl, y],
      ];
    }
    return coords;
  }

  getStyle() {
    return cloneStyle(this.style) as Style;
  }

  getComputedStyle() {
    const res: ComputedStyle = Object.assign({}, this._computedStyle);
    if (this.isMounted) {
      res.color = res.color.slice(0);
      res.backgroundColor = res.backgroundColor.slice(0);
      res.fill = clone(res.fill);
      res.stroke = clone(res.stroke);
      res.fillOpacity = res.fillOpacity.slice(0);
      res.fillEnable = res.fillEnable.slice(0);
      res.fillMode = res.fillMode.slice(0);
      res.strokeEnable = res.strokeEnable.slice(0);
      res.strokeWidth = res.strokeWidth.slice(0);
      res.transformOrigin = res.transformOrigin.slice(0) as [number, number];
      res.strokeDasharray = res.strokeDasharray.slice(0);
    }
    return res;
  }

  getCssStyle(standard = false) {
    const { _style: style, _computedStyle: computedStyle } = this;
    const res: any = {};
    // %单位转换
    [
      'top', 'right', 'bottom', 'left', 'width', 'height',
      'translateX', 'translateY', 'scaleX', 'scaleY', 'rotateZ',
      'borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius',
    ].forEach((k) => {
      const o: any = style[k as keyof JStyle];
      if (o.u === StyleUnit.AUTO) {
        res[k] = 'auto';
      }
      else if (o.u === StyleUnit.PERCENT) {
        res[k] = o.v + '%';
      }
      else if (o.u === StyleUnit.PX || o.u === StyleUnit.NUMBER || o.u === StyleUnit.DEG) {
        res[k] = o.v;
      }
    });
    res.display = ['none', 'block', 'inline', 'inlineBlock', 'flex'][style.display.v] || 'none';
    res.opacity = style.opacity.v;
    res.visibility = style.visibility.v === VISIBILITY.VISIBLE ? 'visible' : 'hidden';
    res.color = color2rgbaStr(style.color.v);
    res.backgroundColor = color2rgbaStr(style.backgroundColor.v);
    res.fontFamily = style.fontFamily.v;
    res.fontStyle = ['normal', 'italic', 'oblique'][style.fontStyle.v];
    res.textAlign = ['left', 'right', 'center', 'justify'][style.textAlign.v];
    res.textVerticalAlign = ['top', 'middle', 'bottom'][style.textVerticalAlign.v];
    res.textDecoration = style.textDecoration.map(item => {
      return ['none', 'underline', 'lineThrough'][item.v] || 'none';
    });
    if (standard) {
      res.textDecoration = res.textDecoration.join(', ');
    }
    res.textShadow = style.textShadow.v.x + 'px '
      + style.textShadow.v.y + 'px '
      + style.textShadow.v.blur + 'px '
      + color2rgbaStr(style.textShadow.v.color);
    res.mixBlendMode = getCssMbm(style.mixBlendMode.v);
    res.objectFit = getCssObjectFit(style.objectFit.v);
    ['strokeEnable', 'fillEnable', 'fillOpacity', 'strokeWidth'].forEach((k) => {
      res[k] = style[k as | 'strokeEnable' | 'fillEnable' | 'fillOpacity' | 'strokeWidth'].map(item => item.v);
    });
    if (standard) {
      if (this.isMounted) {
        res.fill = style.fill.map(item => getCssFillStroke(item.v, this.width, this.height, true));
      }
      else {
        inject.error('Can not get CSS standard fill unmounted');
      }
    }
    else {
      res.fill = style.fill.map(item => getCssFillStroke(item.v));
    }
    res.fillRule = ['nonzero', 'evenodd'][style.fillRule.v];
    res.fillMode = style.fillMode.map(item => getCssMbm(item.v));
    if (standard) {
      if (this.isMounted) {
        res.stroke = style.stroke.map(item => getCssFillStroke(item.v, this.width, this.height, true));
      }
      else {
        inject.error('Can not get CSS standard stroke unmounted');
      }
    }
    else {
      res.stroke = style.stroke.map(item => getCssFillStroke(item.v));
    }
    res.strokeLinecap = ['butt', 'round', 'square'][style.strokeLinecap.v];
    res.strokeLinejoin = ['miter', 'round', 'bevel'][style.strokeLinejoin.v];
    res.strokePosition = style.strokePosition.map(item => getCssStrokePosition(item.v));
    res.strokeMiterlimit = style.strokeMiterlimit.v;
    res.strokeDasharray = style.strokeDasharray.map(item => item.v);
    res.strokeMode = style.strokeMode.map(item => getCssMbm(item.v));
    res.transformOrigin = style.transformOrigin.map(item => {
      if (item.u === StyleUnit.PERCENT) {
        return item.v + '%';
      }
      return item;
    });
    res.overflow = ['visible', 'hidden'][style.overflow.v];
    res.filter = calComputedFilter(style.filter, computedStyle.width, computedStyle.height)
      .map(item => getCssFilter(item));
    return res as JStyle;
  }

  // 同dom同名api
  getBoundingClientRect(opt?: {
    includeBbox?: boolean,
  }) {
    const bbox = opt?.includeBbox
      ? this.bbox
      : this._rect;
    const t = calRectPoints(bbox[0], bbox[1], bbox[2], bbox[3], this.matrixWorld);
    const x1 = t.x1;
    const y1 = t.y1;
    const x2 = t.x2;
    const y2 = t.y2;
    const x3 = t.x3;
    const y3 = t.y3;
    const x4 = t.x4;
    const y4 = t.y4;
    const left = Math.min(x1, x2, x3, x4);
    const top = Math.min(y1, y2, y3, y4);
    const right = Math.max(x1, x2, x3, x4);
    const bottom = Math.max(y1, y2, y3, y4);
    return {
      left,
      top,
      right,
      bottom,
      width: right - left,
      height: bottom - top,
      points: [
        {
          x: x1,
          y: y1,
        },
        {
          x: x2,
          y: y2,
        },
        {
          x: x3,
          y: y3,
        },
        {
          x: x4,
          y: y4,
        },
      ],
    };
  }

  // 相对parent不考虑旋转rect只考虑自身width/height
  getOffsetRect() {
    const computedStyle = this._computedStyle;
    const left = computedStyle.left + computedStyle.translateX;
    const top = computedStyle.top + computedStyle.translateY;
    return {
      left,
      top,
      right: left + this.width,
      bottom: top + this.height,
    };
  }

  /**
   * 拖拽开始变更尺寸前预校验，如果style有translate初始值，需要改成普通模式（为0），比如Text和固定尺寸的节点，
   * left调整到以左侧为基准（translateX从-50%到0，差值重新加到left上），top同理，
   * 如此才能防止拉伸时（如往右）以自身中心点为原点左右一起变化，拖拽结束后再重置回去（translateX重新-50%，left也重算）。
   * right/bottom一般情况不用关心，因为如果是left+right说明Text是固定尺寸width无效且无translateX，但为了扩展兼容一并考虑，
   * 只有left百分比+translateX-50%需要，width可能固定也可能自动不用考虑只需看当前计算好的width值。
   */
  startSizeChange() {
    const {
      width,
      height,
      _style: style,
      _computedStyle: computedStyle,
      parent,
      isMounted,
    } = this;
    if (!isMounted || !parent) {
      throw new Error('Can not resize a destroyed Node or Root');
    }
    const {
      left,
      right,
      top,
      bottom,
      translateX,
      translateY,
    } = style;
    const { width: pw, height: ph } = parent;
    // 理论sketch中只有-50%，但人工可能有其他值，可统一处理
    if (translateX.v && translateX.u === StyleUnit.PERCENT) {
      const v = translateX.v * width * 0.01;
      if (left.u === StyleUnit.PERCENT) {
        left.v += v * 100 / pw;
      }
      else if (left.u === StyleUnit.PX) {
        left.v += v;
      }
      computedStyle.left += v;
      if (right.u === StyleUnit.PERCENT) {
        right.v -= v * 100 / pw;
      }
      else if (right.u === StyleUnit.PX) {
        right.v -= v;
      }
      computedStyle.right -= v;
      translateX.v = 0;
    }
    if (translateY.v && translateY.u === StyleUnit.PERCENT) {
      const v = translateY.v * height * 0.01;
      if (top.u === StyleUnit.PERCENT) {
        top.v += v * 100 / ph;
      }
      else if (top.u === StyleUnit.PX) {
        top.v += v;
      }
      computedStyle.top += v;
      if (bottom.u === StyleUnit.PERCENT) {
        bottom.v -= v * 100 / ph;
      }
      else if (bottom.u === StyleUnit.PX) {
        bottom.v -= v;
      }
      computedStyle.bottom -= v;
      translateY.v = 0;
    }
  }

  /**
   * 参考 startSizeChange()，反向进行，在连续拖拽改变尺寸的过程中，最后结束调用。
   * 根据开始调整时记录的prev样式，还原布局信息到translate（仅百分比）上。
   * 还需向上检查组的自适应尺寸，放在外部自己调用check。
   */
  endSizeChange(prev: Style) {
    const {
      translateX,
      translateY,
    } = prev;
    const {
      _style: style,
      _computedStyle: computedStyle,
      parent,
      width: w,
      height: h,
    } = this;
    const {
      left,
      right,
      top,
      bottom,
    } = style;
    const { width: pw, height: ph } = parent!;
    if (translateX.v && translateX.u === StyleUnit.PERCENT) {
      const v = translateX.v * w * 0.01;
      if (left.u === StyleUnit.PX) {
        left.v -= v;
      }
      else if (left.u === StyleUnit.PERCENT) {
        left.v -= v * 100 / pw;
      }
      computedStyle.left -= v;
      if (right.u === StyleUnit.PX) {
        right.v += v;
      }
      else if (right.u === StyleUnit.PERCENT) {
        right.v += v * 100 / pw;
      }
      computedStyle.right += v;
      computedStyle.translateX += v; // start置0了
    }
    if (translateY.v && translateY.u === StyleUnit.PERCENT) {
      const v = translateY.v * h * 0.01;
      if (top.u === StyleUnit.PX) {
        top.v -= v;
      }
      else if (style.top.u === StyleUnit.PERCENT) {
        top.v -= v * 100 / ph;
      }
      computedStyle.top -= v;
      if (bottom.u === StyleUnit.PX) {
        bottom.v += v;
      }
      else if (bottom.u === StyleUnit.PERCENT) {
        bottom.v += v * 100 / ph;
      }
      computedStyle.bottom += v;
      computedStyle.translateY += v;
    }
    style.translateX.v = translateX.v;
    style.translateX.u = translateX.u;
    style.translateY.v = translateY.v;
    style.translateY.u = translateY.u;
  }

  // 移动过程是用translate加速，结束后要更新TRBL的位置以便后续定位，还要还原translate为原本的%（可能）
  endPosChange(prev: Style, dx: number, dy: number) {
    const {
      _style: style,
      _computedStyle: computedStyle,
      parent,
    } = this;
    // 未添加到dom
    if (!parent) {
      return;
    }
    const {
      translateX,
      translateY,
    } = prev;
    const {
      top,
      right,
      bottom,
      left,
    } = style;
    // 一定有parent，不会改root下固定的Container子节点
    const { width: pw, height: ph } = parent;
    if (dx) {
      if (left.u === StyleUnit.PX) {
        left.v += dx;
      }
      else if (left.u === StyleUnit.PERCENT) {
        left.v += dx * 100 / pw;
      }
      computedStyle.left += dx;
      if (right.u === StyleUnit.PX) {
        right.v -= dx;
      }
      else if (right.u === StyleUnit.PERCENT) {
        right.v -= dx * 100 / pw;
      }
      computedStyle.right -= dx;
      computedStyle.translateX -= dx;
    }
    if (dy) {
      if (top.u === StyleUnit.PX) {
        top.v += dy;
      }
      else if (top.u === StyleUnit.PERCENT) {
        top.v += dy * 100 / ph;
      }
      computedStyle.top += dy;
      if (bottom.u === StyleUnit.PX) {
        bottom.v -= dy;
      }
      else if (bottom.u === StyleUnit.PERCENT) {
        bottom.v -= dy * 100 / ph;
      }
      computedStyle.bottom -= dy;
      computedStyle.translateY -= dy;
    }
    style.translateX.v = translateX.v;
    style.translateX.u = translateX.u;
    style.translateY.v = translateY.v;
    style.translateY.u = translateY.u;
  }

  // 无刷新调整尺寸位置，比如父节点自适应尺寸将超出的无效范围收缩到孩子节点集合范围
  adjustPosAndSizeSelf(
    dx1: number,
    dy1: number,
    dx2: number,
    dy2: number,
  ) {
    const {
      _style: style,
      _computedStyle: computedStyle,
      parent,
      root,
    } = this;
    if (!parent || !root || (!dx1 && !dy1 && !dx2 && !dy2)) {
      return;
    }
    const { width: pw, height: ph } = parent;
    const {
      top,
      right,
      bottom,
      left,
      width,
      height,
      translateX,
      translateY,
    } = style;
    // 如果有%的tx，改变之前需要先转换掉，将其清空变成对应的left/right/width，否则会影响
    const needConvertTx = (dx1 || dx2) && translateX.u === StyleUnit.PERCENT && translateX.v;
    if (needConvertTx) {
      const d = needConvertTx * 0.01 * this.width;
      if (left.u === StyleUnit.PX) {
        left.v += d;
      }
      else if (left.u === StyleUnit.PERCENT) {
        left.v += d * 100 / pw;
      }
      computedStyle.left += d;
      if (right.u === StyleUnit.PX) {
        right.v -= d;
      }
      else if (right.u === StyleUnit.PERCENT) {
        right.v -= d * 100 / pw;
      }
      computedStyle.right -= d;
    }
    // 水平调整统一处理，固定此时无效
    if (dx1) {
      if (left.u === StyleUnit.PX) {
        left.v += dx1;
      }
      else if (left.u === StyleUnit.PERCENT) {
        left.v += (dx1 * 100) / pw;
      }
      computedStyle.left += dx1;
    }
    if (dx2) {
      if (right.u === StyleUnit.PX) {
        right.v -= dx2;
      }
      else if (right.u === StyleUnit.PERCENT) {
        right.v -= (dx2 * 100) / pw;
      }
      computedStyle.right -= dx2;
    }
    // 上面如果调整无论如何都会影响width
    if (dx2 - dx1) {
      if (width.u === StyleUnit.PX) {
        width.v = dx2 + this.width - dx1;
      }
      else if (width.u === StyleUnit.PERCENT) {
        width.v = (dx2 + this.width - dx1) * 100 / parent.width;
      }
      computedStyle.width = parent.width - computedStyle.left - computedStyle.right;
    }
    // 可能调整right到了left的左边形成负值，此时交换它们
    if (this.width < 0) {
      computedStyle.width = -this.width;
      const oldLeft = computedStyle.left;
      const oldRight = computedStyle.right;
      computedStyle.left = pw - oldRight;
      if (left.u === StyleUnit.PX) {
        left.v = computedStyle.left;
      }
      else if (left.u === StyleUnit.PERCENT) {
        left.v = computedStyle.left * 100 / pw;
      }
      computedStyle.right = pw - oldLeft;
      if (right.u === StyleUnit.PX) {
        right.v = computedStyle.right;
      }
      else if (right.u === StyleUnit.PERCENT) {
        right.v = computedStyle.right * 100 / pw;
      }
    }
    // 还原
    if (needConvertTx) {
      const d = needConvertTx * 0.01 * this.width;
      if (left.u === StyleUnit.PX) {
        left.v -= d;
      }
      else if (left.u === StyleUnit.PERCENT) {
        left.v -= d * 100 / pw;
      }
      computedStyle.left -=d;
      if (right.u === StyleUnit.PX) {
        right.v += d;
      }
      else if (right.u === StyleUnit.PERCENT) {
        right.v += d * 100 / pw;
      }
      computedStyle.right += d;
    }
    // 垂直和水平一样
    const needConvertTy = (dy1 || dy2) && translateY.u === StyleUnit.PERCENT && translateY.v;
    if (needConvertTy) {
      const d = needConvertTy * 0.01 * this.height;
      if (top.u === StyleUnit.PX) {
        top.v += d;
      }
      else if (top.u === StyleUnit.PERCENT) {
        top.v += d * 100 / ph;
      }
      computedStyle.top += d;
      if (bottom.u === StyleUnit.PX) {
        bottom.v -= d;
      }
      else if (bottom.u === StyleUnit.PERCENT) {
        bottom.v -= d * 100 / ph;
      }
      computedStyle.bottom -= d;
    }
    if (dy1) {
      if (top.u === StyleUnit.PX) {
        top.v += dy1;
      }
      else if (top.u === StyleUnit.PERCENT) {
        top.v += (dy1 * 100) / ph;
      }
      computedStyle.top += dy1;
    }
    if (dy2) {
      if (bottom.u === StyleUnit.PX) {
        bottom.v -= dy2
      }
      else if (bottom.u === StyleUnit.PERCENT) {
        bottom.v -= (dy2 * 100) / ph;
      }
      computedStyle.bottom -= dy2;
    }
    if (dy2 - dy1) {
      if (height.u === StyleUnit.PX) {
        height.v = dy2 + this.height - dy1;
      }
      else if (height.u === StyleUnit.PERCENT) {
        height.v = (dy2 + this.height - dy1) * 100 / parent.height;
      }
      computedStyle.height = parent.height - computedStyle.top - computedStyle.bottom;
    }
    if (this.height < 0) {
      computedStyle.height = -this.height;
      const oldTop = computedStyle.top;
      const oldBottom = computedStyle.bottom;
      computedStyle.top = ph - oldTop;
      if (top.u === StyleUnit.PX) {
        top.v = computedStyle.top;
      }
      else if (top.u === StyleUnit.PERCENT) {
        top.v = computedStyle.top * 100 / ph;
      }
      computedStyle.bottom = ph - oldBottom;
      if (bottom.u === StyleUnit.PX) {
        bottom.v = computedStyle.bottom;
      }
      else if (bottom.u === StyleUnit.PERCENT) {
        bottom.v = computedStyle.bottom * 100 / ph;
      }
    }
    if (needConvertTy) {
      const d = needConvertTy * 0.01 * this.height;
      if (top.u === StyleUnit.PX) {
        top.v -= d;
      }
      else if (top.u === StyleUnit.PERCENT) {
        top.v -= d * 100 / ph;
      }
      computedStyle.top -=d;
      if (bottom.u === StyleUnit.PX) {
        bottom.v += d;
      }
      else if (bottom.u === StyleUnit.PERCENT) {
        bottom.v += d * 100 / ph;
      }
      computedStyle.bottom += d;
    }
    // 影响matrix，这里不能用优化optimize计算，必须重新计算，因为最终值是left+translateX
    this.refreshLevel |= RefreshLevel.TRANSFORM_ALL;
    root.rl |= RefreshLevel.TRANSFORM_ALL;
    this.calMatrix(RefreshLevel.TRANSFORM_ALL);
    // 记得重置，tempBbox等需赋值，其默认EMPTY_RECT，get获取一次后就变成自己的真实数据替换掉默认
    this.calRect();
    this.calBbox();
    this.calFilterBbox();
    this.tempBbox = null;
  }

  // 节点位置尺寸发生变更后，会递归向上影响，逐步检查，可能在某层没有影响提前跳出中断
  checkPosSizeUpward() {
    const root = this.root!;
    let parent = this.parent;
    while (parent && parent !== root) {
      if (!parent.adjustPosAndSize()) {
        // 无影响中断向上递归，比如拖动节点并未超过组的范围
        break;
      }
      parent = parent.parent;
    }
  }

  // 空实现，叶子节点没children不关心根据children自适应尺寸，Container会覆盖
  adjustPosAndSize() {
    return false;
  }

  protected initAnimate(animation: AbstractAnimation, options: Options) {
    this._animationList.push(animation);
    const root = this.root;
    if (!this.isMounted || !root) {
      animation.cancel();
      return animation;
    }
    root.aniController.addAni(animation);
    if (options.autoPlay && this.isMounted) {
      animation.play();
    }
    else if (options.fill === 'backwards' || options.fill === 'both') {
      animation.gotoAndStop(0);
    }
    return animation;
  }

  animate(keyFrames: JKeyFrame[], options: Options) {
    const animation = new CssAnimation(this, keyFrames, options);
    return this.initAnimate(animation, options);
  }

  release() {
    this.remove();
    this._animationList.splice(0).forEach(item => item.remove());
    this.clearTexCache();
  }

  cloneProps() {
    const props = Object.assign({}, this.props);
    props.name = this.name;
    props.style = this.getCssStyle();
    return props;
  }

  clone() {
    const props = this.cloneProps();
    const res = new Node(props);
    return res as this;
  }

  get x() {
    return this._x;
  }

  get y() {
    return this._y;
  }

  get struct() {
    return this._struct;
  }

  get opacity() {
    return this._opacity;
  }

  set opacity(v: number) {
    this._opacity = v;
  }

  get transform() {
    return this._transform;
  }

  get matrix() {
    return this._matrix;
  }

  // 可能在布局后异步渲染前被访问，此时没有这个数据，刷新后就有缓存，变更transform或者reflow无缓存
  get matrixWorld() {
    const root = this.root;
    let m = this._matrixWorld;
    if (!root) {
      return m;
    }
    // 循环代替递归，判断包含自己在内的这条分支上的父级是否有缓存，如果都有缓存，则无需计算
    /* eslint-disable */
    let node: Node = this,
      cache = this.hasCacheMw,
      parent = node.parent,
      index = -1;
    const pList: Container[] = [];
    while (parent) {
      pList.push(parent);
      // 父级变更过后id就会对不上，但首次初始化后是一致的，防止初始化后立刻调用所以要多判断下
      if (!parent.hasCacheMw || parent.localMwId !== node.parentMwId) {
        cache = false;
        index = pList.length; // 供后面splice裁剪用
      }
      node = parent;
      parent = parent.parent;
    }
    // 这里的cache是考虑了向上父级的，只要有失败的就进入，从这条分支上最上层无缓存的父级开始计算
    if (!cache) {
      // 父级有变化则所有向下都需更新，可能第一个是root（极少场景会修改root的matrix）
      if (index > -1) {
        pList.splice(index);
        pList.reverse();
        for (let i = 0, len = pList.length; i < len; i++) {
          const node = pList[i];
          /**
           * 被动变更判断，自己没有变更但父级发生了变更需要更新id，这里的情况比较多
           * 某个父节点可能没有变更，也可能发生变更，变更后如果进行了读取则不会被记录进来
           * 记录的顶层父节点比较特殊，会发生上述情况，中间父节点不会有变更后读取的情况
           * 因此只有没有变化且和父级id不一致时，其id自增标识，有变化已经主动更新过了
           */
          if (node.hasCacheMw && node.parentMwId !== node.parent?.localMwId) {
            node.localMwId++;
          }
          node.hasCacheMw = true;
          if (node === root) {
            assignMatrix(node._matrixWorld, node.matrix);
          }
          else {
            const ppm = node.parent!.perspectiveMatrix;
            const pm = node.perspectiveMatrixSelf;
            let mt = node.matrix;
            if (pm) {
              mt = multiply(pm, mt);
            }
            if (ppm) {
              mt = multiply(ppm, mt);
            }
            const t = multiply(node.parent!._matrixWorld, mt);
            assignMatrix(node._matrixWorld, t);
            node.parentMwId = node.parent!.localMwId;
          }
        }
      }
      // 自己没有变化但父级出现变化影响了这条链路，被动变更，这里父级id一定是不一致的，否则进不来
      if (this.hasCacheMw) {
        this.localMwId++;
      }
      this.hasCacheMw = true;
      // 仅自身变化，或者有父级变化但父级前面已经算好了，防止自己是Root
      parent = this.parent;
      if (parent) {
        const ppm = parent.perspectiveMatrix;
        const pm = this.perspectiveMatrixSelf;
        let mt = this.matrix;
        if (pm) {
          mt = multiply(pm, mt);
        }
        if (ppm) {
          mt = multiply(ppm, mt);
        }
        const t = multiply(parent._matrixWorld, mt);
        assignMatrix(m, t);
        this.parentMwId = parent.localMwId; // 更新以便后续对比
      }
      else {
        const pm = this.perspectiveMatrixSelf;
        if (pm) {
          assignMatrix(m, multiply(pm, this.matrix));
        }
        else {
          assignMatrix(m, this.matrix);
        }
      }
    }
    return m;
  }

  get perspectiveMatrix() {
    return this._perspectiveMatrix;
  }

  get perspectiveMatrixSelf() {
    return this._perspectiveMatrixSelf;
  }

  get rect() {
    return this._rect;
  }

  get bbox() {
    return this._bbox;
  }

  get filterBbox() {
    return this._filterBbox;
  }

  get style() {
    return this._style;
  }

  get computedStyle() {
    return this._computedStyle;
  }

  get animationList() {
    return this._animationList;
  }
}

export default Node;
