import config from '../config';

const SPF = 1000 / 60;

const CANVAS: Record<string, OffscreenCanvas | HTMLCanvasElement> = {};
const SUPPORT_OFFSCREEN_CANVAS =
  typeof OffscreenCanvas === 'function' && OffscreenCanvas.prototype.getContext;

export type OffScreen = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  available: boolean;
  release: () => void;
};

function offscreenCanvas(
  width: number,
  height: number,
  key?: string,
  contextAttributes?: CanvasRenderingContext2DSettings,
): OffScreen {
  let o: any;
  if (!key) {
    o =
      !config.debug && config.offscreenCanvas && SUPPORT_OFFSCREEN_CANVAS
        ? new OffscreenCanvas(width, height)
        : document.createElement('canvas');
  }
  else if (!CANVAS[key]) {
    o = CANVAS[key] =
      !config.debug && config.offscreenCanvas && SUPPORT_OFFSCREEN_CANVAS
        ? new OffscreenCanvas(width, height)
        : document.createElement('canvas');
  }
  else {
    o = CANVAS[key];
  }
  // 防止小数向上取整
  width = Math.ceil(width);
  height = Math.ceil(height);
  o.width = width;
  o.height = height;
  o.style.position = 'fixed';
  o.style.left = '9999px';
  o.style.top = '0px';
  o.style.webkitFontSmoothing = 'antialiased'; // offscreenCanvas无效
  o.style.mozOsxFontSmoothing = 'grayscale';
  if (config.debug) {
    o.style.width = width + 'px';
    o.style.height = height + 'px';
  }
  // 字体抗锯齿需要添加到DOM
  if (o instanceof HTMLCanvasElement) {
    document.body.appendChild(o);
    if (key) {
      o.setAttribute('key', key);
    }
  }
  const ctx = o.getContext('2d', contextAttributes);
  if (!ctx) {
    inject.error('Total canvas memory use exceeds the maximum limit');
  }
  return {
    canvas: o,
    ctx,
    width,
    height,
    available: true,
    release() {
      if (!this.available || config.debug) {
        return;
      }
      this.available = false;
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, width, height);
      o.width = o.height = 0;
      if (o instanceof HTMLCanvasElement) {
        document.body.removeChild(o);
      }
      o = null;
    },
  };
}

const SUPPORT_FONT: Record<string, boolean> = {};
let defaultFontFamilyData: Uint8ClampedArray;

const inject = {
  requestAnimationFrame(cb: FrameRequestCallback): number {
    if (!cb) {
      return -1;
    }
    let res;
    if (typeof requestAnimationFrame !== 'undefined') {
      inject.requestAnimationFrame = requestAnimationFrame.bind(null);
      res = requestAnimationFrame(cb);
    }
    else {
      res = setTimeout(cb, SPF);
      inject.requestAnimationFrame = function (cb) {
        return setTimeout(cb, SPF);
      };
    }
    return res;
  },
  cancelAnimationFrame(id: number) {
    let res;
    if (typeof cancelAnimationFrame !== 'undefined') {
      inject.cancelAnimationFrame = cancelAnimationFrame.bind(null);
      res = cancelAnimationFrame(id);
    }
    else {
      res = clearTimeout(id);
      inject.cancelAnimationFrame = function (id) {
        return clearTimeout(id);
      };
    }
    return res;
  },
  now() {
    if (typeof performance !== 'undefined') {
      inject.now = function () {
        return Math.floor(performance.now());
      };
      return Math.floor(performance.now());
    }
    inject.now = Date.now.bind(Date);
    return Date.now();
  },
  hasOffscreenCanvas(key: string) {
    return key && CANVAS.hasOwnProperty(key);
  },
  getOffscreenCanvas(
    width: number,
    height: number,
    key?: string,
    contextAttributes?: CanvasRenderingContext2DSettings,
  ) {
    return offscreenCanvas(width, height, key, contextAttributes);
  },
  isWebGLTexture(o: any) {
    if (o && typeof WebGLTexture !== 'undefined') {
      return o instanceof WebGLTexture;
    }
  },
  getFontCanvas() {
    return inject.getOffscreenCanvas(
      16,
      16,
      '__$$CHECK_SUPPORT_FONT_FAMILY$$__',
      { willReadFrequently: true },
    );
  },
  checkSupportFontFamily(ff: string) {
    // 强制arial兜底
    if (ff === config.defaultFontFamily) {
      return true;
    }
    if (SUPPORT_FONT.hasOwnProperty(ff)) {
      return SUPPORT_FONT[ff];
    }
    const canvas = inject.getFontCanvas();
    const context = canvas.ctx;
    context.textAlign = 'center';
    context.fillStyle = '#000';
    context.textBaseline = 'middle';
    if (!defaultFontFamilyData) {
      context.clearRect(0, 0, 16, 16);
      context.font = '16px ' + config.defaultFontFamily;
      context.fillText('a', 8, 8);
      defaultFontFamilyData = context.getImageData(0, 0, 16, 16).data;
    }
    context.clearRect(0, 0, 16, 16);
    if (/\s/.test(ff)) {
      ff = '"' + ff.replace(/"/g, '\\"') + '"';
    }
    context.font = '16px ' + ff + ',' + config.defaultFontFamily;
    context.fillText('a', 8, 8);
    const data = context.getImageData(0, 0, 16, 16).data;
    for (let i = 0, len = data.length; i < len; i++) {
      if (defaultFontFamilyData[i] !== data[i]) {
        return (SUPPORT_FONT[ff] = true);
      }
    }
    return (SUPPORT_FONT[ff] = false);
  },
  async addArrayBufferFont(postscriptName: string, ab: ArrayBuffer) {
    if (typeof document !== 'undefined' && typeof FontFace !== 'undefined') {
      const ff = new FontFace(postscriptName, ab);
      await ff.load();
      // @ts-ignore
      document.fonts.add(ff);
    }
  },
  async addLocalFont(postscriptName: string) {
    if (typeof document !== 'undefined' && typeof FontFace !== 'undefined') {
      const ff = new FontFace(postscriptName, `local(${postscriptName}`);
      await ff.load();
      // @ts-ignore
      document.fonts.add(ff);
    }
  },
  async loadArrayBufferImg(ab: ArrayBuffer): Promise<HTMLImageElement> {
    const blob = new Blob([ab]);
    const img = new Image();
    return new Promise((resolve, reject) => {
      img.onload = () => {
        resolve(img);
      };
      img.onerror = (e) => {
        reject(e);
      };
      img.src = URL.createObjectURL(blob);
    });
  },
  pdfjsLibWorkerSrc: 'https://gw.alipayobjects.com/os/lib/pdfjs-dist/3.11.174/build/pdf.worker.min.js',
  async loadArrayBufferPdf(ab: ArrayBuffer): Promise<HTMLImageElement> {
    // @ts-ignore
    const pdfjsLib = window.pdfjsLib;
    pdfjsLib.GlobalWorkerOptions.workerSrc = inject.pdfjsLibWorkerSrc;
    const blob = new Blob([ab]);
    const url = URL.createObjectURL(blob);
    const task = await pdfjsLib.getDocument(url).promise;
    const page = await task.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({
      viewport,
      canvasContext: ctx,
      background: 'transparent',
    }).promise;
    const b = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(blob => {
        if (blob) {
          resolve(blob);
        }
        else {
          reject('');
        }
      });
    });
    const img = new Image();
    return new Promise((resolve, reject) => {
      img.onload = () => {
        resolve(img);
      };
      img.onerror = (e) => {
        reject(e);
      };
      img.src = URL.createObjectURL(b);
    });
  },
  async loadLocalFonts() {
    if (typeof navigator !== 'undefined') {
      try {
        const status = await navigator.permissions.query({
          // @ts-ignore
          name: 'local-fonts',
        });
        if (status.state === 'denied') {
          inject.error('No Permission.');
          return [];
        }
        // @ts-ignore
        return await window.queryLocalFonts();
      } catch (err) {
        inject.error(err);
        return [];
      }
    }
    return [];
  },
  async uploadBlobImgSrc(src: string): Promise<string | void> {},
  log(s: any) {
    console.log(s);
  },
  warn(s: any) {
    console.warn(s);
  },
  error(s: any) {
    console.error(s);
  },
};

export default inject;
