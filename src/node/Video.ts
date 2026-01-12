import Node from './Node'
import { VideoProps } from '../format';
import TextureCache from '../refresh/TextureCache';
import { LayoutData } from '../refresh/layout';
import { OBJECT_FIT, StyleUnit, VISIBILITY } from '../style/define';
import { RefreshLevel } from '../refresh/level';
import CanvasCache from '../refresh/CanvasCache';
import { Options } from '../animation/AbstractAnimation';
import TimeAnimation from '../animation/TimeAnimation';
import config from '../config';
import { GOPState, MbVideoDecoder, MbVideoDecoderEvent, VideoAudioMeta } from '../codec/MbVideoDecoder';
import inject from '../util/inject';
import { CAN_PLAY, ERROR, META, WAITING } from '../refresh/refreshEvent';

class Video extends Node {
  private _src: string;
  isPure: boolean;
  onMeta?: (o: VideoAudioMeta) => void;
  onCanplay?: () => void;
  onError?: (e: string) => void;
  onWaiting?: () => void;
  gainNode?: GainNode;
  private _decoder?: MbVideoDecoder;
  private _videoFrame?: VideoFrame;
  private _currentTime: number;
  private _metaData?: VideoAudioMeta;
  private _volumn: number;
  timeAnimation?: TimeAnimation;

  constructor(props: VideoProps) {
    super(props);
    if (props.onMeta) {
      this.onMeta = props.onMeta;
    }
    if (props.onCanplay) {
      this.onCanplay = props.onCanplay;
    }
    if (props.onError) {
      this.onError = props.onError;
    }
    if (props.onWaiting) {
      this.onWaiting = props.onWaiting;
    }
    this._currentTime = props.currentTime || 0;
    this._volumn = Math.max(0, Math.min(1, props.volumn ?? 1));
    this.isPure = true;
    const src = (this._src = props.src || '');
    if (src) {
      if (this._currentTime >= 0) {
        this.contentLoadingNum = 1;
      }
      const mbVideoDecoder = this._decoder = new MbVideoDecoder(src);
      mbVideoDecoder.on(MbVideoDecoderEvent.META, e => {
        this._metaData = e;
        if (this._currentTime >= 0 && this._currentTime < e.duration) {
          this.contentLoadingNum = 1;
        }
        else {
          this.contentLoadingNum = 0;
        }
        // 自适应尺寸
        if (this.isMounted) {
          const { left, top, right, bottom, width, height } = this.style;
          if ((left.u === StyleUnit.AUTO || right.u === StyleUnit.AUTO) && width.u === StyleUnit.AUTO
            || (top.u === StyleUnit.AUTO || bottom.u === StyleUnit.AUTO) && height.u === StyleUnit.AUTO
          ) {
            this.refresh(RefreshLevel.REFLOW);
          }
        }
        if (this.onMeta) {
          this.onMeta(e);
        }
        this.emit(META, e);
      });
      mbVideoDecoder.on(MbVideoDecoderEvent.ERROR, e => {
        inject.error(e);
        this.contentLoadingNum = 0;
        if (this.onError) {
          this.onError(e);
        }
        this.emit(ERROR, e);
        this.refresh();
      });
      mbVideoDecoder.on(MbVideoDecoderEvent.CANPLAY, gop => {
        const frame = mbVideoDecoder.getFrameByTime(this._currentTime);
        this.videoFrame = frame;
        this.contentLoadingNum = 0;
        if (this.onCanplay) {
          this.onCanplay();
        }
        this.emit(CAN_PLAY);
        this.refresh();
      });
      mbVideoDecoder.on([MbVideoDecoderEvent.CANPLAY, MbVideoDecoderEvent.AUDIO_BUFFER], gop => {
        const root = this.root;
        if (!root || !gop.audioBuffer) {
          return;
        }
        const audioContext = root.audioContext;
        const timeAnimation = this.timeAnimation;
        if (timeAnimation?.playState === 'running' && audioContext) {
          const current = timeAnimation.currentTime - timeAnimation.delay;
          // 极端情况，解码好了但进度条已经过了
          if (current >= gop.timestamp + gop.duration || timeAnimation.duration <= gop.timestamp) {
            return;
          }
          const audioBufferSourceNode = audioContext.createBufferSource();
          audioBufferSourceNode.buffer = gop.audioBuffer;
          // 可能在结束后点击从头播放，此时没有数据
          if (!this.gainNode) {
            this.gainNode = audioContext.createGain();
            this.gainNode.gain.value = this.volumn;
            this.gainNode.connect(audioContext.destination);
          }
          audioBufferSourceNode.connect(this.gainNode);
          // 正常开头或者从gop中间播放
          if (current >= gop.audioTimestamp) {
            audioBufferSourceNode.start(
              0,
              (current - gop.audioTimestamp) * 1e-3,
              (timeAnimation.duration - current) * 1e-3,
            );
          }
          // 提前解码完成情况，delay计算延迟播放
          else {
            audioBufferSourceNode.start(
              audioContext.currentTime + (gop.audioTimestamp - current) * 1e-3,
              0,
              (timeAnimation.duration - gop.audioTimestamp) * 1e-3,
            );
          }
        }
      });
      mbVideoDecoder.start(this._currentTime);
    }
  }

  // 自适应尺寸情况下使用图片本身的尺寸
  override lay(data: LayoutData) {
    super.lay(data);
    const { style, computedStyle, _metaData } = this;
    const { left, top, right, bottom, width, height } = style;
    if (_metaData?.video) {
      const autoW = (left.u === StyleUnit.AUTO || right.u === StyleUnit.AUTO) && width.u === StyleUnit.AUTO;
      const autoH = (top.u === StyleUnit.AUTO || bottom.u === StyleUnit.AUTO) && height.u === StyleUnit.AUTO;
      if (autoW) {
        if (autoH) {
          computedStyle.width = _metaData.video.width;
        }
        else {
          computedStyle.width = _metaData.video.height * computedStyle.height / _metaData.video.height;
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
          computedStyle.height = _metaData.video.height;
        }
        else {
          computedStyle.height = _metaData.video.height * computedStyle.width / _metaData.video!.width;
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
    const { computedStyle, videoFrame } = this;
    this.isPure = computedStyle.backgroundColor[3] <= 0;
    // 注意圆角影响
    if (this.isPure && videoFrame) {
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
        const ratio = videoFrame.displayWidth / videoFrame.displayHeight;
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
    if (this._videoFrame || this.computedStyle.backgroundColor[3] > 0) {
      this.hasContent = true;
    }
    return this.hasContent;
  }

  override renderCanvas() {
    const { isPure, videoFrame, computedStyle } = this;
    // 纯视频
    if (isPure) {
      this.canvasCache?.release();
      // 超尺寸才使用canvas分块
      if (videoFrame && (videoFrame.displayWidth > config.maxTextureSize || videoFrame.displayHeight > config.maxTextureSize)) {
        const canvasCache = this.canvasCache = CanvasCache.getVideoFrameInstance(videoFrame.displayWidth, videoFrame.displayHeight, videoFrame);
        canvasCache.available = true;
        // 第一张图像才绘制，图片解码到canvas上
        if (canvasCache.getCount() === 1) {
          let { width, height, objectFit } = computedStyle;
          let dx = 0, dy = 0;
          const ratio = videoFrame.displayWidth / videoFrame.displayHeight;
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
    // 复合类型
    else {
      super.renderCanvas();
      const bbox = this._bboxInt || this.bboxInt;
      const x = bbox[0],
        y = bbox[1];
      let w = bbox[2] - x,
        h = bbox[3] - y;
      let dx = 0, dy = 0;
      let { width, height, objectFit } = computedStyle;
      if (videoFrame) {
        const ratio = videoFrame.displayWidth / videoFrame.displayHeight;
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
      const canvasCache = this.canvasCache = (this.canvasCache?.available ? this.canvasCache : new CanvasCache(w, h, -x, -y));
      canvasCache.available = true;
      const list = canvasCache.list;
      for (let i = 0, len = list.length; i < len; i++) {
        const { x, y, os: { ctx } } = list[i];
        const dx2 = -x;
        const dy2 = -y;
        if (videoFrame) {
          ctx.drawImage(videoFrame, dx2 + dx, dy2 + dy, width, height);
        }
      }
    }
  }

  override genTexture(gl: WebGL2RenderingContext | WebGLRenderingContext) {
    const { isPure, videoFrame, canvasCache } = this;
    if (isPure) {
      if (videoFrame) {
        if (videoFrame.displayWidth > config.maxTextureSize || videoFrame.displayHeight > config.maxTextureSize) {
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
          const ratio = videoFrame.displayWidth / videoFrame.displayHeight;
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
          const textureCache = TextureCache.getVideoFrameInstance(gl, videoFrame, r, tc);
          this.textureTarget = this.textureCache = textureCache;
        }
      }
    }
    else {
      super.genTexture(gl);
    }
  }

  override calContentLoading() {
    const res = super.calContentLoading();
    if (res) {
      if (this._currentTime >= 0) {
        if (this._metaData) {
          if (this._currentTime < this._metaData.duration) {
            return res;
          }
        }
        else {
          return res;
        }
      }
      return 0;
    }
    return res;
  }

  override release() {
    super.release();
    const { _decoder, gainNode } = this;
    if (_decoder) {
      _decoder.release();
    }
    if (gainNode) {
      gainNode.disconnect();
      this.gainNode = undefined;
    }
  }

  timeAnimate(start: number, options: Options & {
    autoPlay?: boolean;
  }) {
    this.timeAnimation?.remove();
    const animation = this.timeAnimation = new TimeAnimation(this, start, options);
    return this.initAnimate(animation, options);
  }

  override cloneProps() {
    const props = super.cloneProps() as VideoProps;
    props.src = this._src;
    props.currentTime = this._currentTime;
    props.volumn = this._volumn;
    return props;
  }

  override clone() {
    const props = this.cloneProps();
    const res = new Video(props);
    return res;
  }

  get src () {
    return this._src;
  }

  get currentTime() {
    return this._currentTime;
  }

  set currentTime(v: number) {
    if (this._currentTime !== v) {
      this._currentTime = v;
      const decoder = this._decoder;
      if (decoder) {
        const s = v;
        decoder.start(s);
        const old = this._videoFrame;
        const frame = decoder.getFrameByTime(s);
        this.videoFrame = frame;
        this.contentLoadingNum = 0;
        if (!frame && decoder.currentGOP?.state === GOPState.DECODING && v >= 0 && !decoder.error) {
          if (this._metaData && v < this._metaData.duration) {
            this.contentLoadingNum = 1;
          }
          // 没有metaData也认为在加载中，加载meta之后会重新判断
          else {
            this.contentLoadingNum = 1;
          }
        }
        if (old && !frame && this._metaData && v >= 0 && v < this._metaData.duration && !decoder.error) {
          if (this.onWaiting) {
            this.onWaiting();
          }
          this.emit(WAITING);
        }
      }
    }
  }

  get duration() {
    return this._metaData?.duration || 0;
  }

  get metaData() {
    return this._metaData;
  }

  get volumn() {
    return this._volumn;
  }

  set volumn(v: number) {
    const n = Math.max(0, Math.min(1, v));
    if (this._volumn !== n) {
      this._volumn = n;
      if (this.gainNode) {
        this.gainNode.gain.value = n;
      }
    }
  }

  get decoder() {
    return this._decoder;
  }

  get videoFrame(): VideoFrame | undefined {
    return this._videoFrame;
  }

  set videoFrame(v: VideoFrame | undefined) {
    if (this._videoFrame !== v) {
      this._videoFrame = v;
      this.refresh();
    }
  }
}

export default Video;
