import Event from '../util/Event';
import Node from '../node/Node';
import { isFunction } from '../util/type';
import easing from './easing';
import { BEGIN, END, FRAME } from './animationEvent';

export type Options = {
  duration: number;
  direction?: 'forwards' | 'backwards' | 'alternate' | 'alternateReverse';
  fill?: 'none' | 'forwards' | 'backwards' | 'both';
  delay?: number;
  endDelay?: number;
  easing?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | number[] | ((v: number) => number);
  iterations?: number;
  iterationStart?: number;
  playbackRate?: number;
  autoPlay?: boolean;
  fps?: number;
};

abstract class AbstractAnimation extends Event {
  node: Node;
  duration: number;
  direction: 'forwards' | 'backwards' | 'alternate' | 'alternateReverse';
  fill: 'none' | 'forwards' | 'backwards' | 'both';
  delay: number;
  endDelay: number;
  easing?: (v: number) => number;
  iterations: number;
  playbackRate: number;
  fps: number;
  spf: number;
  autoPlay?: boolean;
  protected skipFrame: boolean;
  protected lastCurrentTime: number;
  protected _currentTime: number;
  protected time: number; // 去除delay和playCount的时间
  protected _playCount: number;
  protected _playState: 'idle' | 'running' | 'paused' | 'finished';
  protected isBegin: boolean; // 忽略delay每轮开始标识，触发事件用
  protected isEnd: boolean; // 忽略endDelay最后一轮结束标识，触发事件用
  protected isFirstInDelay: boolean; // 首次进入delay时标识

  constructor(node: Node, options: Options) {
    super();
    this.node = node;
    this.duration = options.duration || 0;
    this.direction = options.direction || 'forwards';
    this.fill = options.fill || 'none';
    this.delay = Math.max(0, options.delay || 0);
    this.endDelay = Math.max(0, options.endDelay || 0);
    if (options.easing) {
      if (isFunction(options.easing)) {
        this.easing = options.easing as (v: number) => number;
      }
      else if (Array.isArray(options.easing)) {
        this.easing = easing.getEasing(options.easing as number[]);
      }
      else {
        this.easing = easing[options.easing as 'linear' | 'easeIn' | 'easeOut' | 'easeInOut'];
      }
    }
    this.iterations = options.iterations || 1;
    this.playbackRate = options.playbackRate || 1;
    this.fps = options.fps || Infinity;
    this.spf = 1000 / this.fps; // 默认0
    this.autoPlay = options.autoPlay;
    this.skipFrame = false;
    this.lastCurrentTime = 0;
    this._currentTime = 0;
    this.time = 0;
    this._playCount = options.iterationStart || 0;
    this._playState = 'idle';
    this.isBegin = this._playCount === 0 && !this.delay;
    this.isEnd = false;
    this.isFirstInDelay = true;
  }

  play() {
    const playState = this._playState;
    if (playState === 'running') {
      return;
    }
    // 每次重新播放需重置，第一次进入delay标识
    if (playState === 'finished' || playState === 'idle') {
      this._playCount = 0;
      this.lastCurrentTime = 0;
      this._currentTime = 0;
      this.skipFrame = false;
      this.time = 0;
      this.isBegin = !this.delay;
      this.isEnd = false;
      this.isFirstInDelay = true;
    }
    this._playState = 'running';
    this.node.root?.addAnimation(this);
  }

  pause() {
    if (this._playState === 'paused') {
      return;
    }
    this._playState = 'paused';
    this.node.root?.removeAnimation(this);
  }

  resume() {
    if (this._playState !== 'paused') {
      return;
    }
    this._playState = 'running';
    this.node.root?.addAnimation(this);
  }

  finish() {
    if (this._playState === 'finished') {
      return;
    }
    this._playCount = this.iterations;
    this._currentTime = this.delay + this.duration * this._playCount + this.endDelay;
    this.time = this.duration + this.endDelay;
    this._playState = 'finished';
    this.node.root?.removeAnimation(this);
  };

  cancel() {
    if (this._playState === 'idle') {
      return;
    }
    this._playCount = 0;
    this._currentTime = 0;
    this.time = 0;
    this._playState = 'idle';
    this.node.root?.removeAnimation(this);
  };

  remove() {
    this.cancel();
    const animationList = this.node.animationList;
    const i = animationList.indexOf(this);
    if (i > -1) {
      animationList.splice(i, 1);
    }
    this.node.root?.aniController.removeAni(this);
  }

  gotoAndPlay(v: number) {
    if (this._currentTime === v && this._playState === 'running') {
      return;
    }
    this.play();
    const old = this._currentTime;
    this.currentTime = v;
    this.onRunning(0, old);
  };

  gotoAndStop(v: number) {
    if (this._currentTime === v && this._playState === 'paused') {
      return;
    }
    this.pause();
    const old = this._currentTime;
    this.currentTime = v;
    this.onRunning(0, old);
  };

  onRunning(delta: number, old?: number) {
    const { playbackRate, delay, endDelay, duration, iterations } = this;
    // 可能有变速情况，先处理当前播放时间currentTime
    if (playbackRate > 0 && playbackRate !== 1) {
      delta *= playbackRate;
    }
    old = old ?? this._currentTime;
    let time = this._currentTime += delta;
    if (this.spf && time - this.lastCurrentTime < this.spf) {
      this.skipFrame = true;
      return;
    }
    this.skipFrame = false;
    this.lastCurrentTime = time;
    if (delay && time < delay) {
      if (this.isFirstInDelay) {
        this.onFirstInDelay();
      }
      return;
    }
    // 真正开始播放后，可能会goto跳到delay，此时还需重新触发onFirstInDelay()样式
    this.isFirstInDelay = false;
    // 首轮进入真正播放时间，如果没有delay，则初始化时isBegin是true
    if (delay && old < delay && time >= delay) {
      this.isBegin = true;
    }
    time -= delay;
    // 播放了几轮次数，有可能卡很久导致这一帧时差非常大一下过了好几轮，所以取min限制
    const playCount = Math.min(iterations - 1, Math.floor(time / duration));
    time -= duration * playCount;
    this.time = time;
    // 超过一轮时间进入下一轮，需要重新确定方向
    if (this._playCount < playCount) {
      this._playCount = playCount;
      this.onChangePlayCount();
      this.isBegin = true;
    }
    const isLastCount = this._playCount >= iterations - 1;
    if (isLastCount) {
      old -= delay;
      old -= duration * playCount;
      if (endDelay && old < duration && time >= duration && time < duration + endDelay) {
        this.onFirstInEndDelay();
      }
      if (old < duration && time >= duration) {
        this.isEnd = true;
      }
      if (time >= duration + endDelay) {
        this.finish();
      }
    }
  };

  afterRunning() {
    this.emit(FRAME);
    if (this.isFirstInDelay) {
      this.isFirstInDelay = false;
    }
    if (this.isBegin) {
      this.isBegin = false;
      this.emit(BEGIN, this._playCount, this.time);
    }
    if (this.isEnd) {
      this.isEnd = false;
      this.emit(END);
    }
  }

  abstract onFirstInDelay(): void;

  abstract onFirstInEndDelay(): void;

  abstract onChangePlayCount(): void;

  get currentTime() {
    return this._currentTime;
  }

  set currentTime(v: number) {
    const old = this._currentTime;
    if (v !== old) {
      const delay = this.delay;
      this.lastCurrentTime = this._currentTime = v;
      const t = old - delay;
      this.time = t % this.duration;
      if (v <= delay) {
        this.isBegin = true;
      }
      if (old >= delay && v < delay) {
        this.isFirstInDelay = true;
      }
    }
  }

  get playCount() {
    return this._playCount;
  }

  set playCount(v: number) {
    if (v !== this._playCount) {
      const old = this._currentTime;
      const delay = this.delay;
      // 保持当前轮次播放的时间不变：当前时间去除delay和轮次后的播放时间，再*新轮次
      if (old >= delay) {
        const t = old - delay;
        const n = t % this.duration;
        this.currentTime = n + delay + v * this.duration;
        this.time = n;
      }
      else {
        // 还在delay中无需处理
      }
      this._playCount = v;
    }
  }

  get playState() {
    return this._playState;
  }

  get pending() {
    return this._playState !== 'running';
  }
}

export default AbstractAnimation;
