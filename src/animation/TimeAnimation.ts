import AbstractAnimation, { Options } from './AbstractAnimation';
import Video from '../node/Video';
import Audio from '../node/Audio';
import Lottie from '../node/Lottie';
import { Visibility } from '../style/define';
import config from '../config';

class TimeAnimation extends AbstractAnimation {
  node: Video | Audio | Lottie;
  private _timeArea: [number, number];
  private _timeAreaR: [number, number];
  currentTimeArea: [number, number];
  originTime: number;

  constructor(node: Video | Audio | Lottie, start: number, options: Options) {
    super(node, options);
    this.node = node;
    this._timeArea = [start, start + this.duration];
    this._timeAreaR = this._timeArea.slice(0).reverse() as [number, number];
    this.currentTimeArea = this._timeArea;
    this.originTime = node.currentTime;
    this.setCurrentTimeArea();
  }

  private setCurrentTimeArea() {
    const { direction, _playCount } = this;
    if (direction === 'backwards') {
      this.currentTimeArea = this._timeArea;
    }
    else if (direction === 'alternate') {
      if (_playCount % 2 === 0) {
        this.currentTimeArea = this._timeAreaR;
      }
      else {
        this.currentTimeArea = this._timeArea;
      }
    }
    else if (direction === 'alternateReverse') {
      if (_playCount % 2 === 0) {
        this.currentTimeArea = this._timeArea;
      }
      else {
        this.currentTimeArea = this._timeAreaR;
      }
    }
    else {
      this.currentTimeArea = this._timeArea;
    }
  }

  override finish() {
    if (this._playState === 'finished') {
      return;
    }
    super.finish();
    this.onFirstInEndDelay();
  }

  override cancel() {
    if (this._playState === 'idle') {
      return;
    }
    super.cancel();
    this.node.currentTime = this.originTime;
  }

  override play() {
    super.play();
    const playState = this._playState;
    // 重新播放需设置
    if (playState === 'running' && !this._currentTime) {
      this.node.currentTime = 0;
    }
  }

  override onRunning(delta: number, old?: number) {
    super.onRunning(delta, old);
    const { node, duration, delay, iterations, currentTimeArea, time, skipFrame } = this;
    if (skipFrame) {
      return;
    }
    const currentTime = this._currentTime;
    // 如有delay则这段时间等待状态
    if (currentTime < delay) {
      node.currentTime = currentTime - delay;
      return;
    }
    const isLastCount = this._playCount >= iterations - 1;
    let percent = time / duration;
    if (this.easing) {
      percent = this.easing(percent);
    }
    // 最后结束特殊处理，onFirstInEndDelay()根据endDelay/fill决定是否还原还是停留最后一帧，超过DUR需清空
    if (isLastCount && percent >= 1) {
      if (node instanceof Video && time - duration >= config.releasePrevDuration && node.computedStyle.visibility === Visibility.HIDDEN) {
        node.decoder?.releaseGOPList();
        node.videoFrame = undefined;
      }
    }
    else {
      node.currentTime = Math.floor(currentTimeArea[0] + (currentTimeArea[1] - currentTimeArea[0]) * percent);
    }
  }

  onFirstInDelay() {
    const { fill, currentTimeArea, node } = this;
    if (fill === 'backwards' || fill === 'both') {
      node.currentTime = currentTimeArea[0];
    }
  }

  onFirstInEndDelay() {
    const { fill, node } = this;
    if (fill === 'forwards' || fill === 'both') {
      const currentTimeArea = this.currentTimeArea;
      node.currentTime = currentTimeArea[currentTimeArea.length - 1];
    }
    else {
      node.currentTime = this.originTime;
    }
  }

  onChangePlayCount() {
    this.setCurrentTimeArea();
  }

  get timeArea() {
    return this._timeArea.slice(0);
  }
}

export default TimeAnimation;
