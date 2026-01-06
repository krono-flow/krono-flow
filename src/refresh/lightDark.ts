import Root from '../node/Root';
import Node from '../node/Node';
import TextureCache from './TextureCache';
import { createInOverlay, drawInSpreadBbox, needReGen } from './spread';
import { genFrameBufferWithTexture, releaseFrameBuffer } from './fb';
import CacheProgram from '../gl/CacheProgram';
import { d2r } from '../math/geom';
import { createTexture, drawLightDark, drawTextureCache } from '../gl/webgl';
import { checkInRect } from './check';

export function genLightDark(
  gl: WebGL2RenderingContext | WebGLRenderingContext,
  root: Root,
  node: Node,
  textureTarget: TextureCache,
  radius: number,
  angle: number,
  W: number,
  H: number,
) {
  const radian = d2r(angle);
  const bboxS = textureTarget.bbox;
  const bboxR = bboxS.slice(0);
  // 写到一个扩展好尺寸的tex中方便后续处理
  const x = bboxR[0],
    y = bboxR[1];
  const w = bboxR[2] - bboxR[0],
    h = bboxR[3] - bboxR[1];
  const programs = root.programs;
  const main = programs.main;
  let temp: TextureCache | undefined;
  if (needReGen(node, w, h)) {
    temp = TextureCache.getEmptyInstance(gl, bboxR);
    temp.available = true;
  }
  const listT = temp ? temp.list : textureTarget.list;
  // 由于存在扩展，原本的位置全部偏移，需要重算，不扩展使用原本的
  const frameBuffer = temp
    ? drawInSpreadBbox(gl, main, textureTarget, temp, x, y, w, h)
    : genFrameBufferWithTexture(gl, textureTarget.list[0].t, w, h);
  const lightDark = programs.lightDark;
  CacheProgram.useProgram(gl, lightDark);
  const res = TextureCache.getEmptyInstance(gl, bboxR);
  res.available = true;
  const listR = res.list;
  for (let i = 0, len = listT.length; i < len; i++) {
    const { bbox, w, h, t } = listT[i];
    const tex = createTexture(gl, 0, undefined, w, h);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      tex,
      0,
    );
    gl.viewport(0, 0, w, h);
    drawLightDark(gl, lightDark, t, radius, radian, w, h);
    listR.push({
      bbox: bbox.slice(0),
      w,
      h,
      t: tex,
    });
  }
  // 如果有超过1个区块，相邻部位需重新提取出来进行替换
  if (listT.length > 1) {
    const listO = createInOverlay(gl, res, x, y, w, h);
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
        const tex = createTexture(gl, 0, undefined, w, h);
        gl.framebufferTexture2D(
          gl.FRAMEBUFFER,
          gl.COLOR_ATTACHMENT0,
          gl.TEXTURE_2D,
          tex,
          0,
        );
        gl.viewport(0, 0, w, h);
        drawLightDark(gl, lightDark, t, radius, radian, w, h);
        item.t = tex;
        gl.deleteTexture(t);
      }
    }
  }
  CacheProgram.useProgram(gl, main);
  gl.viewport(0, 0, W, H);
  temp && temp.release();
  releaseFrameBuffer(gl, frameBuffer!);
  return res;
}
