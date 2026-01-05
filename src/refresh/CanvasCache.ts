import inject, { OffScreen } from '../util/inject';
import config from '../config';

// 图片等资源复用，计数器回收
const IMG_MAP: Record<string, { value: CanvasCache, count: number }> = {};
const CANVAS_MAP = new WeakMap<HTMLCanvasElement, { value: CanvasCache, count: number }>();
const VIDEO_FRAME_MAP = new WeakMap<VideoFrame, { value: CanvasCache, count: number }>();

class CanvasCache {
  available: boolean;
  dx: number; // 离屏都是0, 0开始，和原始对象x, y有个偏移值
  dy: number;
  w: number;
  h: number;
  list: {
    x: number;
    y: number;
    w: number;
    h: number;
    os: OffScreen;
  }[];
  url?: string;
  videoFrame?: VideoFrame;
  canvas?: HTMLCanvasElement;

  constructor(w: number, h: number, dx = 0, dy = 0) {
    this.available = false;
    this.w = w;
    this.h = h;
    this.dx = dx;
    this.dy = dy;
    this.list = [];
    const UNIT = config.maxTextureSize;
    for (let i = 0, len = Math.ceil(h / UNIT); i < len; i++) {
      for (let j = 0, len2 = Math.ceil(w / UNIT); j < len2; j++) {
        const width = j === len2 - 1 ? (w - j * UNIT) : UNIT;
        const height = i === len - 1 ? (h - i * UNIT) : UNIT;
        this.list.push({
          x: j * UNIT - dx,
          y: i * UNIT - dy,
          w: width,
          h: height,
          os: inject.getOffscreenCanvas(width, height),
        });
      }
    }
  }

  release() {
    if (this.url) {
      return this.releaseImg(this.url);
    }
    if (this.videoFrame) {
      return this.releaseVideoFrame(this.videoFrame);
    }
    if (this.canvas) {
      return this.releaseCanvas(this.canvas);
    }
    if (!this.available) {
      return false;
    }
    this.available = false;
    this.list.splice(0).forEach(item => item.os.release());
    return true;
  }

  releaseImg(url: string) {
    if (!this.available) {
      return false;
    }
    this.available = false;
    const o = IMG_MAP[url];
    if (o) {
      o.count--;
      if (!o.count) {
        // 此时无引用计数可清空且释放离屏canvas
        delete IMG_MAP[url];
        this.list.splice(0).forEach(item => item.os.release());
      }
    }
    return true;
  }

  releaseVideoFrame(videoFrame: VideoFrame) {
    if (!this.available) {
      return false;
    }
    this.available = false;
    const o = VIDEO_FRAME_MAP.get(videoFrame);
    if (o) {
      o.count--;
      if (!o.count) {
        // 此时无引用计数可清空且释放离屏canvas
        VIDEO_FRAME_MAP.delete(videoFrame);
        this.list.splice(0).forEach(item => item.os.release());
      }
    }
    return true;
  }

  releaseCanvas(canvas: HTMLCanvasElement) {
    if (!this.available) {
      return false;
    }
    this.available = false;
    const o = CANVAS_MAP.get(canvas);
    if (o) {
      o.count--;
      if (!o.count) {
        // 此时无引用计数可清空且释放离屏canvas
        CANVAS_MAP.delete(canvas);
        this.list.splice(0).forEach(item => item.os.release());
      }
    }
    return true;
  }

  getCount() {
    if (this.url) {
      return IMG_MAP[this.url]?.count;
    }
    else if (this.videoFrame) {
      return VIDEO_FRAME_MAP.get(this.videoFrame)?.count;
    }
  }

  static getImgInstance(w: number, h: number, url: string, dx = 0, dy = 0) {
    const cache = IMG_MAP[url];
    if (cache) {
      cache.count++;
      return cache.value;
    }
    const res = new CanvasCache(w, h, dx, dy);
    res.url = url;
    IMG_MAP[url] = {
      value: res,
      count: 1,
    };
    return res;
  }

  static getVideoFrameInstance(w: number, h: number, videoFrame: VideoFrame, dx = 0, dy = 0) {
    const cache = VIDEO_FRAME_MAP.get(videoFrame);
    if (cache) {
      cache.count++;
      return cache.value;
    }
    const res = new CanvasCache(w, h, dx, dy);
    res.videoFrame = videoFrame;
    VIDEO_FRAME_MAP.set(videoFrame, {
      value: res,
      count: 1,
    });
    return res;
  }

  static getCanvasInstance(w: number, h: number, canvas: HTMLCanvasElement, dx = 0, dy = 0) {
    const cache = CANVAS_MAP.get(canvas);
    if (cache) {
      cache.count++;
      return cache.value;
    }
    const res = new CanvasCache(w, h, dx, dy);
    res.canvas = canvas;
    CANVAS_MAP.set(canvas, {
      value: res,
      count: 1,
    });
    return res;
  }
}

export default CanvasCache;
