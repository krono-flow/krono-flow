import {
  ALL_FORMATS,
  Input,
  UrlSource,
  StreamSource,
  EncodedPacketSink,
  InputVideoTrack,
  InputAudioTrack,
  VideoSampleSink,
  AudioSampleSink,
} from 'mediabunny';
import { loadRange } from './util/loadRangeCache';

export enum DecoderType {
  META = 0,
  DECODE = 1,
  RELEASE = 2,
}

export enum DecoderEvent {
  META = 'meta',
  ERROR = 'error',
  DECODED = 'decoded',
}

export enum GOPState {
  NONE = 0,
  DECODING = 1,
  DECODED = 2,
  DECODED_FRAME = 3,
  ERROR = 4,
}

export type AudioChunk = {
  channels: Float32Array[],
  sampleRate: number,
  numberOfFrames: number,
  numberOfChannels: number,
  timestamp: number,
  duration: number,
  format: AudioSampleFormat,
};

export type GOP = {
  state: GOPState,
  index: number,
  sequenceNumber: number,
  timestamp: number,
  duration: number,
  audioTimestamp: number,
  audioDuration: number,
  users: number[], // smartVideoDecoder的id
  didAudioChunk?: boolean, // singleSample模式下音频不能一份份的，第一次解码时解析
};

export type SimpleGOP = Pick<GOP,
  'index' |
  'sequenceNumber' |
  'timestamp' |
  'duration' |
  'audioTimestamp' |
  'audioDuration'
>;

export type VideoAudioMeta = {
  video?: {
    id: number,
    languageCode: string,
    codec: string | null,
    name: string | null,
    codedWidth: number,
    codedHeight: number,
    displayWidth: number,
    displayHeight: number,
    width: number,
    height: number,
    timeResolution: number,
    rotation: number,
    timestamp: number,
    duration: number,
  },
  audio?: {
    id: number,
    languageCode: string,
    codec: string | null,
    name: string | null,
    numberOfChannels: number,
    sampleRate: number,
    timestamp: number,
    duration: number,
  },
  duration: number,
  fileSize: number;
};

export async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

type FileData = {
  videoTrack?: InputVideoTrack,
  audioTrack?: InputAudioTrack,
  gopList: GOP[],
};

const FILE_HASH: Record<string, FileData> = {};

export const onMessage = async (e: MessageEvent<{
  url: string,
  id: number,
  type: DecoderType,
  messageId: number,
  isWorker: boolean,
  indexedDB: boolean,
  preloadAll: boolean,
  gopMinDuration: number,
  time: number,
  index: number,
  mute: boolean,
  includeAudio: boolean,
  spf: number,
}>) => {
  const { url, id, type, isWorker } = e.data;
  // console.log('decoder', url, id, type, isWorker);
  const onError = (e: string) => {
    const res = {
      url,
      type: DecoderEvent.ERROR,
      data: e,
    };
    if (isWorker) {
      self.postMessage(res);
    }
    return { data: res };
  };
  if (!FILE_HASH[url]) {
    FILE_HASH[url] = {
      gopList: [],
    };
  }
  const fileData = FILE_HASH[url];
  if (type === DecoderType.META) {
    // 先请求文件大小，这个有304缓存
    const headResponse = await fetch(url, { method: 'HEAD' });
    const cl = headResponse.headers.get('content-length');
    if (!cl || headResponse.status !== 200 && headResponse.status !== 304) {
      return onError('Unknown content-length');
    }
    const fileSize = parseInt(cl);
    // 解封装的基础信息
    const meta: VideoAudioMeta = {
      duration: 0,
      fileSize: fileSize,
    };
    let source: UrlSource | StreamSource;
    // config配置全部加载，或者自定义range请求
    if (e.data.preloadAll) {
      source = new UrlSource(url);
    }
    else {
      source = new StreamSource({
        read: async (start, end) => {
          // console.log(start, end);
          const { arrayBuffer } = await loadRange(url, start, end - 1, fileSize, { indexedDB: e.data.indexedDB });
          if (!arrayBuffer) {
            throw new Error('Missing buffer in range: ' + start + '-' + (end - 1));
          }
          return new Uint8Array(arrayBuffer);
        },
        getSize: async () => {
          return fileSize;
        },
        prefetchProfile: 'network',
      });
    }
    const input = new Input({
      formats: ALL_FORMATS,
      source,
    });
    try {
      const data = await input.computeDuration();
      meta.duration = data * 1e3;
    } catch (e: any) {
      return onError(e.message);
    }
    const videoTrack = await input.getPrimaryVideoTrack();
    if (videoTrack) {
      fileData.videoTrack = videoTrack;
      const duration = await videoTrack.computeDuration();
      const sink = new EncodedPacketSink(videoTrack);
      for await (const packet of sink.packets(undefined, undefined, { metadataOnly: true })) {
        if (packet.type === 'key') {
          // 前一个区域的结束信息计算，碎片GOP合并一起做了
          const len = fileData.gopList.length;
          if (len) {
            const last = fileData.gopList[len - 1];
            // 这个GOP太短合并
            if (e.data.gopMinDuration && (packet.timestamp * 1e3 - last.timestamp) < e.data.gopMinDuration) {
              continue;
            }
            last.duration = last.audioDuration = packet.timestamp * 1e3 - last.timestamp;
          }
          fileData.gopList.push({
            state: GOPState.NONE,
            index: fileData.gopList.length,
            sequenceNumber: packet.sequenceNumber,
            timestamp: packet.timestamp * 1e3,
            duration: packet.duration * 1e3,
            audioTimestamp: packet.timestamp * 1e3,
            audioDuration: packet.duration * 1e3,
            users: [],
          });
        }
      }
      // 最后一个用整体时长计算
      const len = fileData.gopList.length;
      if (len) {
        const last = fileData.gopList[len - 1];
        last.duration = last.audioDuration = duration * 1e3 - last.timestamp;
      }
      const timestamp = await videoTrack.getFirstTimestamp();
      meta.video = {
        id: videoTrack.id,
        languageCode: videoTrack.languageCode,
        codec: videoTrack.codec,
        name: videoTrack.name,
        codedWidth: videoTrack.codedWidth,
        codedHeight: videoTrack.codedHeight,
        displayWidth: videoTrack.displayWidth,
        displayHeight: videoTrack.displayHeight,
        width: videoTrack.displayWidth,
        height: videoTrack.displayHeight,
        timeResolution: videoTrack.timeResolution,
        rotation: videoTrack.rotation,
        timestamp: timestamp * 1e3,
        duration: duration * 1e3,
      };
    }
    const audioTrack = await input.getPrimaryAudioTrack();
    if (audioTrack) {
      fileData.audioTrack = audioTrack;
      const duration = await audioTrack.computeDuration();
      const timestamp = await audioTrack.getFirstTimestamp();
      meta.audio = {
        id: audioTrack.id,
        languageCode: audioTrack.languageCode,
        codec: audioTrack.codec,
        name: audioTrack.name,
        numberOfChannels: audioTrack.numberOfChannels,
        sampleRate: audioTrack.sampleRate,
        timestamp: timestamp * 1e3,
        duration: duration * 1e3,
      };
      // 没有视频仅有音频的特殊视频文件，或者纯音频解码，用音频轨道虚拟出gop列表
      if (!videoTrack) {
        const gopMinDuration = e.data.gopMinDuration || 5000;
        const sink = new EncodedPacketSink(audioTrack);
        let timestamp = -1;
        let isFirst = true;
        let sequenceNumber = 0;
        // 音频没有关键帧概念，用时间均分出gop
        for await (const packet of sink.packets(undefined, undefined, { metadataOnly: true })) {
          if (timestamp === -1) {
            timestamp = packet.timestamp;
          }
          const diff = packet.timestamp - timestamp;
          if (isFirst || diff * 1e3 >= gopMinDuration) {
            isFirst = false;
            const len = fileData.gopList.length;
            if (len) {
              const last = fileData.gopList[len - 1];
              last.duration = last.audioDuration = packet.timestamp * 1e3 - last.timestamp;
            }
            fileData.gopList.push({
              state: GOPState.NONE,
              index: fileData.gopList.length,
              sequenceNumber,
              timestamp: packet.timestamp * 1e3,
              duration: packet.duration * 1e3,
              audioTimestamp: packet.timestamp * 1e3,
              audioDuration: packet.duration * 1e3,
              users: [],
            });
            timestamp = packet.timestamp;
          }
          sequenceNumber++;
        }
        // 最后一个用整体时长计算，可能会不足普通gop的duration
        const len = fileData.gopList.length;
        if (len) {
          const last = fileData.gopList[len - 1];
          last.duration = last.audioDuration = duration * 1e3 - last.timestamp;
        }
      }
    }
    const simpleGOPList: SimpleGOP[] = fileData.gopList.map(item => {
      return {
        index: item.index,
        sequenceNumber: item.sequenceNumber,
        timestamp: item.timestamp,
        duration: item.duration,
        audioTimestamp: item.audioTimestamp,
        audioDuration: item.audioDuration,
      };
    });
    const res = {
      url,
      type: DecoderEvent.META,
      data: { meta, simpleGOPList },
    };
    if (isWorker) {
      self.postMessage(res);
    }
    return { data: res };
  }
  else if (type === DecoderType.DECODE) {
    const gop = fileData.gopList[e.data.index];
    // 理论不会，预防，只有加载成功后才会进入解码状态
    if (!gop || gop.state === GOPState.ERROR) {
      return;
    }
    // 线程异步可能别的gop解码完成了
    if (gop.state === GOPState.DECODED) {
      return;
    }
    // 剩下只有可能NONE或DECODING状态了，去重记录发起方id
    if (!gop.users.includes(id)) {
      gop.users.push(id);
    }
    // 截流，先等待一段时间，防止如频繁拖动时间轴，再检查是否被release移除users
    await sleep(100);
    if (!gop.users.includes(id)) {
      return;
    }
    // 防止异步线程
    // @ts-ignore
    if (gop.state === GOPState.DECODING || gop.state === GOPState.DECODED) {
      return;
    }
    gop.state = GOPState.DECODING;
    const videoFrames: VideoFrame[] = [];
    if (fileData.videoTrack) {
      const sink = new VideoSampleSink(fileData.videoTrack);
      for await (const sample of sink.samples(gop.timestamp * 1e-3, (gop.timestamp + gop.duration) * 1e-3)) {
        videoFrames.push(sample.toVideoFrame());
        sample.close();
      }
    }
    const audioChunks: AudioChunk[] = [];
    let sampleRate = 0;
    let audioTimeStamp = -1;
    let audioDuration = 0;
    if (fileData.audioTrack && !e.data.mute && !gop.didAudioChunk) {
      gop.didAudioChunk = true;
      const sink = new AudioSampleSink(fileData.audioTrack);
      const start = gop.timestamp * 1e-3;
      const end = (gop.timestamp + gop.duration) * 1e-3;
      const samples = sink.samples(start, end);
      for await (const sample of samples) {
        sampleRate = sample.sampleRate;
        const { numberOfChannels, numberOfFrames, timestamp, duration } = sample;
        // 位于2个gop之间的sample归属上一个gop
        if (timestamp >= end && gop.index < fileData.gopList.length - 1 || timestamp < start) {
          continue;
        }
        if (audioTimeStamp === -1) {
          audioTimeStamp = timestamp * 1e3;
        }
        audioDuration = timestamp * 1e3 - audioTimeStamp + duration * 1e3;
        const channels: Float32Array[] = [];
        for (let ch = 0; ch < numberOfChannels; ch++) {
          const tmp = new Float32Array(numberOfFrames);
          // audioBuffer只支持f32
          sample.copyTo(tmp, { planeIndex: ch, format: 'f32-planar' });
          channels.push(tmp);
        }
        audioChunks.push({
          format: 'f32-planar',
          channels,
          sampleRate,
          numberOfFrames,
          numberOfChannels,
          timestamp: timestamp * 1e3,
          duration: duration * 1e3,
        });
        sample.close();
      }
    }
    // 防止被释放
    if (gop.state !== GOPState.DECODING) {
      gop.didAudioChunk = false;
      videoFrames.forEach(item => {
        item.close();
      });
      return;
    }
    gop.state = GOPState.DECODED;
    const transferList: Transferable[] = [];
    videoFrames.forEach(item => transferList.push(item));
    audioChunks.forEach(item => {
      item.channels.forEach(item => {
        transferList.push(item.buffer);
      });
    });
    const res = {
      url,
      type: DecoderEvent.DECODED,
      data: {
        index: e.data.index,
        videoFrames,
        audioChunks,
        sampleRate,
        audioTimeStamp,
        audioDuration,
      },
    };
    if (isWorker) {
      (self as DedicatedWorkerGlobalScope).postMessage(res, transferList);
    }
    return { data: res };
  }
  else if (type === DecoderType.RELEASE) {
    const gop = fileData.gopList[e.data.index];
    if (!gop) {
      return;
    }
    const i = gop.users.indexOf(e.data.id);
    if (i > -1) {
      gop.users.splice(i, 1);
    }
    if (!gop.users.length) {
      gop.state = GOPState.NONE;
      gop.didAudioChunk = false;
    }
  }
};

self.onmessage = onMessage;
