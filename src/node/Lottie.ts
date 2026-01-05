import Node from './Node';
import { LottieMeta, LottieProps } from '../format';
import { OBJECT_FIT, StyleUnit, VISIBILITY } from '../style/define';
import { RefreshLevel } from '../refresh/level';
import { LayoutData } from '../refresh/layout';
import CanvasCache from '../refresh/CanvasCache';
import { color2rgbaStr } from '../style/color';
import { canvasPolygon } from '../refresh/paint';
import { Options } from '../animation/AbstractAnimation';
import TimeAnimation from '../animation/TimeAnimation';
import { LOAD, META } from '../refresh/refreshEvent';

class Lottie extends Node {
  private _src?: string;
  private _json?: any;
  private _lottie?: any;
  private canvas?: HTMLCanvasElement;
  onMeta?: (o: LottieMeta) => void;
  onLoad?: () => void;
  private _currentTime: number;
  private _metaData?: LottieMeta;
  timeAnimation?: TimeAnimation;

  constructor(props: LottieProps) {
    super(props);
    if (props.onMeta) {
      this.onMeta = props.onMeta;
    }
    if (props.onLoad) {
      this.onLoad = props.onLoad;
    }
    this._currentTime = props.currentTime || 0;
    const cb = () => {
      // @ts-ignore
      const lottie = window.lottie as any;
      if (!lottie) {
        throw new Error('Missing lottie-web library');
      }
      this._metaData = {
        duration: this._json!.op * 1e3 / this._json!.fr,
      };
      this.contentLoadingNum = 0;
      if (this.onMeta) {
        this.onMeta(this._metaData);
      }
      this.emit(META, this._metaData);
      const div = document.createElement('div');
      div.style.width = this._json!.w + 'px';
      div.style.height = this._json!.h + 'px';
      div.style.position = 'fixed';
      div.style.visibility = 'hidden';
      div.style.transform = 'translate(9999px, 9999px)';
      div.style.pointerEvents = 'none';
      document.body.appendChild(div);
      const instance = this._lottie = lottie.loadAnimation({
        container: div,
        renderer: 'canvas',
        loop: true,
        autoplay: true,
        animationData: this._json,
        rendererSettings: {
          preserveDrawingBuffer: true,
        },
      });
      instance.addEventListener('DOMLoaded', () => {
        this.canvas = div.querySelector('canvas') as HTMLCanvasElement;
        if (this._currentTime >= 0 && this._currentTime < this._metaData!.duration) {
          instance.goToAndStop(this._currentTime);
        }
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
      });
    };
    if (props.src) {
      this._src = props.src;
      if (this._currentTime >= 0) {
        this.contentLoadingNum = 1;
      }
      fetch(props.src, props.options).then(res => {
        return res.json();
      }).then(res => {
        this._json = res;
        cb();
      });
    }
    else if (props.json) {
      this._json = props.json;
      cb();
    }
    else {
      throw new Error('Missing src or json in Lottie');
    }
  }

  // 自适应尺寸情况下使用图片本身的尺寸，只定义了一方的情况下使用等比
  override lay(data: LayoutData) {
    super.lay(data);
    const { style, computedStyle, _json } = this;
    const { left, top, right, bottom, width, height } = style;
    if (_json) {
      const autoW = (left.u === StyleUnit.AUTO || right.u === StyleUnit.AUTO) && width.u === StyleUnit.AUTO;
      const autoH = (top.u === StyleUnit.AUTO || bottom.u === StyleUnit.AUTO) && height.u === StyleUnit.AUTO;
      if (autoW) {
        if (autoH) {
          computedStyle.width = _json.w;
        }
        else {
          computedStyle.width = _json.w * computedStyle.height / _json.h;
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
          computedStyle.height = _json.h;
        }
        else {
          computedStyle.height = _json.h * computedStyle.width / _json.w;
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

  override calContent() {
    this.hasContent = false;
    if (this._metaData) {
      if (this._currentTime >= 0 && this._currentTime < this._metaData.duration) {
        this.hasContent = true;
      }
    }
    else {
      this.hasContent = this.computedStyle.backgroundColor[3] > 0;
    }
    return this.hasContent;
  }

  override renderCanvas() {
    const { _json, _currentTime, _metaData, canvas, computedStyle } = this;
    super.renderCanvas();
    const bbox = this._bboxInt || this.bboxInt;
    const x = bbox[0],
      y = bbox[1];
    let w = bbox[2] - x,
      h = bbox[3] - y;
    let dx = 0, dy = 0;
    let { width, height, objectFit } = computedStyle;
    if (_json && canvas && _metaData && _currentTime >= 0 && _currentTime < _metaData.duration) {
      const ratio = _json.w / _json.h;
      const ratio2 = width / height;
      if (objectFit === OBJECT_FIT.CONTAIN) {
        if (ratio2 > ratio) {
          const w = height * ratio;
          const d = (width - w) * 0.5;
          dx += d;
          width = w;
        }
        else if (ratio2 < ratio) {
          const h = width / ratio;
          const d = (height - h) * 0.5;
          dy += d;
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
    const canvasCache = (this.canvasCache = new CanvasCache(w, h, -x, -y));
    canvasCache.available = true;
    const list = canvasCache.list;
    if (computedStyle.backgroundColor[3] > 0) {
      const coords = this.getBackgroundCoords(x, y);
      list.forEach(item => {
        const { x, y, os: { ctx } } = item;
        ctx.fillStyle = color2rgbaStr(computedStyle.backgroundColor);
        ctx.beginPath();
        canvasPolygon(ctx, coords, -x, -y);
        ctx.closePath();
        ctx.fill();
      });
    }
    for (let i = 0, len = list.length; i < len; i++) {
      const { x, y, os: { ctx } } = list[i];
      const dx2 = -x;
      const dy2 = -y;
      if (canvas) {
        ctx.drawImage(canvas, dx2 + dx, dy2 + dy, width, height);
      }
    }
  }

  override calContentLoading() {
    const res = super.calContentLoading();
    if (res) {
      if (this._currentTime >= 0 && this._metaData && this._currentTime < this._metaData.duration) {
        return res;
      }
      return 0;
    }
    return res;
  }

  override release() {
    super.release();
    const { lottie } = this;
    if (lottie) {
      lottie.destroy();
    }
  }

  timeAnimate(start: number, options: Options & {
    autoPlay?: boolean;
  }) {
    this.timeAnimation?.remove();
    const animation = this.timeAnimation = new TimeAnimation(this, start, options);
    return this.initAnimate(animation, options);
  }

  get src() {
    return this._src;
  }

  get json() {
    return this._json;
  }

  get currentTime() {
    return this._currentTime;
  }

  set currentTime(v: number) {
    if (this._currentTime !== v) {
      this._currentTime = v;
      const { _lottie } = this;
      if (_lottie) {
        _lottie.goToAndStop(v);
        this.refresh();
      }
    }
  }

  get duration() {
    return this._metaData?.duration || 0;
  }

  get metaData() {
    return this._metaData;
  }

  get lottie() {
    return this._lottie;
  }
}

export default Lottie;
