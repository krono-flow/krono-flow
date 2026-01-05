import Node from './Node'
import { AudioProps } from '../format';
import { LoadAudioRes } from '../util/loadAudio';
import { Options } from '../animation/AbstractAnimation';
import TimeAnimation from '../animation/TimeAnimation';
import { GOPState, MbVideoDecoder, MbVideoDecoderEvent, VideoAudioMeta } from '../util/MbVideoDecoder';
import inject from '../util/inject';
import { CAN_PLAY, ERROR, META, WAITING } from '../refresh/refreshEvent';

class Audio extends Node {
  private _src: string;
  loader?: LoadAudioRes;
  onMeta?: (o: VideoAudioMeta) => void;
  onCanplay?: () => void;
  onError?: (e: string) => void;
  onWaiting?: () => void;
  audioBufferSourceNode?: AudioBufferSourceNode;
  gainNode?: GainNode;
  private _decoder?: MbVideoDecoder;
  private _currentTime: number;
  private _metaData?: VideoAudioMeta;
  private _volumn: number;
  timeAnimation?: TimeAnimation;

  constructor(props: AudioProps) {
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
    const src = (this._src = props.src || '');
    if (src) {
      if (this._currentTime >= 0) {
        this.contentLoadingNum = 1;
      }
      const mbVideoDecoder = this._decoder = new MbVideoDecoder(src);
      mbVideoDecoder.on(MbVideoDecoderEvent.META, e => {
        this._metaData = e;
        if (this._currentTime >= 0 && this._currentTime <= e.duration) {
          this.contentLoadingNum = 1;
        }
        else {
          this.contentLoadingNum = 0;
        }
        if (this.onMeta) {
          this.onMeta(e);
        }
        this.emit(META);
      });
      mbVideoDecoder.on(MbVideoDecoderEvent.ERROR, e => {
        inject.error(e);
        this.contentLoadingNum = 0;
        if (this.onError) {
          this.onError(e);
        }
        this.emit(ERROR);
        this.refresh();
      });
      mbVideoDecoder.on(MbVideoDecoderEvent.CANPLAY, gop => {
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
    const { loader, audioBufferSourceNode, gainNode } = this;
    if (loader?.success) {
      loader.release();
    }
    if (audioBufferSourceNode) {
      audioBufferSourceNode.stop();
      audioBufferSourceNode.disconnect();
      this.audioBufferSourceNode = undefined;
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

  get src() {
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
        const old = decoder.currentGOP;
        decoder.start(s);
        const now = decoder.currentGOP;
        if (!now?.audioBuffer && now?.state === GOPState.DECODING && v >= 0 && !decoder.error) {
          if (this._metaData && v < this._metaData.duration) {
            this.contentLoadingNum = 1;
          }
          else {
            this.contentLoadingNum = 1;
          }
        }
        if (old?.audioBuffer && !now?.audioBuffer && this._metaData && v >= 0 && v < this._metaData.duration && !decoder.error) {
          if (this.onWaiting) {
            this.onWaiting();
          }
          this.emit(WAITING);
        }
      }
    }
  }

  get duration() {
    return this.loader?.duration || 0;
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
}

export default Audio;
