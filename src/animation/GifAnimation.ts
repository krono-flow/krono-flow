import AbstractAnimation, { Options } from './AbstractAnimation';
import Bitmap from '../node/Bitmap';

class FrameAnimation extends AbstractAnimation {
  node: Bitmap;
  private _frameArea: [number, number];
  private _frameAreaR: [number, number];
  currentFrameArea: [number, number];
  originFrameIndex: number;

  constructor(node: Bitmap, frameArea: [number, number], options: Options) {
    super(node, options);
    this.node = node;
    this._frameArea = frameArea;
    this._frameAreaR = frameArea.slice(0).reverse() as [number, number];
    this.currentFrameArea = this._frameArea;
    this.originFrameIndex = node.frameIndex;
    this.setCurrentFrameArea();
  }

  private setCurrentFrameArea() {
    const { direction, _playCount } = this;
    if (direction === 'backwards') {
      this.currentFrameArea = this._frameAreaR;
    }
    else if (direction === 'alternate') {
      if (_playCount % 2 === 0) {
        this.currentFrameArea = this._frameArea;
      }
      else {
        this.currentFrameArea = this._frameAreaR;
      }
    }
    else if (direction === 'alternateReverse') {
      if (_playCount % 2 === 0) {
        this.currentFrameArea = this._frameAreaR;
      }
      else {
        this.currentFrameArea = this._frameArea;
      }
    }
    else {
      this.currentFrameArea = this._frameArea;
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
    this.node.frameIndex = this.originFrameIndex;
  }

  onRunning(delta: number) {
    super.onRunning(delta);
    const { node, duration, delay, iterations, currentFrameArea, time } = this;
    const currentTime = this._currentTime;
    // 如有delay则这段时间等待状态
    if (currentTime < delay) {
      return;
    }
    const isLastCount = this._playCount >= iterations - 1;
    let percent = time / duration;
    if (this.easing) {
      percent = this.easing(percent);
    }
    // 最后结束特殊处理，根据endDelay/fill决定是否还原还是停留最后一帧
    if (isLastCount && percent >= 1) {
    }
    else {
      node.frameIndex = Math.floor(currentFrameArea[0] + (currentFrameArea[1] - currentFrameArea[0]) * percent);
    }
  }

  onFirstInDelay() {
    const { fill, currentFrameArea, node } = this;
    if (fill === 'backwards' || fill === 'both') {
      node.frameIndex = currentFrameArea[0];
    }
  }

  onFirstInEndDelay() {
    const { fill, node } = this;
    if (fill === 'forwards' || fill === 'both') {
      const currentFrameArea = this.currentFrameArea;
      node.frameIndex = currentFrameArea[currentFrameArea.length - 1];
    }
    else {
      node.frameIndex = this.originFrameIndex;
    }
  }

  onChangePlayCount() {
    this.setCurrentFrameArea();
  }
}

export default FrameAnimation;
