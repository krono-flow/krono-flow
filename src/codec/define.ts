import AbstractDecoder from './AbstractDecoder';

export enum DecoderMessageType {
  META = 0,
  DECODE = 1,
  DECODED_FRAME = 2,
  RELEASE = 3,
}

export enum DecoderMessageEvent {
  META = 'meta',
  ERROR = 'error',
  DECODED = 'decoded',
  DECODED_FRAME = 'decodedFrame',
}

export enum EncoderMessageType {
  INIT = 0,
  FRAME = 1,
  END = 2, // 数据结束，可以输出视频
}

export enum EncoderMessageEvent {
  PROGRESS = 0,
  FINISH = 1,
  ERROR = 2,
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

export enum CacheState {
  NONE = 0,
  LOADING_META = 1,
  META = 2,
  LOADED = 3,
  ERROR = 4,
}

export type Cache = {
  state: CacheState,
  metaList: [AbstractDecoder], // meta加载完之前所有尝试加载meta的等待队列
  loadList: [AbstractDecoder], // 整个处理队列记录
  meta: VideoAudioMeta,
  gopList: CacheGOP[],
  singleHash: Record<number, {
    videoFrame: VideoFrame,
    users: AbstractDecoder[],
  }>, // 单帧合成模式下，按时间戳保存，同一个gop下可能多个不同时间的
  error?: string,
  count: number;
};

export type CacheGOP = SimpleGOP & {
  state: GOPState,
  videoFrames: VideoFrame[],
  audioBuffer?: AudioBuffer,
  audioBufferSourceNode?: AudioBufferSourceNode,
  users: AbstractDecoder[],
};

export type EncodeOptions = {
  timestamp?: number;
  duration?: number;
  video?: Partial<VideoEncoderConfig>,
  audio?: Partial<AudioEncoderConfig>,
};

export default {
  DecoderMessageType,
  DecoderMessageEvent,
  EncoderMessageType,
  EncoderMessageEvent,
  GOPState,
  CacheState,
};
