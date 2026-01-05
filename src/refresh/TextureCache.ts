import { createTexture } from '../gl/webgl';
import CanvasCache from './CanvasCache';

// 资源复用，计数器回收
const CANVAS_CACHE_MAP = new WeakMap<CanvasCache, {
  value: {
    x: number;
    y: number;
    w: number;
    h: number;
    t: WebGLTexture;
  }[],
  w: number;
  h: number;
  count: number;
}>();

const IMG_MAP = new WeakMap<HTMLImageElement, {
  t: WebGLTexture,
  count: number;
}>();

const VIDEO_FRAME_MAP = new WeakMap<VideoFrame, {
  t: WebGLTexture,
  count: number;
}>();

const CANVAS_MAP = new WeakMap<HTMLCanvasElement, {
  t: WebGLTexture,
  count: number;
}>();

export type SubTexture = {
  bbox: Float32Array;
  w: number;
  h: number;
  t: WebGLTexture;
  tc?: { x1: number, y1: number, x3: number, y3: number };
};

let id = 0;

class TextureCache {
  id: number;
  gl: WebGL2RenderingContext | WebGLRenderingContext;
  available: boolean;
  bbox: Float32Array;
  list: SubTexture[];
  image?: HTMLImageElement;
  canvasCache?: CanvasCache;
  videoFrame?: VideoFrame;
  canvas?: HTMLCanvasElement;

  constructor(gl: WebGL2RenderingContext | WebGLRenderingContext, bbox: Float32Array,
              source?: CanvasCache | HTMLImageElement | VideoFrame | HTMLCanvasElement,
              tc?: { x1: number, y1: number, x3: number, y3: number }) {
    this.id = id++;
    this.gl = gl;
    this.bbox = bbox.slice(0);
    const maxX = bbox[2], maxY = bbox[3];
    this.list = [];
    // 从已有节点来的内容
    if (source) {
      this.available = true;
      if (source instanceof CanvasCache) {
        this.canvasCache = source;
        const { list, w, h } = source;
        const len = list.length;
        // 一般单个bbox就是总的bbox拆分开来1:1，但纯图片存在复用原始尺寸的因素要计算
        const w2 = bbox[2] - bbox[0];
        const h2 = bbox[3] - bbox[1];
        const r1 = w2 / w;
        const r2 = h2 / h;
        for (let i = 0; i < len; i++) {
          const item = list[i];
          const t = createTexture(gl, 0, item.os.canvas);
          this.list.push({
            bbox: new Float32Array([
              item.x * r1, // 允许小数
              item.y * r2,
              Math.min(maxX, (item.x + item.w) * r1), // 精度问题保底
              Math.min(maxY, (item.y + item.h) * r2),
            ]),
            w: item.w,
            h: item.h,
            t,
            tc,
          });
        }
      }
      else {
        const t = createTexture(gl, 0, source);
        if (source instanceof HTMLImageElement) {
          this.image = source;
          this.list.push({
            bbox: new Float32Array(bbox),
            w: source.width,
            h: source.height,
            t,
            tc,
          });
        }
        else if (source instanceof VideoFrame) {
          this.videoFrame = source;
          this.list.push({
            bbox: new Float32Array(bbox),
            w: source.codedWidth,
            h: source.codedHeight,
            t,
            tc,
          });
        }
        else if (source instanceof HTMLCanvasElement) {
          this.canvas = source;
          this.list.push({
            bbox: new Float32Array(bbox),
            w: source.width,
            h: source.height,
            t,
            tc,
          });
        }
      }
    }
    // merge汇总产生的新空白内容外部自行控制，另外复用位图的自己控制
    else {
      this.available = false;
    }
  }

  release() {
    if (this.image) {
      return this.releaseImg(this.image);
    }
    if (this.videoFrame) {
      return this.releaseVideoFrame(this.videoFrame);
    }
    if (this.canvasCache) {
      return this.releaseCanvasCache(this.canvasCache);
    }
    if (!this.available) {
      return false;
    }
    this.available = false;
    this.list.splice(0).forEach(item => {
      if (item.t) {
        this.gl.deleteTexture(item.t);
      }
    });
    return true;
  }

  releaseImg(image: HTMLImageElement) {
    if (!this.available) {
      return false;
    }
    this.available = false;
    const o = IMG_MAP.get(image);
    if (!o) {
      return false;
    }
    o.count--;
    if (!o.count) {
      IMG_MAP.delete(image);
      this.list.splice(0).forEach(item => {
        if (item.t) {
          this.gl.deleteTexture(item.t);
        }
      });
    }
    return true;
  }

  releaseVideoFrame(videoFrame: VideoFrame) {
    if (!this.available) {
      return false;
    }
    this.available = false;
    const o = VIDEO_FRAME_MAP.get(videoFrame);
    if (!o) {
      return false;
    }
    o.count--;
    if (!o.count) {
      VIDEO_FRAME_MAP.delete(videoFrame);
      this.list.splice(0).forEach(item => {
        if (item.t) {
          this.gl.deleteTexture(item.t);
        }
      });
    }
    return true;
  }

  releaseCanvasCache(canvasCache: CanvasCache) {
    if (!this.available) {
      return false;
    }
    this.available = false;
    const item = CANVAS_CACHE_MAP.get(canvasCache);
    if (!item) {
      return false;
    }
    item.count--;
    if (!item.count) {
      CANVAS_CACHE_MAP.delete(canvasCache);
      this.list.splice(0).forEach(item => {
        if (item.t) {
          this.gl.deleteTexture(item.t);
        }
      });
    }
    return true;
  }

  static hasCanvasCacheInstance(canvasCache: CanvasCache) {
    return CANVAS_CACHE_MAP.has(canvasCache);
  }

  static getCanvasCacheInstance(gl: WebGL2RenderingContext | WebGLRenderingContext, canvasCache: CanvasCache, bbox: Float32Array) {
    const cache = CANVAS_CACHE_MAP.get(canvasCache);
    if (cache) {
      cache.count++;
      const res = new TextureCache(gl, bbox);
      res.available = true;
      res.canvasCache = canvasCache;
      const w2 = bbox[2] - bbox[0];
      const h2 = bbox[3] - bbox[1];
      const r1 = w2 / cache.w;
      const r2 = h2 / cache.h;
      const maxX = bbox[2], maxY = bbox[3];
      const value = cache.value;
      const len = value.length;
      // 复用第一张留下的原始信息计算
      for (let i = 0; i < len; i++) {
        const item = value[i];
        res.list.push({
          bbox: new Float32Array([
            item.x * r1, // 允许小数，只有图片有小数
            item.y * r2,
            Math.min(maxX, (item.x + item.w) * r1), // 精度问题保底，防止最后一个超过
            Math.min(maxY, (item.y + item.h) * r2),
          ]),
          w: item.w,
          h: item.h,
          t: item.t,
        });
      }
      return res;
    }
    const res = new TextureCache(gl, bbox, canvasCache);
    // 第一次记录下原始资源的尺寸等信息供后续复用计算
    CANVAS_CACHE_MAP.set(canvasCache, {
      value: res.list.map((item, i) => {
        return {
          x: canvasCache.list[i].x,
          y: canvasCache.list[i].y,
          w: item.w,
          h: item.h,
          t: item.t,
        };
      }),
      w: canvasCache.w,
      h: canvasCache.h,
      count: 1,
    });
    return res;
  }

  static hasImageCache(img: HTMLImageElement) {
    return IMG_MAP.has(img);
  }

  static getImgInstance(gl: WebGL2RenderingContext | WebGLRenderingContext, image: HTMLImageElement, bbox: Float32Array,
                        tc?: { x1: number, y1: number, x3: number, y3: number }) {
    const cache = IMG_MAP.get(image);
    if (cache) {
      cache.count++;
      const res = new TextureCache(gl, bbox);
      res.available = true;
      res.image = image;
      res.list = [{
        bbox: bbox.slice(0),
        w: image.width,
        h: image.height,
        t: cache.t,
        tc,
      }];
      return res;
    }
    const res = new TextureCache(gl, bbox, image, tc);
    // 第一次记录下原始资源的尺寸等信息供后续复用计算
    IMG_MAP.set(image, {
      t: res.list[0].t,
      count: 1,
    });
    return res;
  }

  static hasVideoFrameInstance(videoFrame: VideoFrame) {
    return VIDEO_FRAME_MAP.has(videoFrame);
  }

  static getVideoFrameInstance(gl: WebGL2RenderingContext | WebGLRenderingContext, videoFrame: VideoFrame, bbox: Float32Array,
                               tc?: { x1: number, y1: number, x3: number, y3: number }) {
    const cache = VIDEO_FRAME_MAP.get(videoFrame);
    if (cache) {
      cache.count++;
      const res = new TextureCache(gl, bbox);
      res.available = true;
      res.videoFrame = videoFrame;
      res.list = [{
        bbox: bbox.slice(0),
        w: videoFrame.codedWidth,
        h: videoFrame.codedHeight,
        t: cache.t,
        tc,
      }];
      return res;
    }
    const res = new TextureCache(gl, bbox, videoFrame, tc);
    VIDEO_FRAME_MAP.set(videoFrame, {
      t: res.list[0].t,
      count: 1,
    });
    return res;
  }

  static getCanvasInstance(gl: WebGL2RenderingContext | WebGLRenderingContext, canvas: HTMLCanvasElement, bbox: Float32Array,
                           tc?: { x1: number, y1: number, x3: number, y3: number }) {
    const cache = CANVAS_MAP.get(canvas);
    if (cache) {
      cache.count++;
      const res = new TextureCache(gl, bbox);
      res.available = true;
      res.canvas = canvas;
      res.list = [{
        bbox: bbox.slice(0),
        w: canvas.width,
        h: canvas.height,
        t: cache.t,
        tc,
      }];
      return res;
    }
    const res = new TextureCache(gl, bbox, canvas, tc);
    CANVAS_MAP.set(canvas, {
      t: res.list[0].t,
      count: 1,
    });
    return res;
  }

  static getEmptyInstance(gl: WebGL2RenderingContext | WebGLRenderingContext, bbox: Float32Array) {
    return new TextureCache(gl, bbox);
  }
}

export default TextureCache;
