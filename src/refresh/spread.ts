import TextureCache from './TextureCache';
import config from '../config';
import { createTexture, drawTextureCache } from '../gl/webgl';
import CacheProgram from '../gl/CacheProgram';
import { genFrameBufferWithTexture } from './fb';
import { checkInRect } from './check';
import Video from '../node/Video';
import Bitmap from '../node/Bitmap';
import Node from '../node/Node';

export function createInOverlay(
  gl: WebGLRenderingContext | WebGL2RenderingContext,
  res: TextureCache,
  x: number,
  y: number,
  w: number,
  h: number,
  spread = 0, // 不考虑scale
) {
  const UNIT = config.maxTextureSize;
  const unit = UNIT - spread * 2; // 去除spread的单位
  const listO: {
    bbox: Float32Array,
    w: number, h: number,
    x1: number, y1: number, x2: number, y2: number, // 中间覆盖渲染的部分
    t: WebGLTexture,
  }[] = [];
  const bboxR = res.bbox;
  const w2 = w,
    h2 = h;
  // 左右2个之间的交界处需要重新blur的，宽度是spread*4，中间一半是需要的，上下则UNIT各缩spread到unit
  for (let i = 0, len = Math.ceil(h2 / unit); i < len; i++) {
    for (let j = 1, len2 = Math.ceil(w2 / UNIT); j < len2; j++) {
      let x1 = Math.max(bboxR[0], x + j * UNIT - spread * 2),
        y1 = Math.max(bboxR[1], y + i * unit - spread);
      let x2 = Math.min(bboxR[2], x1 + spread * 4),
        y2 = Math.min(bboxR[3], y1 + unit + spread * 2);
      const bbox = new Float32Array([x1, y1, x2, y2]);
      if (x1 > bboxR[2] - spread * 2) {
        x1 = bbox[0] = Math.max(bboxR[0], bboxR[2] - spread * 2);
        x2 = bbox[2] = bboxR[2];
      }
      if (y1 > bboxR[3] - spread * 2) {
        y1 = bbox[1] = Math.max(bboxR[1], bboxR[3] - spread * 2);
        y2 = bbox[3] = bboxR[3];
      }
      // 边界处假如尺寸不够，要往回（左上）收缩，避免比如最下方很细的长条（高度不足spread）
      const w = (bbox[2] - bbox[0]),
        h = (bbox[3] - bbox[1]);
      listO.push({
        bbox,
        w,
        h,
        t: createTexture(gl, 0, undefined, w, h),
        x1: Math.max(bboxR[0], x1 + spread),
        y1: Math.max(bboxR[1], i ? (y1 + spread) : y1),
        x2: Math.min(bboxR[2], x2 - spread),
        y2: Math.min(bboxR[3], (i === len - 1) ? y2 : (y1 + unit + spread)),
      });
    }
  }
  // 上下2个之间的交界处需要重新blur的，高度是spread*4，中间一半是需要的，左右则UNIT各缩spread到unit
  for (let i = 1, len = Math.ceil(h2 / UNIT); i < len; i++) {
    for (let j = 0, len2 = Math.ceil(w2 / unit); j < len2; j++) {
      let x1 = Math.max(bboxR[0], x + j * unit - spread),
        y1 = Math.max(bboxR[1], y + i * UNIT - spread * 2);
      let x2 = Math.min(bboxR[2], x1 + unit + spread * 2),
        y2 = Math.min(bboxR[3], y1 + spread * 4);
      const bbox = new Float32Array([x1, y1, x2, y2]);
      if (x1 > bboxR[2] - spread * 2) {
        x1 = bbox[0] = Math.max(bboxR[0], bboxR[2] - spread * 2);
        x2 = bbox[2] = bboxR[2];
      }
      if (y1 > bboxR[3] - spread * 2) {
        y1 = bbox[1] = Math.max(bboxR[1], bboxR[3] - spread * 2);
        y2 = bbox[3] = bboxR[3];
      }
      const w = (bbox[2] - bbox[0]),
        h = (bbox[3] - bbox[1]);
      listO.push({
        bbox,
        w,
        h,
        t: createTexture(gl, 0, undefined, w, h),
        x1: Math.max(bboxR[0], j ? (x1 + spread) : x1),
        y1: Math.max(bboxR[1], y1 + spread),
        x2: Math.min(bboxR[2], (j === len2 - 1) ? x2 : (x1 + unit + spread)),
        y2: Math.min(bboxR[3], y2 - spread),
      });
    }
  }
  return listO;
}

// 将交界处单独生成的模糊覆盖掉原本区块模糊的边界
export function drawInOverlay(
  gl: WebGLRenderingContext | WebGL2RenderingContext,
  cacheProgram: CacheProgram,
  res: TextureCache,
  listO: {
    bbox: Float32Array,
    w: number, h: number,
    x1: number, y1: number, x2: number, y2: number,
    t: WebGLTexture,
  }[],
  bboxR: Float32Array,
  spread: number,
) {
  CacheProgram.useProgram(gl, cacheProgram);
  gl.blendFunc(gl.ONE, gl.ZERO);
  const listR = res.list;
  for (let i = 0, len = listR.length; i < len; i++) {
    const item = listR[i];
    const { bbox, w, h, t } = item;
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      t!,
      0,
    );
    gl.viewport(0, 0, w, h);
    const cx = w * 0.5,
      cy = h * 0.5;
    for (let j = 0, len = listO.length; j < len; j++) {
      const { bbox: bbox2, w: w2, h: h2, t: t2 } = listO[j];
      const bbox3 = bbox2.slice(0);
      // 中间一块儿区域，但是如果是原始图形边界处，不应该取边界
      if (bbox3[0] !== bboxR[0]) {
        bbox3[0] += spread;
      }
      if (bbox3[1] !== bboxR[1]) {
        bbox3[1] += spread;
      }
      if (bbox3[2] !== bboxR[2]) {
        bbox3[2] -= spread;
      }
      if (bbox3[3] !== bboxR[3]) {
        bbox3[3] -= spread;
      }
      const w3 = bbox3[2] - bbox3[0],
        h3 = bbox3[3] - bbox3[1];
      if (checkInRect(bbox, undefined, bbox3[0], bbox3[1], w3, h3)) {
        drawTextureCache(
          gl,
          cx,
          cy,
          cacheProgram,
          {
            opacity: 1,
            bbox: bbox3,
            t: t2,
            tc: {
              x1: (bbox3[0] === bboxR[0] ? 0 : spread) / w2,
              y1: (bbox3[1] === bboxR[1] ? 0 : spread) / h2,
              x3: (bbox3[2] === bboxR[2] ? w2 : (w2 - spread)) / w2,
              y3: (bbox3[3] === bboxR[3] ? h2 : (h2 - spread)) / h2,
            },
            dx: -bbox[0],
            dy: -bbox[1],
          },
        );
      }
    }
  }
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  listO.forEach(item => gl.deleteTexture(item.t));
}

// 因为blur原因，原本内容先绘入一个更大尺寸的fbo中
export function drawInSpreadBbox(
  gl: WebGLRenderingContext | WebGL2RenderingContext,
  cacheProgram: CacheProgram,
  textureTarget: TextureCache,
  temp: TextureCache,
  x: number, y: number,
  w2: number, h2: number,
) {
  const UNIT = config.maxTextureSize;
  const listS = textureTarget.list;
  const listT = temp.list;
  let frameBuffer: WebGLFramebuffer | undefined;
  for (let i = 0, len = Math.ceil(h2 / UNIT); i < len; i++) {
    for (let j = 0, len2 = Math.ceil(w2 / UNIT); j < len2; j++) {
      const width = j === len2 - 1 ? (w2 - j * UNIT) : UNIT;
      const height = i === len - 1 ? (h2 - i * UNIT) : UNIT;
      const t = createTexture(gl, 0, undefined, width, height);
      const x0 = x + j * UNIT,
        y0 = y + i * UNIT;
      const w0 = width,
        h0 = height;
      const bbox = new Float32Array([
        x0,
        y0,
        x0 + w0,
        y0 + h0,
      ]);
      const area = {
        bbox,
        w: width,
        h: height,
        t,
      };
      listT.push(area);
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
      for (let i = 0, len = listS.length; i < len; i++) {
        const { bbox: bbox2, t: t2 } = listS[i];
        if (t2 && checkInRect(bbox2, undefined, x0, y0, w0, h0)) {
          drawTextureCache(
            gl,
            cx,
            cy,
            cacheProgram,
            {
              opacity: 1,
              bbox: bbox2,
              t: t2,
              dx: -x0,
              dy: -y0,
            },
          );
        }
      }
    }
  }
  return frameBuffer!;
}

// 视频或者图片在isPure的情况下使用共享原始纹理，但尺寸可能不同，不同的情况下还是需要重新生成到对应尺寸以免过大或不匹配
export function needReGen(node: Node, w: number, h: number) {
  if (node instanceof Video || node instanceof Bitmap) {
    if (node.isPure) {
      if (node instanceof Video) {
        const meta = node.metaData;
        if (meta?.video?.displayWidth !== w || meta.video.displayHeight !== h) {
          return true;
        }
      }
      else {
        if (node.loader?.width !== w || node.loader.height !== h) {
          return true;
        }
      }
    }
  }
  return false;
}
