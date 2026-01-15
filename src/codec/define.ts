import MbVideoDecoder from './MbVideoDecoder';

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

export enum MbVideoDecoderEvent {
  META = 'meta',
  LOADED = 'loaded',
  ERROR = 'error',
  PROGRESS = 'progress',
  CANPLAY = 'canplay',
  AUDIO_BUFFER = 'audio_buffer',
}

export enum CacheState {
  NONE = 0,
  LOADING_META = 1,
  META = 2,
  LOADED = 3,
  ERROR = 4,
}

export type CacheGOP = SimpleGOP & {
  state: GOPState,
  videoFrames: VideoFrame[],
  audioBuffer?: AudioBuffer,
  audioBufferSourceNode?: AudioBufferSourceNode,
  users: MbVideoDecoder[],
};

export enum MbVideoEncoderEvent {
  START = 'start',
  PROGRESS = 'progress',
  FINISH = 'finish',
  ERROR = 'error',
}

export type EncodeOptions = {
  timestamp?: number;
  duration?: number;
  video?: Partial<VideoEncoderConfig>,
  audio?: Partial<AudioEncoderConfig>,
};
