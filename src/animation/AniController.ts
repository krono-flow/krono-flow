import Event from '../util/Event';
import AbstractAnimation from './AbstractAnimation';
import TimeAnimation from './TimeAnimation';
import Audio from '../node/Audio';
import Video from '../node/Video';

class AniController extends Event {
  aniList: AbstractAnimation[];
  audioContext?: AudioContext;

  constructor(audioContext?: AudioContext) {
    super();
    this.aniList = [];
    this.audioContext = audioContext;
  }

  addAni(animation: AbstractAnimation) {
    if (this.aniList.indexOf(animation) === -1) {
      this.aniList.push(animation);
      if (this.aniList.length === 1) {
        this.checkEvent();
      }
    }
  }

  removeAni(animation: AbstractAnimation) {
    const i = this.aniList.indexOf(animation);
    if (i > -1) {
      this.aniList.splice(i, 1);
      if (i === 0) {
        this.checkEvent();
      }
    }
  }

  play() {
    this.aniList.forEach(item => {
      item.play();
      checkPlayAudio(item);
    });
  }

  pause() {
    this.aniList.forEach(item => {
      item.pause();
      checkStopAudio(item);
    });
  }

  resume() {
    this.aniList.forEach(item => {
      item.resume();
      checkPlayAudio(item);
    });
  }

  finish() {
    this.aniList.forEach(item => {
      item.finish();
      checkStopAudio(item);
    });
  }

  cancel() {
    this.aniList.forEach(item => {
      item.cancel();
      checkStopAudio(item);
    });
  }

  gotoAndPlay(v: number) {
    this.aniList.forEach(item => {
      item.gotoAndPlay(v);
      checkPlayAudio(item);
    });
  }

  gotoAndStop(v: number) {
    this.aniList.forEach(item => {
      item.gotoAndStop(v);
      checkStopAudio(item);
    });
    this.aniList.forEach(item => {
      item.afterRunning();
    });
  }

  // 在没有添加动画前先侦听了事件，再添加动画，需要代理触发第0个的动画事件；或者移除了第0个动画后重新代理新的第0个动画事件
  private checkEvent() {
    const ani = this.aniList[0];
    if (ani) {
      Object.keys(this.__eHash).forEach(k => {
        const v = this.__eHash[k];
        v.forEach((handle: () => void) => {
          ani.on(k, handle);
        });
      });
    }
  }

  override on(id: string | string[], handle: (...p: any[]) => void) {
    super.on(id, handle);
    if (this.aniList.length) {
      this.aniList[0].on(id, handle);
    }
  }

  override once(id: string | string[], handle: (...p: any[]) => void) {
    super.once(id, handle);
    if (this.aniList.length) {
      this.aniList[0].once(id, handle);
    }
  }

  override off(id: string | string[], handle: (...p: any[]) => void) {
    super.off(id, handle);
    if (this.aniList.length) {
      this.aniList[0].off(id, handle);
    }
  }

  get currentTime() {
    const a = this.aniList[0];
    if (a) {
      return a.currentTime;
    }
    return 0;
  }

  set currentTime(v: number) {
    this.aniList.forEach(item => {
      item.currentTime = v;
    });
  }

  get duration() {
    const a = this.aniList[0];
    if (a) {
      return a.delay + a.duration + a.endDelay;
    }
    return 0;
  }

  get playCount() {
    const a = this.aniList[0];
    if (a) {
      return a.playCount;
    }
    return 0;
  }

  set playCount(v: number) {
    this.aniList.forEach(item => {
      item.playCount = v;
    });
  }

  get playState() {
    const a = this.aniList[0];
    if (a) {
      return a.playState;
    }
    return 'idle';
  }

  get pending() {
    const a = this.aniList[0];
    if (a) {
      return a.playState !== 'running';
    }
    return true;
  }
}

function checkPlayAudio(animation: AbstractAnimation) {
  // 进度条在当前显示区域后面就不需要播了，等于已经播完了
  if (animation.currentTime >= animation.delay + animation.duration) {
    return;
  }
  if (animation instanceof TimeAnimation) {
    const node = animation.node;
    if (!(node instanceof Audio) && !(node instanceof Video)) {
      return;
    }
    if (node.gainNode) {
      node.gainNode.disconnect();
      node.gainNode = undefined;
    }
    // video可能没有声音就没有AudioBuffer
    if (node.decoder) {
      const gop = node.decoder.currentGOP;
      if (gop?.audioBuffer && node.root && node.root.audioContext) {
        const audioContext = node.root!.audioContext;
        if (!node.gainNode) {
          node.gainNode = audioContext.createGain();
          node.gainNode.gain.value = node.volumn;
        }
        if (gop.audioBufferSourceNode) {
          try {
            gop.audioBufferSourceNode.stop();
          } catch(e) {}
          gop.audioBufferSourceNode.disconnect();
          gop.audioBufferSourceNode = undefined;
        }
        const audioBufferSourceNode = audioContext.createBufferSource();
        audioBufferSourceNode.buffer = gop.audioBuffer;
        audioBufferSourceNode.connect(node.gainNode);
        node.gainNode.connect(audioContext.destination);
        gop.audioBufferSourceNode = audioBufferSourceNode;
        const current = animation.currentTime - animation.delay;
        // 正常开头或者从gop中间播放
        if (current >= gop.audioTimestamp) {
          audioBufferSourceNode.start(
            0,
            (current - gop.audioTimestamp) * 1e-3,
            (animation.duration - current) * 1e-3,
          );
        }
        // 还没开始播放
        else {
          audioBufferSourceNode.start(
            audioContext.currentTime + (gop.audioTimestamp - current) * 1e-3,
            0,
            (animation.duration - gop.audioTimestamp) * 1e-3,
          );
        }
        // 后面的可能解码好了，在区域非常近的情况，都是等待播放不会立刻播放
        const gopList = node.decoder.gopList;
        for (let i = node.decoder.gopIndex + 1, len = gopList.length; i < len; i++) {
          const item = gopList[i];
          if (animation.duration <= item.timestamp) {
            return;
          }
          if (item.audioBufferSourceNode) {
            try {
              item.audioBufferSourceNode.stop();
            } catch(e) {}
            item.audioBufferSourceNode.disconnect();
            item.audioBufferSourceNode = undefined;
          }
          if (item.audioBuffer) {
            const audioBufferSourceNode = audioContext.createBufferSource();
            audioBufferSourceNode.buffer = item.audioBuffer;
            if (!node.gainNode) {
              node.gainNode = audioContext.createGain();
              node.gainNode.gain.value = node.volumn;
            }
            audioBufferSourceNode.connect(node.gainNode);
            node.gainNode.connect(audioContext.destination);
            item.audioBufferSourceNode = audioBufferSourceNode;
            // 最后一个可能因显示区域不播放完，如果反向显示区域更大，设置更长的duration也没事
            audioBufferSourceNode.start(
              audioContext.currentTime + (item.audioTimestamp - current) * 1e-3,
              0,
              (animation.duration - item.audioTimestamp) * 1e-3,
            );
          }
        }
      }
    }
  }
}

function checkStopAudio(animation: AbstractAnimation) {
  if (animation instanceof TimeAnimation) {
    const node = animation.node;
    if (!(node instanceof Audio) && !(node instanceof Video)) {
      return;
    }
    if (node.gainNode) {
      node.gainNode.disconnect();
      node.gainNode = undefined;
    }
    node.decoder?.gopList?.forEach(item => {
      try {
        item.audioBufferSourceNode?.stop();
      } catch(e) {}
      item.audioBufferSourceNode?.disconnect();
      item.audioBufferSourceNode = undefined;
    });
  }
}

export default AniController;
