import Node from './Node';
import { BitmapProps } from '../format';
import CanvasCache from '../refresh/CanvasCache';
import { loadImg, LoadImgRes, getCacheImg } from '../util/loadImg';
import TextureCache from '../refresh/TextureCache';
import { LayoutData } from '../refresh/layout';
import { OBJECT_FIT, StyleUnit, VISIBILITY } from '../style/define';
import { RefreshLevel } from '../refresh/level';
import { Options } from '../animation/AbstractAnimation';
import GifAnimation from '../animation/GifAnimation';
import config from '../config';
import { canvasPolygon } from '../refresh/paint';
import { LOAD } from '../refresh/refreshEvent';

class Bitmap extends Node {
  _src: string;
  loader?: LoadImgRes;
  isPure: boolean;
  private _frameIndex: number;
  onLoad?: () => void;

  constructor(props: BitmapProps) {
    super(props);
    if (props.onLoad) {
      this.onLoad = props.onLoad;
    }
    this._frameIndex = props.frameIndex || 0;
    this.isPure = true;
    const src = (this._src = props.src || '');
    if (src) {
      const cb = () => {
        if (this.isMounted) {
          const { left, top, right, bottom, width, height } = this.style;
          if ((left.u === StyleUnit.AUTO || right.u === StyleUnit.AUTO) && width.u === StyleUnit.AUTO
            || (top.u === StyleUnit.AUTO || bottom.u === StyleUnit.AUTO) && height.u === StyleUnit.AUTO
          ) {
            this.refresh(RefreshLevel.REFLOW);
          }
          else {
            this.refresh();
          }
        }
        if (this.onLoad) {
          this.onLoad();
        }
        this.emit(LOAD);
      };
      const cache = getCacheImg(src);
      if (cache) {
        if (cache.success) {
          this.loader = cache;
          cb();
        }
      }
      else {
        this.contentLoadingNum = 1;
        loadImg(src).then(res => {
          this.loader = res;
          this.contentLoadingNum = 0;
          // 加载完且已经didMount了，触发刷新，默认第0帧
          if (res.success) {
            cb();
          }
        });
      }
    }
  }

  // 自适应尺寸情况下使用图片本身的尺寸，只定义了一方的情况下使用等比
  override lay(data: LayoutData) {
    super.lay(data);
    const { style, computedStyle, loader } = this;
    const { left, top, right, bottom, width, height } = style;
    if (loader) {
      const autoW = (left.u === StyleUnit.AUTO || right.u === StyleUnit.AUTO) && width.u === StyleUnit.AUTO;
      const autoH = (top.u === StyleUnit.AUTO || bottom.u === StyleUnit.AUTO) && height.u === StyleUnit.AUTO;
      if (autoW) {
        if (autoH) {
          computedStyle.width = loader.width;
        }
        else {
          computedStyle.width = loader.width * computedStyle.height / loader.height;
        }
        if (left.u === StyleUnit.AUTO && right.u === StyleUnit.AUTO) {
          computedStyle.left = 0;
          computedStyle.right = data.w - computedStyle.width;
        }
        else if (left.u === StyleUnit.AUTO) {
          computedStyle.left = data.w - computedStyle.right - computedStyle.width;
        }
        else if (right.u === StyleUnit.AUTO) {
          computedStyle.right = data.w - computedStyle.left - computedStyle.width;
        }
      }
      if (autoH) {
        if (autoW) {
          computedStyle.height = loader.height;
        }
        else {
          computedStyle.height = loader.height * computedStyle.width / loader.width;
        }
        if (top.u === StyleUnit.AUTO && bottom.u === StyleUnit.AUTO) {
          computedStyle.top = 0;
          computedStyle.bottom = data.h - computedStyle.height;
        }
        else if (top.u === StyleUnit.AUTO) {
          computedStyle.top = data.h - computedStyle.bottom - computedStyle.height;
        }
        else if (bottom.u === StyleUnit.AUTO) {
          computedStyle.bottom = data.h - computedStyle.top - computedStyle.height;
        }
      }
    }
  }

  override calRepaintStyle(lv: RefreshLevel) {
    super.calRepaintStyle(lv);
    const { computedStyle, loader } = this;
    this.isPure = computedStyle.backgroundColor[3] <= 0;
    // 注意圆角影响
    if (this.isPure && loader?.success) {
      const {
        objectFit,
        borderTopLeftRadius,
        borderTopRightRadius,
        borderBottomLeftRadius,
        borderBottomRightRadius,
      } = computedStyle;
      if ((objectFit === OBJECT_FIT.COVER || objectFit === OBJECT_FIT.FILL)
        && (borderTopLeftRadius || borderTopRightRadius || borderBottomLeftRadius || borderBottomRightRadius)) {
        this.isPure = false;
      }
      else if (objectFit === OBJECT_FIT.CONTAIN
        && (borderTopLeftRadius || borderTopRightRadius || borderBottomLeftRadius || borderBottomRightRadius)) {
        const ratio = loader.width / loader.height;
        const ratio2 = computedStyle.width / computedStyle.height;
        if (ratio2 > ratio) {
          const w = computedStyle.height * ratio;
          const dx = (computedStyle.width - w) * 0.5;
          if (borderTopLeftRadius > dx || borderTopRightRadius > dx || borderBottomLeftRadius > dx || borderBottomRightRadius > dx) {
            this.isPure = false;
          }
        }
        else if (ratio2 < ratio) {
          const h = computedStyle.width / ratio;
          const dy = (computedStyle.height - h) * 0.5;
          if (borderTopLeftRadius > dy || borderTopRightRadius > dy || borderBottomLeftRadius > dy || borderBottomRightRadius > dy) {
            this.isPure = false;
          }
        }
        else {
          this.isPure = false;
        }
      }
    }
  }

  override calContent() {
    this.hasContent = false;
    const loader = this.loader;
    if (loader?.success) {
      if (loader.frames.length) {
        if (this._frameIndex >= 0 && this._frameIndex < loader.frames.length) {
          this.hasContent = true;
        }
      }
      else if (loader.source) {
        this.hasContent = true;
      }
    }
    else {
      this.hasContent = this.computedStyle.backgroundColor[3] > 0;
    }
    return this.hasContent;
  }

  override renderCanvas() {
    const { isPure, loader, computedStyle } = this;
    // 纯图片
    if (isPure) {
      this.canvasCache?.release();
      if (loader?.success) {
        const w = loader.width,
          h = loader.height;
        // 动图使用特殊的videoFrame
        if (loader.frames.length) {
          const index = Math.min(loader.frames.length - 1, Math.max(0, this._frameIndex));
          const videoFrame = loader.frames[index];
          // 超尺寸才使用canvas分块
          if (videoFrame && (w > config.maxTextureSize || h > config.maxTextureSize)) {
            const canvasCache = this.canvasCache = CanvasCache.getVideoFrameInstance(w, h, videoFrame);
            canvasCache.available = true;
            // 第一张图像才绘制，图片解码到canvas上
            if (canvasCache.getCount() === 1) {
              let { width, height, objectFit } = computedStyle;
              let dx = 0, dy = 0;
              const ratio = loader.width / loader.height;
              const ratio2 = width / height;
              if (objectFit === OBJECT_FIT.CONTAIN) {
                if (ratio2 > ratio) {
                  const w = height * ratio;
                  dx = (width - w) * 0.5;
                  width = w;
                }
                else if (ratio2 < ratio) {
                  const h = width / ratio;
                  dy = (height - h) * 0.5;
                  height = h;
                }
              }
              else if (objectFit === OBJECT_FIT.COVER) {
                if (ratio2 > ratio) {
                  const h = width / ratio;
                  dy = (height - h) * 0.5;
                  height = h;
                }
                else if (ratio2 < ratio) {
                  const w = height * ratio;
                  dx = (width - w) * 0.5;
                  width = w;
                }
              }
              const list = canvasCache.list;
              for (let i = 0, len = list.length; i < len; i++) {
                const { x, y, os } = list[i];
                os.ctx.drawImage(videoFrame, -x + dx, -y + dy, width, height);
              }
            }
          }
        }
        // 纯图片超尺寸共用一个canvas的cache，尺寸使用图片原始尺寸
        else if (loader.source && (loader.width > config.maxTextureSize || loader.height > config.maxTextureSize)) {
          const canvasCache = this.canvasCache = CanvasCache.getImgInstance(w, h, this._src);
          canvasCache.available = true;
          // 第一张图像才绘制，图片解码到canvas上
          if (canvasCache.getCount() === 1) {
            let { width, height, objectFit } = computedStyle;
            let dx = 0, dy = 0;
            const ratio = loader.width / loader.height;
            const ratio2 = width / height;
            if (objectFit === OBJECT_FIT.CONTAIN) {
              if (ratio2 > ratio) {
                const w = height * ratio;
                dx = (width - w) * 0.5;
                width = w;
              }
              else if (ratio2 < ratio) {
                const h = width / ratio;
                dy = (height - h) * 0.5;
                height = h;
              }
            }
            else if (objectFit === OBJECT_FIT.COVER) {
              if (ratio2 > ratio) {
                const h = width / ratio;
                dy = (height - h) * 0.5;
                height = h;
              }
              else if (ratio2 < ratio) {
                const w = height * ratio;
                dx = (width - w) * 0.5;
                width = w;
              }
            }
            const list = canvasCache.list;
            for (let i = 0, len = list.length; i < len; i++) {
              const { x, y, os } = list[i];
              os.ctx.drawImage(loader.source, -x + dx, -y + dy, width, height);
            }
          }
        }
      }
    }
    // 复合类型
    else {
      super.renderCanvas();
      const computedStyle = this.computedStyle;
      const bbox = this._bboxInt || this.bboxInt;
      const x = bbox[0],
        y = bbox[1];
      let w = bbox[2] - x,
        h = bbox[3] - y;
      let { width, height, objectFit } = computedStyle;
      let dx = 0, dy = 0;
      if (loader?.success) {
        const ratio = loader.width / loader.height;
        const ratio2 = width / height;
        if (objectFit === OBJECT_FIT.CONTAIN) {
          if (ratio2 > ratio) {
            const w = height * ratio;
            dx = (width - w) * 0.5;
            width = w;
          }
          else if (ratio2 < ratio) {
            const h = width / ratio;
            dy = (height - h) * 0.5;
            height = h;
          }
        }
        else if (objectFit === OBJECT_FIT.COVER) {
          if (ratio2 > ratio) {
            const h = width / ratio;
            dy = (height - h) * 0.5;
            height = h;
          }
          else if (ratio2 < ratio) {
            const w = height * ratio;
            dx = (width - w) * 0.5;
            width = w;
          }
        }
      }
      const canvasCache = this.canvasCache = (this.canvasCache?.available ? this.canvasCache : new CanvasCache(w, h, -x, -y));
      canvasCache.available = true;
      const list = canvasCache.list;
      for (let i = 0, len = list.length; i < len; i++) {
        const { x, y, os: { ctx } } = list[i];
        const dx2 = -x;
        const dy2 = -y;
        if (loader?.success) {
          const { borderTopLeftRadius, borderTopRightRadius, borderBottomLeftRadius, borderBottomRightRadius } = computedStyle;
          if (borderTopLeftRadius || borderTopRightRadius || borderBottomLeftRadius || borderBottomRightRadius) {
            const coords = this.getBackgroundCoords(x, y);
            ctx.save();
            ctx.beginPath();
            canvasPolygon(ctx, coords, -x, -y);
            ctx.closePath();
            ctx.clip();
          }
          if (loader.frames.length) {
            const index = Math.min(loader.frames.length - 1, Math.max(0, this._frameIndex));
            const videoFrame = loader.frames[index];
            if (videoFrame) {
              ctx.drawImage(videoFrame, dx2 + dx, dy2 + dy, width, height);
            }
          }
          else if (loader.source) {
            ctx.drawImage(loader.source, dx2 + dx, dy2 + dy, width, height);
          }
          if (borderTopLeftRadius || borderTopRightRadius || borderBottomLeftRadius || borderBottomRightRadius) {
            ctx.restore();
          }
        }
      }
    }
  }

  override genTexture(gl: WebGL2RenderingContext | WebGLRenderingContext) {
    const { isPure, loader, canvasCache } = this;
    if (isPure) {
      // 肯定有
      if (loader?.success) {
        if (loader.width > config.maxTextureSize || loader.height > config.maxTextureSize) {
          if (canvasCache?.available && TextureCache.hasCanvasCacheInstance(canvasCache)) {
            const tc = TextureCache.getCanvasCacheInstance(gl, canvasCache, this._rect || this.rect);
            this.textureTarget = this.textureCache = tc;
          }
          else {
            this.renderCanvas();
            const tc = TextureCache.getCanvasCacheInstance(gl, this.canvasCache!, this._rect || this.rect);
            this.textureTarget = this.textureCache = tc;
            this.canvasCache!.release();
          }
        }
        else {
          let { width, height, objectFit } = this.computedStyle;
          let r = this._rect || this.rect;
          let tc: { x1: number, y1: number, x3: number, y3: number } | undefined;
          const ratio = loader.width / loader.height;
          const ratio2 = width / height;
          if (objectFit === OBJECT_FIT.CONTAIN) {
            if (ratio2 > ratio) {
              const w = height * ratio;
              const d = (width - w) * 0.5;
              r = r.slice(0);
              r[0] += d;
              r[2] -= d;
            }
            else if (ratio2 < ratio) {
              const h = width / ratio;
              const d = (height - h) * 0.5;
              r = r.slice(0);
              r[1] += d;
              r[3] -= d;
            }
          }
          else if (objectFit === OBJECT_FIT.COVER) {
            if (ratio2 > ratio) {
              const h = width / ratio;
              const d = Math.abs(height - h) * 0.5;
              const p = d / h;
              tc = { x1: 0, y3: p, x3: 1, y1: 1 - p };
            }
            else if (ratio2 < ratio) {
              const w = height * ratio;
              const d = Math.abs(width - w) * 0.5;
              const p = d / w;
              tc = { x1: p, y3: 0, x3: 1 - p, y1: 1 };
            }
          }
          if (loader.frames.length) {
            const index = Math.min(loader.frames.length - 1, Math.max(0, this._frameIndex));
            const videoFrame = loader.frames[index];
            if (videoFrame) {
              const textureCache = TextureCache.getVideoFrameInstance(gl, videoFrame, r, tc);
              this.textureTarget = this.textureCache = textureCache;
            }
          }
          else if (loader.source) {
            const textureCache = TextureCache.getImgInstance(gl, loader.source, r, tc);
            this.textureTarget = this.textureCache = textureCache;
          }
        }
      }
    }
    else {
      super.genTexture(gl);
    }
  }

  override release() {
    super.release();
    const { loader } = this;
    if (loader?.success) {
      loader.release();
    }
  }

  gifAnimate(frameArea: [number, number], options: Options & {
    autoPlay?: boolean;
  }) {
    const animation = new GifAnimation(this, frameArea, options);
    return this.initAnimate(animation, options);
  }

  override cloneProps() {
    const props = super.cloneProps() as BitmapProps;
    props.src = this._src;
    return props;
  }

  override clone() {
    const props = this.cloneProps();
    const res = new Bitmap(props);
    return res;
  }

  get src() {
    return this._src;
  }

  set src(v: string) {
    if (this._src !== v) {
      this._src = v;
      this.refresh();
    }
  }

  get frameIndex() {
    return this._frameIndex;
  }

  set frameIndex(frameIndex: number) {
    if (this._frameIndex !== frameIndex) {
      this._frameIndex = frameIndex;
      this.refresh();
    }
  }
}

export default Bitmap;
