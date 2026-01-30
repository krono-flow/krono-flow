import { createTexture, drawColorMatrix } from '../gl/webgl';
import { genFrameBufferWithTexture, releaseFrameBuffer } from './fb';
import TextureCache from './TextureCache';
import { assignMatrix, identity, multiply } from '../math/matrix';
import Node from '../node/Node';
import Root from '../node/Root';
import { d2r } from '../math/geom';
import CacheProgram from '../gl/CacheProgram';
import { drawInSpreadBbox, needReGen } from './spread';

// https://docs.rainmeter.net/tips/colormatrix-guide/
export function genColorMatrix(
  gl: WebGL2RenderingContext | WebGLRenderingContext,
  root: Root,
  node: Node,
  textureTarget: TextureCache,
  hueRotate: number,
  saturate: number,
  brightness: number,
  contrast: number,
  sepia: number,
  W: number,
  H: number,
) {
  const programs = root.programs;
  const main = programs.main;
  const cm = programs.cm;
  let res: TextureCache = textureTarget;
  let frameBuffer: WebGLFramebuffer | undefined;
  // console.log(hueRotate, saturate, brightness, contrast, sepia);
  if (hueRotate || saturate !== 1 || brightness !== 1 || contrast !== 1 || sepia !== 1) {
    let old = res;
    const bbox = textureTarget.bbox;
    const x = bbox[0],
      y = bbox[1];
    const w = bbox[2] - bbox[0],
      h = bbox[3] - bbox[1];
    // 可能需将共享源（共享位图）写入新的
    if (needReGen(node, w, h)) {
      old = TextureCache.getEmptyInstance(gl, bbox);
      old.available = true;
      drawInSpreadBbox(gl, main, textureTarget, res, x, y, w, h);
    }
    CacheProgram.useProgram(gl, cm);
    const rotation = d2r(hueRotate % 360);
    const cosR = Math.cos(rotation);
    const sinR = Math.sin(rotation);
    const mh = hueRotate ? new Float32Array([
      0.213 + cosR * 0.787 - sinR * 0.213, 0.715 - cosR * 0.715 - sinR * 0.715, 0.072 - cosR * 0.072 + sinR * 0.928, 0,
      0.213 - cosR * 0.213 + sinR * 0.143, 0.715 + cosR * 0.285 + sinR * 0.140, 0.072 - cosR * 0.072 - sinR * 0.283, 0,
      0.213 - cosR * 0.213 - sinR * 0.787, 0.715 - cosR * 0.715 + sinR * 0.715, 0.072 + cosR * 0.928 + sinR * 0.072, 0,
      0, 0, 0, 1,
    ]) : identity();
    const lr = 0.213;
    const lg = 0.715;
    const lb = 0.072;
    const sr = (1 - saturate) * lr;
    const sg = (1 - saturate) * lg;
    const sb = (1 - saturate) * lb;
    const ms = saturate !== 1 ? new Float32Array([
      sr + saturate, sg, sb, 0,
      sr, sg + saturate, sb, 0,
      sr, sg, sb + saturate, 0,
      0, 0, 0, 1,
    ]) : identity();
    const b = brightness - 1;
    const d = (1 - contrast) * 0.5;
    // 不是简单的mh * ms * mb * mc，第5行是加法（b+d），https://stackoverflow.com/questions/49796623/how-to-implement-a-color-matrix-filter-in-a-glsl-shader
    const m = multiply(mh, ms);
    if (contrast !== 1) {
      m[0] *= contrast;
      m[1] *= contrast;
      m[2] *= contrast;
      m[4] *= contrast;
      m[5] *= contrast;
      m[6] *= contrast;
      m[8] *= contrast;
      m[9] *= contrast;
      m[10] *= contrast;
    }
    if (sepia !== 1) {
      const amount = Math.min(1, Math.max(0, 1 - sepia));
      const m1 = new Float32Array([
        0.393 + 0.607 * amount, 0.769 - 0.769 * amount, 0.189 - 0.189 * amount, 0,
        0.349 - 0.349 * amount, 0.686 + 0.314 * amount, 0.168 - 0.168 * amount, 0,
        0.272 - 0.272 * amount, 0.534 - 0.534 * amount, 0.131 + 0.869 * amount, 0,
        0, 0, 0, 1,
      ]);
      const m2 = multiply(m, m1);
      assignMatrix(m, m2);
    }
    const t = genColorByMatrix(gl, cm, old, [
      m[0], m[1], m[2], m[3], b + d,
      m[4], m[5], m[6], m[7], b + d,
      m[8], m[9], m[10], m[11], b + d,
      0, 0, 0, 1,
    ], frameBuffer);
    res = t.res;
    frameBuffer = t.frameBuffer;
    if (old !== textureTarget) {
      old.release();
    }
  }
  CacheProgram.useProgram(gl, programs.main);
  if (frameBuffer) {
    releaseFrameBuffer(gl, frameBuffer, W, H);
    return res;
  }
  else {
    gl.viewport(0, 0, W, H);
  }
}

function genColorByMatrix(
  gl: WebGL2RenderingContext | WebGLRenderingContext,
  cacheProgram: CacheProgram,
  old: TextureCache,
  m: number[],
  frameBuffer?: WebGLFramebuffer,
) {
  const res = TextureCache.getEmptyInstance(gl, old.bbox);
  res.available = true;
  const list = old.list;
  const listR = res.list;
  for (let i = 0, len = list.length; i < len; i++) {
    const { bbox, w, h, t } = list[i];
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
    t && drawColorMatrix(gl, cacheProgram, t, m);
    listR.push({
      bbox: bbox.slice(0),
      w,
      h,
      t: tex,
    });
  }
  return { res, frameBuffer };
}
