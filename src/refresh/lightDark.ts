import Root from '../node/Root';
import Node from '../node/Node';
import TextureCache from './TextureCache';
import { drawInSpreadBbox, needReGen } from './spread';
import { genFrameBufferWithTexture, releaseFrameBuffer } from './fb';
import CacheProgram from '../gl/CacheProgram';
import { d2r } from '../math/geom';
import { createTexture, drawLightDark } from '../gl/webgl';

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
  if (listT.length > 1) {}
  CacheProgram.useProgram(gl, main);
  gl.viewport(0, 0, W, H);
  temp && temp.release();
  releaseFrameBuffer(gl, frameBuffer!);
  return res;
}
