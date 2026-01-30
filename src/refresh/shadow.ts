import Root from '../node/Root';
import Node from '../node/Node';
import TextureCache from './TextureCache';
import { createTexture, drawDropShadow, drawTextureCache } from '../gl/webgl';
import { genFrameBufferWithTexture, releaseFrameBuffer } from './fb';
import CacheProgram from '../gl/CacheProgram';
import { genGaussBlur } from './blur';
import { checkInRect } from './check';
import config from '../config';

export function genShadow(
  gl: WebGL2RenderingContext | WebGLRenderingContext,
  root: Root,
  node: Node,
  textureTarget: TextureCache,
  x: number,
  y: number,
  blur: number,
  color: number[],
  W: number,
  H: number,
) {
  if (color[3] <= 0) {
    return textureTarget;
  }
  const programs = root.programs;
  const main = programs.main;
  const dropShadow = programs.dropShadow;
  const listT = textureTarget.list;
  const bboxS = textureTarget.bbox;
  const bboxR = bboxS.slice(0);
  const res = TextureCache.getEmptyInstance(gl, bboxR);
  res.available = true;
  let frameBuffer: WebGLFramebuffer | undefined;
  const listR = res.list;
  for (let i = 0, len = listT.length; i < len; i++) {
    const { bbox, w, h, t } = listT[i];
    const tex = createTexture(gl, 0, undefined, w, h);
    CacheProgram.useProgram(gl, dropShadow);
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
    t && drawDropShadow(gl, programs.dropShadow, t, color);
    // 最简单原地覆盖
    if (!x && !y && !blur) {
      const cx = (bbox[2] - bbox[0]) * 0.5;
      const cy = (bbox[3] - bbox[1]) * 0.5;
      CacheProgram.useProgram(gl, main);
      drawTextureCache(
        gl,
        cx,
        cy,
        main,
        {
          opacity: 1,
          bbox,
          t: listT[i].t,
          dx: -bboxR[0],
          dy: -bboxR[1],
        },
      );
    }
    listR.push({
      bbox: bbox.slice(0),
      w,
      h,
      t: tex,
    });
  }
  releaseFrameBuffer(gl, frameBuffer!, W, H);
  CacheProgram.useProgram(gl, main);
  let b: TextureCache | undefined;
  // 复用gauss模糊，因为一定有值，所以肯定会扩充尺寸，不必担心共享位图
  if (blur && blur >= 1) {
    b = genGaussBlur(gl, root, node, res, blur, W, H);
  }
  frameBuffer = undefined;
  // 有偏移需整个重绘，blur一定会扩大
  if (b || x || y) {
    const bboxR2 = b ? b.bbox.slice(0) : bboxR.slice(0);
    bboxR2[0] = Math.min(bboxR2[0], bboxR2[0] + x);
    bboxR2[1] = Math.min(bboxR2[1], bboxR2[0] + y);
    bboxR2[2] = Math.max(bboxR2[2], bboxR2[0] + x);
    bboxR2[3] = Math.max(bboxR2[3], bboxR2[0] + y);
    const res2 = TextureCache.getEmptyInstance(gl, bboxR2);
    res2.available = true;
    const list2 = res2.list;
    const x2 = bboxR2[0];
    const y2 = bboxR2[1];
    const w2 = bboxR2[2] - x2;
    const h2 = bboxR2[3] - y2;
    const UNIT = config.maxTextureSize;
    for (let i = 0, len = Math.ceil(h2 / UNIT); i < len; i++) {
      for (let j = 0, len2 = Math.ceil(w2 / UNIT); j < len2; j++) {
        const width = j === len2 - 1 ? (w2 - j * UNIT) : UNIT;
        const height = i === len - 1 ? (h2 - i * UNIT) : UNIT;
        const t = createTexture(gl, 0, undefined, width, height);
        const x0 = x2 + j * UNIT,
          y0 = y2 + i * UNIT;
        const bbox2 = new Float32Array([
          x0,
          y0,
          x0 + width,
          y0 + height,
        ]);
        const area = {
          bbox: bbox2,
          w: width,
          h: height,
          t,
        };
        list2.push(area);
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
        if (b) {
          for (let i = 0, len = b.list.length; i < len; i++) {
            const { bbox, t } = b.list[i];
            if (t && checkInRect(bbox, undefined, x0, y0, width, height)) {
              drawTextureCache(
                gl,
                cx,
                cy,
                main,
                {
                  opacity: 1,
                  bbox,
                  t,
                  dx: -x0 + bboxR[0] + x,
                  dy: -y0 + bboxR[1] + y,
                },
              );
            }
          }
        }
        else {
          for (let i = 0, len = listR.length; i < len; i++) {
            const { bbox, t } = listR[i];
            if (t && checkInRect(bbox, undefined, x0, y0, width, height)) {
              drawTextureCache(
                gl,
                cx,
                cy,
                main,
                {
                  opacity: 1,
                  bbox,
                  t,
                  dx: -x0 + bboxR[0] + x,
                  dy: -y0 + bboxR[0] + y,
                },
              );
            }
          }
        }
        for (let i = 0, len = listT.length; i < len; i++) {
          const { bbox, t } = listT[i];
          if (t && checkInRect(bbox, undefined, x0, y0, width, height)) {
            drawTextureCache(
              gl,
              cx,
              cy,
              main,
              {
                opacity: 1,
                bbox,
                t,
                dx: -x0 + bboxS[0],
                dy: -y0 + bboxS[1],
              },
            );
          }
        }
      }
    }
    if (b) {
      b.release();
    }
    res.release();
    releaseFrameBuffer(gl, frameBuffer!, W, H);
    return res2;
  }
  return res;
}
