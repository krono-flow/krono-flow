import Root from '../node/Root';
import Node from '../node/Node';
import TextureCache from './TextureCache';
import { drawInSpreadBbox, needReGen } from './spread';
import { genFrameBufferWithTexture, releaseFrameBuffer } from './fb';
import CacheProgram from '../gl/CacheProgram';
import { createTexture, drawBloom, drawBloomBlur, drawDualDown13, drawDualUp13 } from '../gl/webgl';

export function genBloom(
  gl: WebGL2RenderingContext | WebGLRenderingContext,
  root: Root,
  node: Node,
  textureTarget: TextureCache,
  threshold: number,
  knee: number,
  W: number,
  H: number,
) {
  const bboxS = textureTarget.bbox;
  const bboxR = bboxS.slice(0);
  // 写到一个扩展好尺寸的tex中方便后续处理，即便没有扩展，也需要求出亮度区域
  const x = bboxR[0],
    y = bboxR[1];
  const w = bboxR[2] - bboxR[0],
    h = bboxR[3] - bboxR[1];
  const programs = root.programs;
  const { bloom, bloomBlur, main } = programs;
  CacheProgram.useProgram(gl, main);
  let temp: TextureCache | undefined;
  const reGen = needReGen(node, w, h);
  if (reGen) {
    temp = TextureCache.getEmptyInstance(gl, bboxR);
    temp.available = true;
  }
  // 由于存在扩展，原本的位置全部偏移，需要重算
  const frameBuffer = temp
    ? drawInSpreadBbox(gl, main, textureTarget, temp, x, y, w, h)
    : genFrameBufferWithTexture(gl, textureTarget.list[0].t, w, h);
  // 计算亮度，如有扩展之类用扩展，否则使用原始的
  const luma = TextureCache.getEmptyInstance(gl, bboxR);
  luma.available = true;
  CacheProgram.useProgram(gl, bloomBlur);
  genThreshold(gl, bloomBlur, temp || textureTarget, luma, threshold, knee);
  // 类似高斯模糊，进行降采样，最多4次，然后升采样过程中每层叠加，使得中心辉光效果比边缘更加明显
  let size = Math.min(w, h);
  let dualTimes = 0;
  while (size >= 8) {
    dualTimes++;
    size = size >> 1;
    if (dualTimes >= 4) {
      break;
    }
  }
  const dual = TextureCache.getEmptyInstance(gl, bboxR);
  dual.available = true;
  dual.list = genScale(gl, root, luma, dual, dualTimes);
  luma.release();
  // 叠加到原图上去
  CacheProgram.useProgram(gl, bloom);
  const res = TextureCache.getEmptyInstance(gl, bboxR);
  res.available = true;
  const listS = temp ? temp.list : textureTarget.list;
  gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
  dual.list.forEach((item, i) => {
    const { w, h, t, bbox } = item;
    const tex = createTexture(gl, 0, undefined, w, h);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      tex,
      0,
    );
    gl.viewport(0, 0, w, h);
    drawBloom(gl, bloom, listS[i].t, t);
    res.list.push({
      bbox: bbox.slice(0),
      w,
      h,
      t: tex,
    });
  });
  CacheProgram.useProgram(gl, main);
  gl.viewport(0, 0, W, H);
  temp && temp.release();
  dual && dual.release();
  releaseFrameBuffer(gl, frameBuffer!);
  return res;
}

function genThreshold(
  gl: WebGLRenderingContext | WebGL2RenderingContext,
  cacheProgram: CacheProgram,
  textureTarget: TextureCache,
  temp: TextureCache,
  threshold: number,
  knee: number,
) {
  const listS = textureTarget.list;
  const listT = temp.list;
  let frameBuffer: WebGLFramebuffer | undefined;
  listS.forEach((item) => {
    const { t, w, h, bbox } = item;
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
    drawBloomBlur(gl, cacheProgram, t, threshold, knee);
    listT.push({
      bbox: bbox.slice(0),
      t: tex,
      w,
      h,
    });
  });
  releaseFrameBuffer(gl, frameBuffer!);
}

function genScale(
  gl: WebGLRenderingContext | WebGL2RenderingContext,
  root: Root,
  textureTarget: TextureCache,
  temp: TextureCache,
  dualTimes: number,
) {
  const listS = textureTarget.list;
  const listT = temp.list;
  const programs = root.programs;
  const { dualDown13, dualUp13 } = programs;
  CacheProgram.useProgram(gl, dualDown13);
  // listS本身是个列表（大部分情况只有1个），缩放多次是个二维列表，可能有奇数存在，向下取整记录w/h
  const downList: { w: number, h: number, t: WebGLTexture }[][] = [];
  let frameBuffer: WebGLFramebuffer | undefined;
  // 向下缩小过程，13-tap
  for (let i = 0; i < dualTimes; i++) {
    const arr: { w: number, h: number, t: WebGLTexture }[] = [];
    listS.forEach(item => {
      const { t, w, h } = item;
      const w2 = w >> (i + 1);
      const h2 = h >> (i + 1);
      const tex = createTexture(gl, 0, undefined, w2, h2);
      const temp = { w: w >> i, h: h >> i, t: tex };
      if (frameBuffer) {
        gl.framebufferTexture2D(
          gl.FRAMEBUFFER,
          gl.COLOR_ATTACHMENT0,
          gl.TEXTURE_2D,
          tex,
          0,
        );
        gl.viewport(0, 0, w2, h2);
      }
      else {
        frameBuffer = genFrameBufferWithTexture(gl, tex, w2, h2);
      }
      drawDualDown13(gl, dualDown13, t, w2, h2);
      arr.push(temp);
    });
    downList.push(arr);
  }
  // 向上还原用简单的3*3帐篷，并简单加法叠加混合上一级
  CacheProgram.useProgram(gl, dualUp13);
  for (let i = dualTimes - 1; i >= 0; i--) {
    downList[i].forEach((item, j) => {
      const { t, w, h } = item;
      const tex = createTexture(gl, 0, undefined, w, h);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        tex,
        0,
      );
      if (i) {
        gl.viewport(0, 0, w, h);
      }
      else {
        gl.viewport(0, 0, listS[j].w, listS[j].h);
      }
      const tex1 = i ? downList[i - 1][j].t : listS[j].t;
      drawDualUp13(gl, dualUp13, tex1, t, w, h);
      // 把结果替换到上一级并作为下次输入，最上级特殊处理作为最终结果
      gl.deleteTexture(downList[i][j].t);
      if (i) {
        gl.deleteTexture(downList[i - 1][j].t);
        downList[i - 1][j].t = tex;
      }
      else {
        listT[j] = {
          bbox: listS[j].bbox.slice(0),
          w: listS[j].w,
          h: listS[j].h,
          t: tex,
        };
      }
    });
  }
  releaseFrameBuffer(gl, frameBuffer!);
  return listT;
}
