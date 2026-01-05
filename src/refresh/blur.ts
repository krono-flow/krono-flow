import Root from '../node/Root';
import Node from '../node/Node';
import { boxesForGauss, gaussKernel, gaussSizeByD } from '../math/blur';
import TextureCache from './TextureCache';
import {
  drawBox,
  drawDual,
  drawMotion,
  drawRadial,
  drawTextureCache,
  // texture2Blob,
} from '../gl/webgl';
import { genFrameBufferWithTexture, releaseFrameBuffer } from './fb';
import { checkInRect } from './check';
import { d2r } from '../math/geom';
import CacheProgram from '../gl/CacheProgram';
import { createInOverlay, drawInOverlay, drawInSpreadBbox, needReGen } from './spread';

/**
 * https://www.w3.org/TR/2018/WD-filter-effects-1-20181218/#feGaussianBlurElement
 * 按照css规范的优化方法执行3次，避免卷积核d扩大3倍性能慢
 * 规范的优化方法对d的值分奇偶优化，这里再次简化，d一定是奇数，即卷积核大小
 * 先动态生成gl程序，根据sigma获得d（一定奇数，省略偶数情况），再计算权重
 * 然后将d尺寸和权重拼接成真正程序并编译成program，再开始绘制
 */
export function genGaussBlur(
  gl: WebGL2RenderingContext | WebGLRenderingContext,
  root: Root,
  node: Node,
  textureTarget: TextureCache,
  sigma: number,
  W: number,
  H: number,
  willSpread = false,
  willLimit = false,
) {
  const d = gaussKernel(sigma);
  const spread = willSpread ? gaussSizeByD(d) : 0;
  const bboxS = textureTarget.bbox;
  const bboxR = bboxS.slice(0);
  if (spread) {
    bboxR[0] -= spread;
    bboxR[1] -= spread;
    bboxR[2] += spread;
    bboxR[3] += spread;
  }
  // 写到一个扩展好尺寸的tex中方便后续处理
  const x = bboxR[0],
    y = bboxR[1];
  const w = bboxR[2] - bboxR[0],
    h = bboxR[3] - bboxR[1];
  const programs = root.programs;
  const main = programs.main;
  CacheProgram.useProgram(gl, main);
  let temp: TextureCache | undefined;
  if (spread || needReGen(node, w, h)) {
    temp = TextureCache.getEmptyInstance(gl, bboxR);
    temp.available = true;
  }
  const listT = temp ? temp.list: textureTarget.list;
  // 由于存在扩展，原本的位置全部偏移，需要重算
  const frameBuffer = temp
    ? drawInSpreadBbox(gl, main, textureTarget, temp, x, y, w, h)
    : genFrameBufferWithTexture(gl, textureTarget.list[0].t, w, h);
  const dualTimes = getDualTimesFromSigma(sigma);
  const boxes = boxesForGauss(sigma * Math.pow(0.5, dualTimes));
  // 生成模糊，先不考虑多块情况下的边界问题，各个块的边界各自为政
  const res = TextureCache.getEmptyInstance(gl, bboxR);
  res.available = true;
  const listR = res.list;
  for (let i = 0, len = listT.length; i < len; i++) {
    const { bbox, w, h, t } = listT[i];
    listR.push({
      bbox: bbox.slice(0),
      w,
      h,
      t: t && genScaleGaussBlur(gl, root, boxes, dualTimes, t, w, h),
    });
  }
  // texture2Blob(gl, w, h);
  // 如果有超过1个区块，相邻部位需重新提取出来进行模糊替换
  if (listT.length > 1) {
    const listO = createInOverlay(gl, res, x, y, w, h, spread);
    // 遍历这些相邻部分，先绘制原始图像
    for (let i = 0, len = listO.length; i < len; i++) {
      const item = listO[i];
      const { bbox, w, h, t } = item;
      CacheProgram.useProgram(gl, main);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        t,
        0,
      );
      gl.viewport(0, 0, w, h);
      const cx = w * 0.5,
        cy = h * 0.5;
      let hasDraw = false;
      // 用temp而非原始的，因为位图存在缩放，bbox会有误差
      for (let j = 0, len = listT.length; j < len; j++) {
        const { bbox: bbox2, t: t2 } = listT[j];
        const w2 = bbox2[2] - bbox2[0],
          h2 = bbox2[3] - bbox2[1];
        if (t2 && checkInRect(bbox, undefined, bbox2[0], bbox2[1], w2, h2)) {
          drawTextureCache(
            gl,
            cx,
            cy,
            main,
            {
              opacity: 1,
              bbox: bbox2,
              t: t2,
              dx: -bbox[0],
              dy: -bbox[1],
            },
          );
          hasDraw = true;
        }
      }
      // 一定会有，没有就是计算错了，这里预防下
      if (hasDraw) {
        item.t = genScaleGaussBlur(gl, root, boxes, dualTimes, t, w, h);
        gl.deleteTexture(t);
      }
    }
    // 所有相邻部分回填
    drawInOverlay(gl, main, res, listO, bboxR, spread);
  }
  // 删除fbo恢复
  temp && temp.release();
  CacheProgram.useProgram(gl, main);
  releaseFrameBuffer(gl, frameBuffer!, W, H);
  return res;
}

/**
 * 7*7高斯核则缩放0.5进行，即用dual先缩小一次，再一半的模糊，再dual放大
 * https://www.intel.com/content/www/us/en/developer/articles/technical/an-investigation-of-fast-real-time-gpu-based-image-blur-algorithms.html
 * 由于这里使用的是均值box模糊模拟，核大小和高斯模糊核不一样，最终算出当4px（无高清缩放）以上核才会需要
 * 17*17内核则缩放0.25，对应16px，规律是4^n，最大4次缩放
 */
function getDualTimesFromSigma(sigma: number) {
  let dualTimes = 0;
  if (sigma >= 256) {
    dualTimes = 4;
  }
  else if (sigma >= 64) {
    dualTimes = 3;
  }
  else if (sigma >= 16) {
    dualTimes = 2;
  }
  else if (sigma >= 4) {
    dualTimes = 1;
  }
  return dualTimes;
}

function genScaleGaussBlur(
  gl: WebGL2RenderingContext | WebGLRenderingContext,
  root: Root,
  boxes: number[],
  dualTimes: number,
  t: WebGLTexture,
  w: number,
  h: number,
) {
  const programs = root.programs;
  const box = programs.box;
  const dualDown = programs.dualDown;
  const dualUp = programs.dualUp;
  let w1 = w, h1 = h;
  let t2: WebGLTexture | undefined = undefined;
  if (dualTimes) {
    CacheProgram.useProgram(gl, dualDown);
    t2 = t;
    for (let i = 1; i <= dualTimes; i++) {
      const w2 = Math.ceil(w * Math.pow(0.5, i));
      const h2 = Math.ceil(h * Math.pow(0.5, i));
      gl.viewport(0, 0, w2, h2);
      const temp = t2;
      t2 = drawDual(gl, dualDown, temp, w1, h1, w2, h2);
      if (temp !== t) {
        gl.deleteTexture(temp);
      }
      w1 = w2;
      h1 = h2;
    }
  }
  // 无论是否缩小都复用box产生模糊
  CacheProgram.useProgram(gl, box);
  gl.viewport(0, 0, w1, h1);
  let tex = drawBox(gl, box, t2 || t, w1, h1, boxes);
  // 可能再放大dualTimes次
  if (dualTimes) {
    CacheProgram.useProgram(gl, dualUp);
    t2 = tex;
    for (let i = dualTimes - 1; i >= 0; i--) {
      const w2 = Math.ceil(w * Math.pow(0.5, i));
      const h2 = Math.ceil(h * Math.pow(0.5, i));
      gl.viewport(0, 0, w2, h2);
      const temp = t2;
      t2 = drawDual(gl, dualUp, temp, w1, h1, w2, h2);
      gl.deleteTexture(temp);
      w1 = w2;
      h1 = h2;
    }
    tex = t2;
  }
  gl.viewport(0, 0, w, h);
  CacheProgram.useProgram(gl, programs.main);
  // texture2Blob(gl, w, h);
  return tex;
}

export function genRadialBlur(
  gl: WebGL2RenderingContext | WebGLRenderingContext,
  root: Root,
  node: Node,
  textureTarget: TextureCache,
  sigma: number, // 采样距离
  center: [number, number], // 中心点
  W: number,
  H: number,
  willSpread = false,
  willLimit = false,
) {
  const bboxS = textureTarget.bbox;
  const d = gaussKernel(sigma);
  const spread = willSpread ? gaussSizeByD(d) : 0;
  const bboxR = bboxS.slice(0);
  // 根据center和shader算法得四周扩展，中心点和四边距离是向量长度r，spread*2/diagonal是扩展比例
  const w1 = bboxR[2] - bboxR[0],
    h1 = bboxR[3] - bboxR[1];
  const cx = center[0] * w1,
    cy = center[1] * h1;
  const diagonal = Math.sqrt(w1 * w1 + h1 * h1);
  const ratio = spread * 2 / diagonal;
  const left = Math.ceil(ratio * cx);
  const right = Math.ceil(ratio * (w1 - cx));
  const top = Math.ceil(ratio * cy);
  const bottom = Math.ceil(ratio * (h1 - cy));
  bboxR[0] -= left;
  bboxR[1] -= top;
  bboxR[2] += right;
  bboxR[3] += bottom;
  // 写到一个扩展好尺寸的tex中方便后续处理
  const x = bboxR[0],
    y = bboxR[1];
  const w = bboxR[2] - bboxR[0],
    h = bboxR[3] - bboxR[1];
  const programs = root.programs;
  const main = programs.main;
  let temp: TextureCache | undefined;
  if (spread || needReGen(node, w, h)) {
    temp = TextureCache.getEmptyInstance(gl, bboxR);
    temp.available = true;
  }
  const listT = temp ? temp.list : textureTarget.list;
  // 由于存在扩展，原本的位置全部偏移，需要重算
  const frameBuffer = temp
    ? drawInSpreadBbox(gl, main, textureTarget, temp, x, y, w, h)
    : genFrameBufferWithTexture(gl, textureTarget.list[0].t, w, h);
  // 生成模糊，先不考虑多块情况下的边界问题，各个块的边界各自为政
  const radial = programs.radial;
  CacheProgram.useProgram(gl, radial);
  const res = TextureCache.getEmptyInstance(gl, bboxR);
  res.available = true;
  const listR = res.list;
  const cx0 = cx + left,
    cy0 = cy + top;
  for (let i = 0, len = listT.length; i < len; i++) {
    const { bbox, w, h, t } = listT[i];
    gl.viewport(0, 0, w, h);
    const w2 = bbox[2] - bbox[0],
      h2 = bbox[3] - bbox[1];
    const center2 = [
      (cx0 - bbox[0] + bboxR[0]) / w2,
      (cy0 - bbox[1] + bboxR[1]) / h2,
    ] as [number, number];
    const tex = t && drawRadial(gl, radial, t, ratio, spread, center2, w, h);
    listR.push({
      bbox: bbox.slice(0),
      w,
      h,
      t: tex,
    });
  }
  // 如果有超过1个区块，相邻部位需重新提取出来进行模糊替换
  if (listT.length > 1) {
    const listO = createInOverlay(gl, res, x, y, w, h, spread);
    for (let i = 0, len = listO.length; i < len; i++) {
      const item = listO[i];
      const { bbox, w, h, t } = item;
      CacheProgram.useProgram(gl, main);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        t,
        0,
      );
      gl.viewport(0, 0, w, h);
      const center2 = [
        (cx0 - bbox[0] + bboxR[0]) / (bbox[2] - bbox[0]),
        (cy0 - bbox[1] + bboxR[0]) / (bbox[3] - bbox[1]),
      ] as [number, number];
      const cx = w * 0.5,
        cy = h * 0.5;
      let hasDraw = false;
      // 用temp而非原始的，因为位图存在缩放，bbox会有误差
      for (let j = 0, len = listT.length; j < len; j++) {
        const { bbox: bbox2, t: t2 } = listT[j];
        const w2 = bbox2[2] - bbox2[0],
          h2 = bbox2[3] - bbox2[1];
        if (t2 && checkInRect(bbox, undefined, bbox2[0], bbox2[1], w2, h2)) {
          drawTextureCache(
            gl,
            cx,
            cy,
            main,
            {
              opacity: 1,
              bbox: new Float32Array([
                bbox2[0],
                bbox2[1],
                bbox2[2],
                bbox2[3],
              ]),
              t: t2,
              dx: -bbox[0],
              dy: -bbox[1],
            },
          );
          hasDraw = true;
        }
      }
      if (hasDraw) {
        CacheProgram.useProgram(gl, radial);
        item.t = drawRadial(gl, radial, t, ratio, spread, center2, w, h);
      }
      gl.deleteTexture(t);
    }
    drawInOverlay(gl, main, res, listO, bboxR, spread);
  }
  // 删除fbo恢复
  temp && temp.release();
  CacheProgram.useProgram(gl, main);
  releaseFrameBuffer(gl, frameBuffer, W, H);
  return res;
}

/**
 * 原理：https://zhuanlan.zhihu.com/p/125744132
 * 源码借鉴pixi：https://github.com/pixijs/filters
 */
export function genMotionBlur(
  gl: WebGL2RenderingContext | WebGLRenderingContext,
  root: Root,
  node: Node,
  textureTarget: TextureCache,
  sigma: number,
  angle: number,
  offset: number,
  W: number,
  H: number,
  willSpread = false,
  willLimit = false,
) {
  const radian = d2r(angle);
  const spread = willSpread ? sigma * 3 : 0;
  const kernel = sigma; // 两个方向均分
  const bboxS = textureTarget.bbox;
  const bboxR = bboxS.slice(0);
  // 运动模糊水平垂直增加尺寸三角函数计算
  if (spread) {
    const sin = Math.sin(radian);
    const cos = Math.cos(radian);
    const spreadY = Math.abs(Math.ceil(sin * spread));
    const spreadX = Math.abs(Math.ceil(cos * spread));
    bboxR[0] -= spreadX;
    bboxR[1] -= spreadY;
    bboxR[2] += spreadX;
    bboxR[3] += spreadY;
  }
  // 写到一个扩展好尺寸的tex中方便后续处理
  const x = bboxR[0],
    y = bboxR[1];
  const w = bboxR[2] - bboxR[0],
    h = bboxR[3] - bboxR[1];
  const programs = root.programs;
  const main = programs.main;
  let temp: TextureCache | undefined;
  if (spread || needReGen(node, w, h)) {
    temp = TextureCache.getEmptyInstance(gl, bboxR);
    temp.available = true;
  }
  const listT = temp ? temp.list : textureTarget.list;
  // 由于存在扩展，原本的位置全部偏移，需要重算，不扩展使用原本的
  const frameBuffer = temp
    ? drawInSpreadBbox(gl, main, textureTarget, temp, x, y, w, h)
    : genFrameBufferWithTexture(gl, textureTarget.list[0].t, w, h);
  // 迭代运动模糊，先不考虑多块情况下的边界问题，各个块的边界各自为政
  const motion = programs.motion;
  CacheProgram.useProgram(gl, motion);
  const res = TextureCache.getEmptyInstance(gl, bboxR);
  res.available = true;
  const listR = res.list;
  for (let i = 0, len = listT.length; i < len; i++) {
    const { bbox, w, h, t } = listT[i];
    gl.viewport(0, 0, w, h);
    const tex = t && drawMotion(gl, motion, t, kernel, radian, offset, w, h, willLimit);
    listR.push({
      bbox: bbox.slice(0),
      w,
      h,
      t: tex,
    });
  }
  // 如果有超过1个区块，相邻部位需重新提取出来进行模糊替换
  if (listT.length > 1) {
    const listO = createInOverlay(gl, res, x, y, w, h, spread);
    for (let i = 0, len = listO.length; i < len; i++) {
      const item = listO[i];
      const { bbox, w, h, t } = item;
      CacheProgram.useProgram(gl, main);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        t,
        0,
      );
      gl.viewport(0, 0, w, h);
      const cx = w * 0.5,
        cy = h * 0.5;
      let hasDraw = false;
      // 用temp而非原始的，因为位图存在缩放，bbox会有误差
      for (let j = 0, len = listT.length; j < len; j++) {
        const { bbox: bbox2, t: t2 } = listT[j];
        const w2 = bbox2[2] - bbox2[0],
          h2 = bbox2[3] - bbox2[1];
        if (t2 && checkInRect(bbox, undefined, bbox2[0], bbox2[1], w2, h2)) {
          drawTextureCache(
            gl,
            cx,
            cy,
            main,
            {
              opacity: 1,
              bbox: bbox2,
              t: t2,
              dx: -bbox[0],
              dy: -bbox[1],
            },
          );
          hasDraw = true;
        }
      }
      if (hasDraw) {
        CacheProgram.useProgram(gl, motion);
        item.t = drawMotion(gl, motion, t, kernel, radian, offset, w, h, willLimit);
      }
      gl.deleteTexture(t);
    }
    drawInOverlay(gl, main, res, listO, bboxR, spread);
  }
  // 删除fbo恢复
  temp && temp.release();
  CacheProgram.useProgram(gl, main);
  releaseFrameBuffer(gl, frameBuffer, W, H);
  return res;
}
