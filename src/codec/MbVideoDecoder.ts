import {
  AudioChunk,
  Cache,
  CacheGOP,
  CacheState,
  DecoderMessageEvent,
  DecoderMessageType,
  GOPState,
  VideoDecoderEvent,
  SimpleGOP,
} from './define';
import { onMessage } from '../decoder';
import config from '../config';
import AbstractDecoder from './AbstractDecoder';

const HASH: Record<string, Cache> = {};

let worker: Worker;
let messageId = 0;

export class MbVideoDecoder extends AbstractDecoder {
  onMessage?: Function;

  constructor(url: string) {
    super(url);
  }

  initWorker() {
    if (worker) {
      return;
    }
    if (config.decoderWorker) {
      worker = new Worker(config.decoderWorker);
    }
    else if (config.decoderWorkerStr) {
      const blob = new Blob([config.decoderWorkerStr.trim()], { 'type': 'application/javascript' });
      const url = URL.createObjectURL(blob);
      worker = new Worker(url);
    }
    const onMessage = (e: MessageEvent<{
      url: string,
      id: number,
      type: DecoderMessageEvent,
      data: any,
    }>) => {
      if (!e?.data) {
        return;
      }
      const { url, type, data } = e.data;
      // console.log('main', url, type, data);
      const cache = HASH[url];
      // 预防，应该不会，除非release()了
      if (!cache) {
        return;
      }
      if (type === DecoderMessageEvent.META) {
        cache.state = CacheState.META;
        cache.meta = data.meta;
        cache.gopList = data.simpleGOPList.map((item: SimpleGOP) => {
          return {
            ...item,
            state: GOPState.NONE,
            videoFrames: [],
            users: [],
          };
        });
        cache.metaList.splice(0).forEach(item => {
          // 设置gopIndex
          item.start(item.currentTime);
          item.emit(VideoDecoderEvent.META, data.meta);
        });
      }
      // 一个gop解码完成
      else if (type === DecoderMessageEvent.DECODED) {
        const gop = cache.gopList[data.index];
        if (gop) {
          gop.state = GOPState.DECODED;
          // 上一帧的结果清理（不移除user），一般已经清理过了，这里兜底
          gop.videoFrames.forEach(item => item.close());
          gop.audioBufferSourceNode?.stop();
          gop.audioBufferSourceNode?.disconnect();
          gop.audioBuffer = undefined;
          // 新资源
          gop.videoFrames = data.videoFrames;
          if (data.audioChunks?.length) {
            const totalFrames = data.audioChunks.reduce((sum: number, item: AudioChunk) => sum + item.numberOfFrames, 0);
            const audioContext = new OfflineAudioContext(
              data.audioChunks[0].numberOfChannels,
              totalFrames,
              data.sampleRate,
            );
            const audioBuffer = audioContext.createBuffer(data.audioChunks[0].channels.length, totalFrames, data.sampleRate);
            let offset = 0;
            data.audioChunks.forEach((item: AudioChunk) => {
              for (let ch = 0; ch < item.channels.length; ch++) {
                const channelData = audioBuffer.getChannelData(ch);
                channelData.set(item.channels[ch], offset);
              }
              offset += item.numberOfFrames;
            });
            gop.audioBuffer = audioBuffer;
          }
          gop.users.forEach(item => {
            if (item.gopIndex === gop.index) {
              item.emit(VideoDecoderEvent.CANPLAY, gop);
            }
            // 后续的gop音频添加通知
            if (gop.audioBuffer && item.gopIndex < gop.index) {
              item.emit(VideoDecoderEvent.AUDIO_BUFFER, gop);
            }
          });
        }
      }
      else if (type === DecoderMessageEvent.ERROR) {
        cache.metaList.forEach(item => {
          item.error = true;
          item.emit(VideoDecoderEvent.ERROR, data);
        });
      }
    };
    if (worker) {
      worker.onmessage = onMessage;
    }
    else {
      this.onMessage = onMessage;
    }
  }

  /**
   * 统一开始解码入口，自动根据状态进行初始化、加载、meta、解码等操作，
   * range加载情况下还会优化当前区域索引等，负责worker的唯一初始化和通信逻辑。
   * @param time
   */
  start(time: number) {
    this.initWorker();
    this.currentTime = time;
    const { url, id } = this;
    const cache = HASH[url];
    if (cache) {
      // 重复设置currentTime，还在读meta要忽略
      if (cache.state === CacheState.LOADING_META) {
        if (!cache.metaList.includes(this)) {
          cache.metaList.push(this);
          cache.loadList.push(this);
          cache.count++;
        }
      }
      else if (cache.state === CacheState.META) {
        // 无论是整体加载还是分段加载，所有的都存入loadList一起处理
        if (!cache.loadList.includes(this)) {
          cache.loadList.push(this);
          cache.count++;
          this.emit(VideoDecoderEvent.META, cache.meta);
        }
        this.process(time);
      }
      else if (cache.state === CacheState.ERROR) {
        this.emit(VideoDecoderEvent.ERROR, cache.error);
      }
      return;
    }
    HASH[url] = {
      state: CacheState.LOADING_META,
      metaList: [this],
      loadList: [this],
      meta: {
        duration: 0,
        fileSize: 0,
      },
      gopList: [],
      singleHash: {},
      count: 1,
    };
    const mes = {
      url,
      id,
      type: DecoderMessageType.META,
      messageId: messageId++,
      isWorker: !!config.decoderWorker || !!config.decoderWorkerStr,
      indexedDB: config.indexedDB,
      preloadAll: config.preloadAll,
      gopMinDuration: config.gopMinDuration,
    };
    if (worker) {
      worker.postMessage(mes);
    }
    else {
      onMessage({ data: mes } as any).then(res => {
        this.onMessage && this.onMessage(res);
      });
    }
  }

  /**
   * 开始处理解码逻辑，当区域加载已完成时调用，会根据策略自动释放不需要部分的帧数据，
   * 加载解码后续即将播放的区域，不需要的地方也会取消加载（如有）。
   * @param time
   */
  protected process(time: number) {
    if (time < -config.decodeNextDuration) {
      this.releaseGOPList();
      return;
    }
    const cache = HASH[this.url];
    // 理论不会，预防被回收
    if (!cache || cache.state === CacheState.NONE || cache.state === CacheState.LOADING_META) {
      return;
    }
    const duration = cache.meta.duration;
    const gopList = cache.gopList;
    if (!gopList.length) {
      return;
    }
    if (time >= duration + config.decodeNextDuration) {
      this.releaseGOPList();
      return;
    }
    // 查找最近前置关键帧，从关键帧开始解析，直到下一个关键帧为止
    const gopIndex = this.getForwardsNearestGOPIndex(time);
    this.gopIndex = gopIndex;
    const gop = gopList[gopIndex];
    if (!gop) {
      return;
    }
    this.decodeGOP(gop);
    // 视频不停播放，currentTime不断更新调用，向后看currentTime+DUR以内的FramesArea也需要预加载，
    // 向前看currentTime-DUR以外的FramesArea释放清空，另外可能时间轴会跳跃任意值，向后看currentTime+DUR以外的也释放清空
    for (let i = gopIndex - 1; i >= 0; i--) {
      const gop = gopList[i];
      if (gop && ((gop.timestamp + gop.duration) < (time - config.releasePrevDuration))) {
        this.releaseGOP(gop);
      }
    }
    for (let i = gopIndex + 1, len = gopList.length; i < len; i++) {
      const gop = gopList[i];
      if (gop && gop.timestamp < (time + config.decodeNextDuration)) {
        this.decodeGOP(gop);
      }
      else if (gop && gop.timestamp >= (time + config.decodeNextDuration)) {
        this.releaseGOP(gop);
      }
    }
  }

  protected getForwardsNearestGOPIndex(time: number) {
    const cache = HASH[this.url];
    const duration = cache.meta.duration;
    const gopList = cache.gopList;
    // 超过duration+1e-3限制为空，为了防止精度计算导致最后一帧时间不太准确找不到正确索引
    if (time < -config.decodeNextDuration || !gopList.length || time > duration + 1e-3) {
      return -1;
    }
    if (gopList.length === 1 || time <= 0) {
      return 0;
    }
    if (time > duration) {
      return gopList.length - 1;
    }
    let i = 0, j = gopList.length - 1;
    while (i < j) {
      if (i === j - 1) {
        const timestamp = gopList[j].timestamp;
        if (timestamp <= time) {
          return j;
        }
        return i;
      }
      const mid = i + ((j - i) >> 1);
      const timestamp = gopList[mid].timestamp;
      if (timestamp === time) {
        return mid;
      }
      if (timestamp > time) {
        j = Math.max(mid - 1, i + 1);
      }
      else {
        i = Math.min(mid, j - 1);
      }
    }
    return -1;
  }

  getFrameByTime(time: number) {
    const cache = HASH[this.url];
    const duration = cache.meta.duration;
    const gopList = cache.gopList;
    // 精度计算或者时间轴时长问题，duration给个误差，最后获取帧内容自动兜底
    if (time < 0 || !gopList.length || time > duration + 1e-3) {
      return;
    }
    let gop: CacheGOP | undefined;
    if (gopList.length === 1) {
      gop = gopList[0];
    }
    else {
      const i = this.getForwardsNearestGOPIndex(time);
      if (i > -1) {
        gop = gopList[i];
      }
    }
    if (!gop) {
      return;
    }
    // 普通模式2分查找
    if (gop.state === GOPState.DECODED) {
      const list = gop.videoFrames;
      if (!list.length) {
        return;
      }
      if (list.length === 1) {
        return list[0];
      }
      let i = 0, j = list.length - 1;
      while (i < j) {
        if (i === j - 1) {
          const item = list[j];
          const timestamp = item.timestamp * 1e-3;
          if (timestamp <= time) {
            return item;
          }
          return list[i];
        }
        const mid = i + ((j - i) >> 1);
        const item = list[mid];
        const timestamp = item.timestamp * 1e-3;
        if (timestamp === time || timestamp < time && (timestamp + (item.duration || 0) * 1e-3) > time) {
          return list[mid];
        }
        if (timestamp > time) {
          j = Math.max(mid - 1, i + 1);
        }
        else {
          i = Math.min(mid, j - 1);
        }
      }
    }
  }

  protected decodeGOP(gop: CacheGOP) {
    if (gop.state === GOPState.ERROR) {
      return;
    }
    let isNewer = false;
    if (!gop.users.includes(this)) {
      isNewer = true;
      gop.users.push(this);
    }
    // 线程异步可能别的gop解码完成了，也可能自己解码完成，播放时不停调用
    if (gop.state === GOPState.DECODED) {
      if (isNewer) {
        this.emit(VideoDecoderEvent.CANPLAY, gop);
      }
      return;
    }
    // 剩下只有可能NONE或者DECODING状态了，去重记录发起方id
    if (gop.state === GOPState.DECODING) {
      return;
    }
    gop.state = GOPState.DECODING;
    gop.videoFrames.splice(0).forEach(item => item.close());
    if (gop.audioBufferSourceNode) {
      gop.audioBufferSourceNode.stop();
      gop.audioBufferSourceNode.disconnect();
      gop.audioBufferSourceNode = undefined;
    }
    gop.audioBuffer = undefined;
    const mes = {
      url: this.url,
      type: DecoderMessageType.DECODE,
      id: this.id,
      messageId: messageId++,
      isWorker: !!config.decoderWorker || !!config.decoderWorkerStr,
      index: gop.index,
      mute: config.mute,
    };
    if (worker) {
      worker.postMessage(mes);
    }
    else {
      onMessage({ data: mes } as any).then(res => {
        this.onMessage && this.onMessage(res);
      });
    }
  }

  protected releaseGOP(gop: CacheGOP) {
    const i = gop.users.indexOf(this);
    if (i > -1) {
      gop.users.splice(i, 1);
      if (!gop.users.length) {
        // 可能还在加载中，只有解码状态才会切回LOADED
        if (gop.state === GOPState.DECODING || gop.state === GOPState.DECODED) {
          gop.state = GOPState.NONE;
        }
        gop.videoFrames.splice(0).forEach(frame => frame.close());
        gop.audioBufferSourceNode?.stop();
        gop.audioBufferSourceNode?.disconnect();
        gop.audioBuffer = undefined;
      }
      const mes = {
        url: this.url,
        type: DecoderMessageType.RELEASE,
        id: this.id,
        index: gop.index,
        messageId: messageId++,
        isWorker: !!config.decoderWorker || !!config.decoderWorkerStr,
      };
      if (worker) {
        worker.postMessage(mes);
      }
      else {
        onMessage({ data: mes } as any).then(res => {
          this.onMessage && this.onMessage(res);
        });
      }
    }
  }

  releaseGOPList() {
    const cache = HASH[this.url];
    cache.gopList.forEach(item => {
      this.releaseGOP(item);
    });
  }

  release() {
    this.releaseGOPList();
    const cache = HASH[this.url];
    if (!cache) {
      throw new Error('Unknown release url: ' + this.url);
    }
    let i = cache.metaList.indexOf(this);
    if (i > -1) {
      cache.metaList.splice(i, 1);
    }
    i = cache.loadList.indexOf(this);
    if (i > -1) {
      cache.loadList.splice(i, 1);
    }
    cache.count--;
    if (!cache.count) {
      delete HASH[this.url];
    }
  }

  get gopList() {
    return HASH[this.url]?.gopList;
  }

  get currentGOP() {
    return HASH[this.url]?.gopList[this.gopIndex];
  }
}

export default MbVideoDecoder;
