import { ComputedStyle, MASK, MIX_BLEND_MODE, OVERFLOW, StyleUnit, VISIBILITY } from '../style/define';
import Node from '../node/Node';
import Root from '../node/Root';
import { RefreshLevel } from './level';
import { assignMatrix, inverse, isE, multiply, toE } from '../math/matrix';
import { Struct } from './struct';
import { ceilBbox, mergeBbox } from '../math/bbox';
import TextureCache, { SubTexture } from './TextureCache';
import config from '../config';
import {
  createTexture,
  drawMask,
  drawMbm,
  drawTextureCache,
  // texture2Blob,
} from '../gl/webgl';
import inject from '../util/inject';
import { genGaussBlur, genMotionBlur, genRadialBlur } from './blur';
import { genFrameBufferWithTexture, releaseFrameBuffer } from './fb';
import { checkInRect } from './check';
import CacheProgram from '../gl/CacheProgram';
import { calMatrixByOrigin, calPerspectiveMatrix } from '../style/transform';
import { genBloom } from './bloom';
import { needReGen } from './spread';
import { genLightDark } from './lightDark';
import { genColorMatrix } from './cm';

export type Merge = {
  i: number;
  lv: number;
  total: number;
  node: Node;
  valid: boolean;
  subList: Merge[]; // 子节点在可视范围外无需merge但父节点在内需要强制子节点merge
  isNew: boolean; // 新生成的merge，老的要么有merge结果，要么可视范围外有tempBbox
  isTop: boolean; // 是否是顶层，当嵌套时子Merge不是顶层，判断范围父子关系有影响
}

export function genMerge(
  gl: WebGL2RenderingContext | WebGLRenderingContext,
  root: Root,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) {
  const { structs, width: W, height: H } = root;
  root.contentLoadingCount = 0; // 归零重新计数
  const mergeList: Merge[] = [];
  const mergeHash: Merge[] = [];
  for (let i = 0, len = structs.length; i < len; i++) {
    const { node, lv, total, next } = structs[i];
    const { refreshLevel, computedStyle, textureTotal, textureFilter, textureMask } = node;
    node.refreshLevel = RefreshLevel.NONE;
    // 无任何变化即refreshLevel为NONE（0）忽略
    if (refreshLevel >= RefreshLevel.REPAINT) {
      node.calContent();
    }
    // 加载中的计数
    root.contentLoadingCount += node.calContentLoading();
    const {
      filter,
      opacity,
      mixBlendMode,
      overflow,
      maskMode,
    } = computedStyle;
    // 非单节点透明需汇总子树，有mask的也需要，已经存在的无需汇总
    const needTotal =
      (
        (opacity > 0 && opacity < 1)
        || mixBlendMode !== MIX_BLEND_MODE.NORMAL
        || overflow === OVERFLOW.HIDDEN
      )
      && total > 0
      && !textureTotal?.available;
    const needFilter = filter.map(item => {
      if (item.u === StyleUnit.BLOOM) {
        return item.threshold > 0;
      }
      if (item.u === StyleUnit.SEPIA) {
        return item.radius > 0 && item.radius < 1;
      }
      return item.radius >= 1;
    }).filter(item => item).length > 0 && !textureFilter?.available;
    let needMask = maskMode > 0 && !textureMask?.available;
    // 单个的alpha蒙版不渲染（没有next），target指向空的mask纹理汇总，循环时判空跳过
    if (needMask) {
      if (!node.next || node.next.computedStyle.breakMask || node.next.computedStyle.maskMode !== MASK.NONE) {
        needMask = false;
        node.textureMask?.release();
        node.textureMask = undefined;
      }
    }
    if (needTotal || needFilter || needMask) {
      const t: Merge = {
        i,
        lv,
        total,
        node,
        valid: false,
        subList: [],
        isNew: false,
        isTop: true, // 后续遍历检查时子的置false
      }
      mergeList.push(t);
      mergeHash[i] = t;
    }
    if (textureTotal?.available) {
      i += total;
    }
    if (textureMask?.available) {
      i += next;
    }
  }
  // console.warn(mergeList)
  // 后根顺序，即叶子节点在前，兄弟的后节点在前
  mergeList.sort(function (a, b) {
    if (a.lv === b.lv) {
      return b.i - a.i;
    }
    return b.lv - a.lv;
  });
  // 先循环求一遍各自merge的bbox汇总，以及是否有嵌套关系
  for (let j = 0, len = mergeList.length; j < len; j++) {
    const item = mergeList[j];
    const { i, total, node } = item;
    // 曾经求过merge汇总但因为可视范围外没展示的，且没有变更过的省略计算，但需要统计嵌套关系
    const isNew = item.isNew = !node.tempBbox;
    node.tempBbox = genBboxTotal(
      structs,
      node,
      i,
      total,
      isNew,
      item,
      mergeHash,
    );
  }
  // 再循环一遍，判断merge是否在可视范围内，这里只看最上层的即可，在范围内则将其及所有子merge打标valid
  for (let j = 0, len = mergeList.length; j < len; j++) {
    const item = mergeList[j];
    const { node, isTop, i, lv, total } = item;
    if (isTop) {
      if (checkInRect(node.tempBbox!, node.matrixWorld, x1, y1, x2 - x1, y2 - y1)) {
        // 检查子节点中是否有因为可视范围外暂时忽略的，全部标记valid，这个循环会把数据集中到最上层subList，后面反正不再用了
        setValid(item);
        // 如果是mask，还要看其是否影响被遮罩的merge，可能被遮罩在屏幕外面不可见
        if (node.computedStyle.maskMode) {
          genNextCount(node, structs, i, lv, total);
          for (let k = j; k >= 0; k--) {
            const item2 = mergeList[k];
            if (item2.i > i + total + node.struct.next) {
              break;
            }
            setValid(item2);
          }
        }
      }
    }
  }
  // 最后一遍循环根据可视范围内valid标记产生真正的merge汇总
  for (let j = 0, len = mergeList.length; j < len; j++) {
    const { i, lv, total, node, valid, isNew } = mergeList[j];
    const { maskMode } = node.computedStyle;
    // 过滤可视范围外的，如果新生成的，则要统计可能存在mask影响后续节点数量
    if (!valid) {
      if (isNew && maskMode) {
        genNextCount(node, structs, i, lv, total);
      }
      continue;
    }
    // 不可见的，注意蒙版不可见时也生效
    if (shouldIgnore(node.computedStyle)) {
      continue;
    }
    let res: TextureCache | undefined;
    // 尝试生成此节点汇总纹理，无论是什么效果，都是对汇总后的起效，单个节点的绘制等于本身纹理缓存
    if (!node.textureTotal?.available) {
      const t = genTotal(
        gl,
        root,
        node,
        structs,
        i,
        total,
        W,
        H,
      );
      // 这里判断特殊，因为单节点genTotal可能返回了cache自身，同时有tint，不能让cache覆盖了tint
      if (t && !res) {
        node.textureTotal = node.textureTarget = t;
        res = t;
      }
    }
    // 生成filter，这里直接进去，如果没有filter会返回空，group的tint也视作一种filter
    if (node.textureTarget && !node.textureFilter?.available) {
      const t = genFilter(gl, root, node, W, H);
      if (t) {
        node.textureFilter = node.textureTarget = t;
        res = t;
      }
    }
    // 生成mask，需要判断next否则无效，或者手动指定内容
    if (maskMode && node.textureTarget?.available && !node.textureMask?.available && node.next) {
      const t = genMask(
        gl,
        root,
        node,
        maskMode,
        structs,
        i,
        lv,
        total,
        W,
        H,
      );
      if (t) {
        node.textureMask = node.textureTarget = t;
        res = t;
      }
    }
  }
}

export function shouldIgnore(computedStyle: ComputedStyle) {
  return (computedStyle.visibility === VISIBILITY.HIDDEN || computedStyle.opacity <= 0) && !computedStyle.maskMode;
}

// 统计mask节点后续关联跳过的数量
function genNextCount(
  node: Node,
  structs: Struct[],
  index: number,
  lv: number,
  total: number,
) {
  for (let i = index + total + 1, len = structs.length; i < len; i++) {
    const { node: node2, lv: lv2 } = structs[i];
    const computedStyle = node2.computedStyle;
    if (lv > lv2) {
      node.struct.next = i - index - total - 1;
      break;
    }
    else if (i === (len - 1) || (computedStyle.breakMask && lv === lv2)) {
      node.struct.next = i - index - total;
      break;
    }
  }
}

/**
 * 汇总作为局部根节点的bbox，注意作为根节点自身不会包含filter/mask等，但又border所以用bbox，其子节点则是需要考虑的
 * 由于根节点视作E，因此子节点可以直接使用matrix预乘父节点，不会产生transformOrigin偏移
 */
function genBboxTotal(
  structs: Struct[],
  node: Node,
  index: number,
  total: number,
  isNew: boolean,
  merge: Merge,
  mergeHash: Merge[],
) {
  const res = (node.tempBbox || node._bbox || node.bbox).slice(0);
  toE(node.tempMatrix);
  // overflow加速
  if (node.computedStyle.overflow === OVERFLOW.HIDDEN || node.computedStyle.overflow === OVERFLOW.CLIP) {
    return res;
  }
  for (let i = index + 1, len = index + total + 1; i < len; i++) {
    const { node: node2, total: total2 } = structs[i];
    const target = node2.textureTarget;
    // 已有省略计算
    if (isNew) {
      const parent = node2.parent!;
      const ppm = parent.perspectiveMatrix;
      const pm = node2.perspectiveMatrixSelf;
      // console.log(i, ppm);
      let m = node2.matrix;
      if (pm) {
        m = multiply(pm, m);
      }
      if (ppm) {
        m = multiply(ppm, m);
      }
      const t = multiply(parent.tempMatrix, m);
      assignMatrix(node2.tempMatrix, t);
      // 合并不能用textureCache，因为如果有shadow的话bbox不正确
      const b = (target && target !== node2.textureCache) ?
        target.bbox : (node2._filterBboxInt || node2.filterBboxInt);
      // 防止空
      if (b[2] - b[0] && b[3] - b[1]) {
        mergeBbox(res, b, m);
      }
    }
    // 收集子节点中的嵌套关系，子的不是顶层isTop
    const mg = mergeHash[i];
    if (mg) {
      mg.isTop = false;
      merge.subList.push(mg);
    }
    // 有局部缓存跳过，注意可用
    if (target?.available && target !== node2.textureCache) {
      i += total2;
    }
  }
  return res;
}

type ListRect = Omit<SubTexture, 't'> & {
  x: number;
  y: number;
  t?: WebGLTexture;
  ref?: SubTexture;
  // x1: number;
  // y1: number;
  // x2: number;
  // y2: number;
};

function genTotal(
  gl: WebGL2RenderingContext | WebGLRenderingContext,
  root: Root,
  node: Node,
  structs: Struct[],
  index: number,
  total: number,
  W: number,
  H: number,
  force = false, // Bitmap在mask时强制生成
) {
  // 缓存仍然还在直接返回，无需重新生成
  if (node.textureTotal?.available) {
    // bitmap的total默认都是自己的cache，区分出来
    if (force) {
      if (node.textureTotal !== node.textureCache) {
        return node.textureTotal;
      }
    }
    else {
      return node.textureTotal;
    }
  }
  const bbox = node.tempBbox!;
  node.tempBbox = undefined;
  ceilBbox(bbox);
  // 单个叶子节点也不需要，就是本身节点的内容
  if (!total && !force) {
    let target = node.textureCache;
    if (!target?.available && node.hasContent) {
      node.genTexture(gl);
      target = node.textureCache;
    }
    return target;
  }
  const programs = root.programs;
  const main = programs.main;
  CacheProgram.useProgram(gl, main);
  // 创建一个空白纹理来绘制，尺寸由于bbox已包含整棵子树内容可以直接使用
  const x = bbox[0],
    y = bbox[1];
  const w = Math.ceil(bbox[2] - x),
    h = Math.ceil(bbox[3] - y);
  const res = TextureCache.getEmptyInstance(gl, bbox);
  res.available = true;
  const list = res.list;
  let frameBuffer: WebGLFramebuffer | undefined;
  const UNIT = config.maxTextureSize;
  const listRect: ListRect[] = [];
  // 要先按整数创建纹理块，再反向计算bbox（真实尺寸/scale），创建完再重新遍历按节点顺序渲染，因为有bgBlur存在
  for (let i = 0, len = Math.ceil(h / UNIT); i < len; i++) {
    for (let j = 0, len2 = Math.ceil(w / UNIT); j < len2; j++) {
      const width = j === len2 - 1 ? (w - j * UNIT) : UNIT;
      const height = i === len - 1 ? (h - i * UNIT) : UNIT;
      const x0 = x + j * UNIT,
        y0 = y + i * UNIT;
      const bbox = new Float32Array([
        x0,
        y0,
        x0 + width,
        y0 + height,
      ]);
      // 如有设置frame的overflow裁剪
      // let xa = -1, ya = -1, xb = 1, yb = 1;
      listRect.push({
        x: x + j * UNIT, // 坐标checkInRect用，同时真实渲染时才创建纹理，防止空白区域浪费显存，最后过滤
        y: y + i * UNIT,
        w: width,
        h: height,
        bbox,
        // x1: xa, y1: ya, x2: xb, y2: yb,
      });
    }
  }
  // 再外循环按节点序，内循环按分块，确保节点序内容先渲染，从而正确生成分块的bgBlur
  for (let i = index, len = index + total + 1; i < len; i++) {
    const { node: node2, total: total2, next: next2 } = structs[i];
    const computedStyle = node2.computedStyle;
    // 这里和主循环类似，不可见或透明考虑跳过
    if (shouldIgnore(computedStyle)) {
      i += total2 + next2;
      continue;
    }
    let opacity: number, matrix: Float32Array;
    // 首个节点即局部根节点
    if (i === index) {
      opacity = node2.tempOpacity = 1;
      toE(node2.tempMatrix);
      matrix = node2.tempMatrix;
      // 透视的origin要重算
      if (computedStyle.perspectiveSelf >= 1) {
        const tfo = computedStyle.transformOrigin;
        const pm = calPerspectiveMatrix(computedStyle.perspectiveSelf, tfo[0] - x, tfo[1] - y);
        assignMatrix(matrix, pm);
      }
      if (computedStyle.perspective >= 1) {
        const pfo = computedStyle.perspectiveOrigin;
        const ppm = calPerspectiveMatrix(computedStyle.perspective, pfo[0] - x, pfo[1] - y);
        const t = multiply(ppm, matrix);
        assignMatrix(matrix, t);
      }
    }
    // 子节点的matrix计算比较复杂，可能dx/dy不是0原点，造成transformOrigin偏移需重算matrix
    else {
      const parent = node2.parent!;
      opacity = node2.tempOpacity = computedStyle.opacity * parent.tempOpacity;
      let pm: Float32Array | undefined;
      if (computedStyle.perspectiveSelf >= 1) {
        const tfo = computedStyle.transformOrigin;
        pm = calPerspectiveMatrix(computedStyle.perspectiveSelf, tfo[0] - x, tfo[1] - y);
      }
      const transform = node2.transform;
      if (!isE(transform)) {
        const tfo = computedStyle.transformOrigin;
        const m = calMatrixByOrigin(transform, tfo[0] - x, tfo[1] - y);
        matrix = multiply(parent.tempMatrix, pm ? multiply(pm, m) : m);
      }
      else {
        matrix = parent.tempMatrix;
        if (pm) {
          matrix = multiply(matrix, pm);
        }
      }
    }
    assignMatrix(node2.tempMatrix, matrix);
    let target2 = node2.textureTarget;
    // 可能没生成，存在于一开始在可视范围外的节点情况，且当时也没有进行合成
    if (!target2?.available && node2.hasContent) {
      node2.genTexture(gl);
      target2 = node2.textureTarget;
    }
    if (target2 && target2.available) {
      const { mixBlendMode } = computedStyle;
      const list2 = target2.list;
      // 内循环目标分块
      for (let j = 0, len = listRect.length; j < len; j++) {
        const rect = listRect[j];
        const { x, y, w, h } = rect;
        let t = rect.t;
        const cx = w * 0.5,
          cy = h * 0.5;
        // 再循环当前target的分块
        for (let k = 0, len = list2.length; k < len; k++) {
          const { bbox: bbox2, t: t2, tc } = list2[k];
          if (t2 && checkInRect(bbox2, matrix, x, y, w, h)) {
            if (!t) {
              t = rect.t = createTexture(gl, 0, undefined, w, h);
            }
            if (frameBuffer) {
              gl.framebufferTexture2D(
                gl.FRAMEBUFFER,
                gl.COLOR_ATTACHMENT0,
                gl.TEXTURE_2D,
                t,
                0,
              );
              gl.viewport(0, 0, w, h);
            }
            else {
              frameBuffer = genFrameBufferWithTexture(gl, t, w, h);
            }
            let tex: WebGLTexture | undefined;
            // 有mbm先将本节点内容绘制到同尺寸纹理上
            if (mixBlendMode !== MIX_BLEND_MODE.NORMAL && i > index) {
              tex = createTexture(gl, 0, undefined, w, h);
              gl.framebufferTexture2D(
                gl.FRAMEBUFFER,
                gl.COLOR_ATTACHMENT0,
                gl.TEXTURE_2D,
                tex,
                0,
              );
            }
            // 有无mbm都复用这段逻辑
            drawTextureCache(
              gl,
              cx,
              cy,
              main,
              {
                opacity,
                matrix,
                bbox: bbox2,
                t: t2,
                tc,
                dx: -rect.x,
                dy: -rect.y,
              },
            );
            // texture2Blob(gl, w, h);
            // 这里才是真正生成mbm
            if (mixBlendMode !== MIX_BLEND_MODE.NORMAL && tex) {
              t = rect.t = genMbm(
                gl,
                t,
                tex,
                mixBlendMode,
                programs,
                w,
                h,
              );
            }
          }
        }
      }
    }
    // 有局部子树缓存可以跳过其所有子孙节点
    if (target2?.available && target2 !== node2.textureCache) {
      i += total2 + next2;
    }
  }
  // texture2Blob(gl, w, h);
  // 删除fbo恢复
  if (frameBuffer) {
    releaseFrameBuffer(gl, frameBuffer, W, H);
  }
  // 赋给结果，这样可能存在的空白区域无纹理
  listRect.forEach(item => {
    list.push({
      bbox: item.bbox,
      w: item.w,
      h: item.h,
      t: item.t!,
    });
  });
  return res;
}

function genFilter(
  gl: WebGL2RenderingContext | WebGLRenderingContext,
  root: Root,
  node: Node,
  W: number,
  H: number,
) {
  // 缓存仍然还在直接返回，无需重新生成
  if (node.textureFilter?.available) {
    return node.textureFilter;
  }
  let res: TextureCache | undefined;
  const filter = node.computedStyle.filter;
  const source = node.textureTarget!;
  filter.forEach(item => {
    if (item.u === StyleUnit.GAUSS_BLUR) {
      if (item.radius >= 1) {
        const t = genGaussBlur(gl, root, node, res || source, item.radius, W, H);
        if (res) {
          res.release();
        }
        res = t;
      }
    }
    else if (item.u === StyleUnit.RADIAL_BLUR) {
      if (item.radius >= 1) {
        const t = genRadialBlur(
          gl,
          root,
          node,
          res || source,
          item.radius,
          item.center,
          W,
          H,
        );
        if (res) {
          res.release();
        }
        res = t;
      }
    }
    else if (item.u === StyleUnit.MOTION_BLUR) {
      if (item.radius >= 1) {
        const t = genMotionBlur(
          gl,
          root,
          node,
          res || source,
          item.radius,
          item.angle, // 一定有，0兜底
          item.offset,
          W,
          H,
        );
        if (res) {
          res.release();
        }
        res = t;
      }
    }
    else if (item.u === StyleUnit.BLOOM) {
      if (item.threshold > 0) {
        const t = genBloom(
          gl,
          root,
          node,
          res || source,
          item.threshold,
          item.knee,
          W,
          H,
        );
        if (res) {
          res.release();
        }
        res = t;
      }
    }
    else if (item.u === StyleUnit.LIGHT_DARK) {
      const t = genLightDark(
        gl,
        root,
        node,
        res || source,
        item.radius,
        item.angle,
        W,
        H,
      );
      if (res) {
        res.release();
      }
      res = t;
    }
    else if (item.u === StyleUnit.HUE_ROTATE && item.radius % 360
      || item.u === StyleUnit.SATURATE && item.radius !== 1
      || item.u === StyleUnit.BRIGHTNESS && item.radius !== 1
      || item.u === StyleUnit.CONTRAST && item.radius !== 1
      || item.u === StyleUnit.SEPIA && item.radius > 0 && item.radius < 1
    ) {
      const t = genColorMatrix(
        gl,
        root,
        res || source,
        item.u === StyleUnit.HUE_ROTATE ? item.radius : 0,
        item.u === StyleUnit.SATURATE ? item.radius : 1,
        item.u === StyleUnit.BRIGHTNESS ? item.radius : 1,
        item.u === StyleUnit.CONTRAST ? item.radius : 1,
        item.u === StyleUnit.SEPIA ? item.radius : 0,
        W,
        H,
      );
      if (res) {
        res.release();
      }
      res = t;
    }
  });
  return res;
}

export function genMask(
  gl: WebGL2RenderingContext | WebGLRenderingContext,
  root: Root,
  node: Node,
  maskMode: MASK,
  structs: Struct[],
  index: number,
  lv: number,
  total: number,
  W: number,
  H: number,
) {
  // 缓存仍然还在直接返回，无需重新生成
  if (node.textureMask?.available || !node.hasContent) {
    return node.textureMask;
  }
  // 除非手动调用genMask，否则一定有
  if (!node.textureTarget?.available) {
    node.genTexture(gl);
  }
  const textureTarget = node.textureTarget!;
  // 可能是个单叶子节点，mask申明无效
  if (!node.next) {
    return textureTarget;
  }
  let listM = textureTarget.list;
  const programs = root.programs;
  CacheProgram.useProgram(gl, programs.main);
  // 创建一个空白纹理来绘制，尺寸由于bbox已包含整棵子树内容可以直接使用
  const bbox = textureTarget.bbox;
  const { computedStyle } = node;
  const x = bbox[0],
    y = bbox[1];
  const w = bbox[2] - x,
    h = bbox[3] - y;
  const summary = TextureCache.getEmptyInstance(gl, bbox);
  summary.available = true;
  const listS = summary.list;
  let frameBuffer: WebGLFramebuffer | undefined;
  const UNIT = config.maxTextureSize;
  // Bitmap/Video有个特点，纯图使用原始图尺寸生成纹理，它一般不和当前缩放匹配，需要多生成一个临时对应的纹理
  let genImgMask: TextureCache | undefined;
  if (needReGen(node, w, h)) {
    node.tempBbox = (node.tempBbox || node._rect || node.rect).slice(0);
    genImgMask = genTotal(gl, root, node, structs, index, total, W, H, true);
    listM = genImgMask!.list;
  }
  // 作为mask节点视作E，其左上角是原点，需统一origin即其它节点用本身的transform配合mask的origin算新的matrix，再算逆矩阵
  const im = inverse(node.matrix);
  for (let i = 0, len = Math.ceil(h / UNIT); i < len; i++) {
    for (let j = 0, len2 = Math.ceil(w / UNIT); j < len2; j++) {
      // 这里的逻辑和genTotal几乎一样
      const width = j === len2 - 1 ? (w - j * UNIT) : UNIT;
      const height = i === len - 1 ? (h - i * UNIT) : UNIT;
      const t = createTexture(gl, 0, undefined, width, height);
      const x0 = x + j * UNIT,
        y0 = y + i * UNIT;
      const bbox = new Float32Array([
        x0,
        y0,
        x0 + width,
        y0 + height,
      ]);
      const area = {
        bbox,
        w: width,
        h: height,
        t,
      };
      listS.push(area);
      const x1 = x + j * UNIT,
        y1 = y + i * UNIT;
      if (frameBuffer) {
        gl.framebufferTexture2D(
          gl.FRAMEBUFFER,
          gl.COLOR_ATTACHMENT0,
          gl.TEXTURE_2D,
          t,
          0,
        );
        gl.viewport(0, 0, width, height);
      }
      else {
        frameBuffer = genFrameBufferWithTexture(gl, t, width, height);
      }
      const cx = width * 0.5,
        cy = height * 0.5;
      // outline/alpha-with如果可见先将自身绘制在底层后再收集后续节点，因为其参与bgBlur效果
      if ([MASK.ALPHA_WITH, MASK.GRAY_WITH].includes(maskMode) && computedStyle.visibility === VISIBILITY.VISIBLE && computedStyle.opacity > 0 && textureTarget.available) {
        const index = i * len2 + j; // 和绘制对象完全对应，求出第几个区块即可，但img可能不是因为使用原始位图尺寸
        const t = listM[index]?.t;
        t && drawTextureCache(
          gl,
          cx,
          cy,
          programs.main,
          {
            opacity: 1,
            bbox: new Float32Array([0, 0, width, height]),
            t,
          },
        );
      }
      const isFirst = !i && !j;
      for (let i = index + total + 1, len = structs.length; i < len; i++) {
        const { node: node2, lv: lv2, total: total2, next: next2 } = structs[i];
        const computedStyle = node2.computedStyle;
        // mask只会影响next同层级以及其子节点，跳出后实现（比如group结束）
        if (lv > lv2) {
          node.struct.next = i - index - total - 1;
          break;
        }
        else if (i === len || ((computedStyle.breakMask || computedStyle.maskMode) && lv === lv2)) {
          node.struct.next = i - index - total - 1;
          break;
        }
        // 这里和主循环类似，不可见或透明考虑跳过，但mask和背景模糊特殊对待
        if (shouldIgnore(computedStyle)) {
          i += total2 + next2;
          continue;
        }
        let opacity: number,
          matrix: Float32Array;
        // 只计算1次
        if (isFirst) {
          // 同层级的next作为特殊的局部根节点，注意transformOrigin以及相对于mask的原点偏差
          if (lv === lv2) {
            opacity = node2.tempOpacity = computedStyle.opacity;
            matrix = multiply(im, node2.matrix);
          }
          else {
            const parent = node2.parent!;
            opacity = node2.tempOpacity = computedStyle.opacity * parent.tempOpacity;
            matrix = multiply(parent.tempMatrix, node2.matrix);
          }
          assignMatrix(node2.tempMatrix, matrix);
        }
        // 超过尺寸限制多块汇总时，后续直接用第一次的结果
        else {
          opacity = node2.tempOpacity;
          matrix = node2.tempMatrix;
        }
        // console.log(i, node2.name, node2.matrix.map(item => toPrecision(item)).join(','))
        // console.log(i, matrix.map(item => toPrecision(item)).join(','))
        let target2 = node2.textureTarget;
        // 可能没生成，存在于一开始在可视范围外的节点情况，且当时也没有进行合成
        if (!target2?.available && node2.hasContent) {
          node2.genTexture(gl);
          target2 = node2.textureTarget;
        }
        if (target2?.available) {
          const { mixBlendMode } = computedStyle;
          // 整个节点都不在当前块内跳过
          if (!checkInRect(target2.bbox, matrix, x1, y1, width, height)) {
            continue;
          }
          const list2 = target2.list;
          for (let j = 0, len2 = list2.length; j < len2; j++) {
            const { bbox: bbox2, t: t2 } = list2[j];
            if (t2 && checkInRect(bbox2, matrix, x1, y1, width, height)) {
              let tex: WebGLTexture | undefined;
              /**
               * 有mbm先将本节点内容绘制到同尺寸纹理上，注意sketch和psd的区别，
               * sketch即便是outline也不收集为底层，因此第0个summary不生效，第1个才生效，
               * psd的alpha-with作为底层，因此第0个summary生效
               */
              if (mixBlendMode !== MIX_BLEND_MODE.NORMAL
                && (
                  i > index + total + 1 && [MASK.OUTLINE, MASK.ALPHA, MASK.GRAY].includes(maskMode)
                  || i > index + total && [MASK.ALPHA_WITH, MASK.GRAY_WITH].includes(maskMode)
                )
              ) {
                tex = createTexture(gl, 0, undefined, width, height);
                if (frameBuffer) {
                  gl.framebufferTexture2D(
                    gl.FRAMEBUFFER,
                    gl.COLOR_ATTACHMENT0,
                    gl.TEXTURE_2D,
                    tex,
                    0,
                  );
                  gl.viewport(0, 0, width, height);
                }
                else {
                  frameBuffer = genFrameBufferWithTexture(gl, tex, width, height);
                }
              }
              // 有无mbm都复用这段逻辑
              drawTextureCache(
                gl,
                cx,
                cy,
                programs.main,
                {
                  opacity,
                  matrix,
                  bbox: bbox2,
                  t: t2,
                  dx: -x1,
                  dy: -y1,
                },
              );
              // 这里才是真正生成mbm
              if (mixBlendMode !== MIX_BLEND_MODE.NORMAL && tex) {
                area.t = genMbm(
                  gl,
                  area.t,
                  tex,
                  mixBlendMode,
                  programs,
                  width,
                  height,
                );
              }
            }
          }
        }
        // 有局部子树缓存可以跳过其所有子孙节点，特殊的shapeGroup是个bo运算组合，已考虑所有子节点的结果
        if (
          target2?.available && target2 !== node2.textureCache
          || computedStyle.maskMode
        ) {
          // 有种特殊情况，group没内容且没next，但children有内容，outline蒙版需要渲染出来
          if ([MASK.OUTLINE, MASK.ALPHA_WITH, MASK.GRAY_WITH].includes(computedStyle.maskMode)
            && (!node2.next || node2.next.computedStyle.breakMask)) {
          }
          else {
            i += total2 + next2;
          }
        }
      }
      // texture2Blob(gl, width, height, 's' + i + ',' + j);
    }
  }
  const res = TextureCache.getEmptyInstance(gl, bbox);
  res.available = true;
  const listR = res.list;
  // sketch没有灰度，但psd或其它有
  if (maskMode === MASK.GRAY || maskMode === MASK.GRAY_WITH) {
    CacheProgram.useProgram(gl, programs.maskGray);
    for (let i = 0, len = listS.length; i < len; i++) {
      const { bbox, w, h, t } = listS[i];
      let tex: WebGLTexture | undefined;
      if (listM[i] && listM[i].t && t) {
        tex = createTexture(gl, 0, undefined, w, h);
        if (frameBuffer) {
          gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D,
            tex,
            0,
          );
          gl.viewport(0, 0, w, h);
        }
        else {
          frameBuffer = genFrameBufferWithTexture(gl, tex, w, h);
        }
        listM[i] && listM[i].t && drawMask(gl, programs.maskGray, listM[i].t!, t!);
        // texture2Blob(gl, w, h, 'res' + i);
      }
      listR.push({
        bbox: bbox.slice(0),
        w,
        h,
        t: tex!,
      });
    }
  }
  // alpha/alpha-with
  else {
    CacheProgram.useProgram(gl, programs.mask);
    // alpha直接应用，汇总乘以mask本身的alpha即可，outline则用轮廓做为mask，其本身无alpha
    for (let i = 0, len = listS.length; i < len; i++) {
      const { bbox, w, h, t } = listS[i];
      const tex = createTexture(gl, 0, undefined, w, h);
      if (frameBuffer) {
        gl.framebufferTexture2D(
          gl.FRAMEBUFFER,
          gl.COLOR_ATTACHMENT0,
          gl.TEXTURE_2D,
          tex,
          0,
        );
        gl.viewport(0, 0, w, h);
      }
      else {
        frameBuffer = genFrameBufferWithTexture(gl, tex, w, h);
      }
      drawMask(gl, programs.mask, listM[i].t!, t!);
      // texture2Blob(gl, w, h);
      listR.push({
        bbox: bbox.slice(0),
        w,
        h,
        t: tex,
      });
    }
  }
  CacheProgram.useProgram(gl, programs.main);
  // 删除fbo恢复
  summary.release();
  genImgMask && genImgMask.release();
  if (frameBuffer) {
    releaseFrameBuffer(gl, frameBuffer, W, H);
  }
  else {
    gl.viewport(0, 0, W, H);
  }
  return res;
}

// 创建一个和画布一样大的纹理，将画布和即将mbm混合的节点作为输入，结果重新赋值给画布
function genMbm(
  gl: WebGL2RenderingContext | WebGLRenderingContext,
  tex1: WebGLTexture,
  tex2: WebGLTexture,
  mixBlendMode: MIX_BLEND_MODE,
  programs: Record<string, CacheProgram>,
  w: number,
  h: number,
) {
  // 获取对应的mbm程序
  let program: CacheProgram;
  if (mixBlendMode === MIX_BLEND_MODE.MULTIPLY) {
    program = programs.multiplyProgram;
  }
  else if (mixBlendMode === MIX_BLEND_MODE.SCREEN) {
    program = programs.screenProgram;
  }
  else if (mixBlendMode === MIX_BLEND_MODE.OVERLAY) {
    program = programs.overlayProgram;
  }
  else if (mixBlendMode === MIX_BLEND_MODE.DARKEN) {
    program = programs.darkenProgram;
  }
  else if (mixBlendMode === MIX_BLEND_MODE.LIGHTEN) {
    program = programs.lightenProgram;
  }
  else if (mixBlendMode === MIX_BLEND_MODE.COLOR_DODGE) {
    program = programs.colorDodgeProgram;
  }
  else if (mixBlendMode === MIX_BLEND_MODE.COLOR_BURN) {
    program = programs.colorBurnProgram;
  }
  else if (mixBlendMode === MIX_BLEND_MODE.HARD_LIGHT) {
    program = programs.hardLightProgram;
  }
  else if (mixBlendMode === MIX_BLEND_MODE.SOFT_LIGHT) {
    program = programs.softLightProgram;
  }
  else if (mixBlendMode === MIX_BLEND_MODE.DIFFERENCE) {
    program = programs.differenceProgram;
  }
  else if (mixBlendMode === MIX_BLEND_MODE.EXCLUSION) {
    program = programs.exclusionProgram;
  }
  else if (mixBlendMode === MIX_BLEND_MODE.HUE) {
    program = programs.hueProgram;
  }
  else if (mixBlendMode === MIX_BLEND_MODE.SATURATION) {
    program = programs.saturationProgram;
  }
  else if (mixBlendMode === MIX_BLEND_MODE.COLOR) {
    program = programs.colorProgram;
  }
  else if (mixBlendMode === MIX_BLEND_MODE.LUMINOSITY) {
    program = programs.luminosityProgram;
  }
  else {
    inject.error('Unknown mixBlendMode: ' + mixBlendMode);
    program = programs.program;
  }
  gl.useProgram(program);
  const res = createTexture(gl, 0, undefined, w, h);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    res,
    0,
  );
  drawMbm(gl, program, tex1, tex2);
  gl.deleteTexture(tex1);
  gl.deleteTexture(tex2);
  gl.useProgram(programs.program);
  return res;
}

function setValid(merge: Merge) {
  merge.valid = true;
  const subList = merge.subList;
  while (subList.length) {
    const t = subList.pop()!;
    t.valid = true;
    const subList2 = t.subList;
    while (subList2.length) {
      subList.push(subList2.pop()!);
    }
  }
}

export default {
  genTotal,
  genFilter,
  genMask(node: Node) {
    const { root, computedStyle, struct } = node;
    if (root && struct) {
      genMask(
        root.ctx as WebGL2RenderingContext | WebGLRenderingContext,
        root,
        node,
        computedStyle.maskMode,
        root.structs,
        root.structs.indexOf(struct),
        struct.lv,
        struct.total,
        root.width,
        root.height
      );
    }
  },
};
