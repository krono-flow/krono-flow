import Root from '../node/Root';
import Lottie from '../node/Lottie';
import Event from '../util/Event';
import config from '../config';
import { EncoderEvent, EncoderType, onMessage } from '../encoder';
import { CAN_PLAY, REFRESH_COMPLETE } from '../refresh/refreshEvent';
import TimeAnimation from '../animation/TimeAnimation';
import { reSample, sliceAudioBuffer } from './sound';
import { AudioChunk } from '../decoder';

let worker: Worker;
let noWorker = false;
let messageId = 0;
let instance: MbVideoEncoder | undefined;

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

export class MbVideoEncoder extends Event {
  constructor() {
    super();
  }

  private initWorker() {
    if (worker) {
      return;
    }
    if (config.encoderWorker) {
      worker = new Worker(config.encoderWorker);
    }
    else if (config.encoderWorkerStr) {
      const blob = new Blob([config.encoderWorkerStr.trim()], { 'type': 'application/javascript' });
      const url = URL.createObjectURL(blob);
      worker = new Worker(url);
    }
    else {
      noWorker = true;
    }
  }

  async start(root: Root, encodeOptions?: EncodeOptions) {
    if (!root.canvas) {
      throw new Error('Root Missing appendTo canvas');
    }
    this.initWorker();
    const videoEncoderConfig: VideoEncoderConfig = Object.assign({
      codec: 'avc1.420028', // H.264 Baseline Profile (广泛兼容)
      width: root.width,
      height: root.height,
      bitrate: 5_000_000, // 5 Mbps (高画质)
      bitrateMode: 'variable',
      framerate: 30,
      hardwareAcceleration: 'no-preference',
    }, encodeOptions?.video);
    const support = await VideoEncoder.isConfigSupported(videoEncoderConfig);
    if (!support || !support.supported) {
      throw new Error('Unsupported video encoder config');
    }
    const audioEncoderConfig: AudioEncoderConfig = Object.assign({
      codec: 'opus',
      sampleRate: 44100,
      numberOfChannels: 2,
    }, encodeOptions?.audio);
    // 计算帧数和时间，每次走一帧的时间渲染
    const timestamp = encodeOptions?.timestamp || 0;
    const duration = encodeOptions?.duration || root.aniController.duration;
    if (!duration || !videoEncoderConfig.framerate) {
      return;
    }
    const spf = 1e3 / videoEncoderConfig.framerate;
    const num = Math.ceil((duration - timestamp) / spf);
    const begin = Math.floor(timestamp / spf);
    const mes = {
      type: EncoderType.INIT,
      messageId: messageId++,
      isWorker: !!config.encoderWorker || !!config.encoderWorkerStr,
      duration,
      num,
      videoEncoderConfig,
      audioEncoderConfig,
      mute: config.mute,
      encoderFrameQue: config.encoderFrameQue,
    };
    if (worker) {
      worker.postMessage(mes);
    }
    else {
      await onMessage({ data: mes } as any);
    }
    this.emit(MbVideoEncoderEvent.START, num);
    // 记录每个node的当前时间的音频有没有提取过，避免encode重复，已node的id+时间做key
    const audioRecord: Record<string, true> = {};
    for (let i = 0; i < num; i++) {
      const timestamp = (i + begin) * spf;
      // console.warn('encode>>>>>>>>>>>>>>>>', i, num, timestamp);
      root.aniController.gotoAndStop(timestamp);
      this.emit(MbVideoEncoderEvent.PROGRESS, i, num, true);
      await new Promise<void>((resolve, reject) => {
        const frameCb = async () => {
          const bitmap = await createImageBitmap(root.canvas!);
          const videoFrame = new VideoFrame(bitmap, {
            timestamp: timestamp * 1e3,
            duration: spf * 1e3,
          });
          const audioList: { audioChunk: AudioChunk, volume: number }[] = [];
          if (!config.mute) {
            for (let i = 0, len = root.aniController.aniList.length; i < len; i++) {
              const item = root.aniController.aniList[i];
              const { delay, duration } = item;
              // 范围内的声音才有效
              if (item instanceof TimeAnimation
                && item.currentTime >= delay
                && item.currentTime < duration + delay
              ) {
                const node = item.node;
                if (node instanceof Lottie || !node.volumn) {
                  continue;
                }
                const decoder = node.decoder;
                if (!decoder) {
                  continue;
                }
                const gop = decoder.currentGOP;
                if (!gop) {
                  continue;
                }
                const audioBuffer = gop.audioBuffer;
                if (!audioBuffer) {
                  continue;
                }
                const key = node.id + '-' + gop.index;
                if (audioRecord[key]) {
                  continue;
                }
                audioRecord[key] = true;
                const diff = gop.audioTimestamp - gop.timestamp;
                const slice = sliceAudioBuffer(audioBuffer, 0, item.duration - gop.audioTimestamp);
                const newBuffer = await reSample(slice, audioEncoderConfig.numberOfChannels, audioEncoderConfig.sampleRate);
                const channels: Float32Array[] = [];
                for (let ch = 0; ch < audioEncoderConfig.numberOfChannels; ch++) {
                  const data = newBuffer.getChannelData(ch);
                  channels.push(data);
                }
                audioList.push({
                  audioChunk: {
                    format: 'f32-planar',
                    channels,
                    sampleRate: audioEncoderConfig.sampleRate,
                    numberOfChannels: audioEncoderConfig.numberOfChannels,
                    numberOfFrames: newBuffer.length,
                    timestamp: timestamp + diff,
                    duration: newBuffer.duration * 1e3,
                  },
                  volume: node.volumn,
                });
              }
            }
          }
          const messageCb = (e: MessageEvent<{
            type: EncoderEvent,
            buffer: ArrayBuffer,
            error: string,
          }>) => {
            if (e.data.type === EncoderEvent.PROGRESS) {
              resolve();
              this.emit(MbVideoEncoderEvent.PROGRESS, i, num, false);
            }
            else {
              reject(e.data.error);
              this.emit(MbVideoEncoderEvent.ERROR, e.data.error);
            }
          };
          const mes = {
            type: EncoderType.FRAME,
            messageId: messageId++,
            isWorker: !!config.encoderWorker || !!config.encoderWorkerStr,
            timestamp,
            videoFrame,
            audioList,
            audioEncoderConfig,
            mute: config.mute,
          };
          const transferList: Transferable[] = [];
          transferList.push(videoFrame);
          audioList.forEach(item => {
            item.audioChunk.channels.forEach(channel => {
              transferList.push(channel.buffer);
            });
          });
          if (worker) {
            worker.onmessage = messageCb;
            worker.postMessage(
              mes,
              transferList,
            );
          }
          else {
            onMessage({ data: mes } as any).then(res => {
              messageCb(res as any);
            });
          }
        };
        // 可能没有刷新
        if (root.contentLoadingCount) {
          root.once(CAN_PLAY, frameCb);
        }
        else if (root.rl) {
          root.once(REFRESH_COMPLETE, frameCb);
        }
        else {
          frameCb();
        }
      });
    }
    return new Promise<ArrayBuffer>(resolve => {
      const cb = (e: MessageEvent<{
        type: EncoderEvent,
        buffer: ArrayBuffer,
      }>) => {
        if (e.data.type === EncoderEvent.FINISH) {
          resolve(e.data.buffer);
        }
        this.emit(MbVideoEncoderEvent.FINISH);
      };
      const mes = {
        type: EncoderType.END,
        messageId: messageId++,
        isWorker: !!config.encoderWorker || !!config.encoderWorkerStr,
        videoEncoderConfig,
        audioEncoderConfig,
        timestamp: timestamp + spf, // 比最后一帧再多一帧给audio用
      };
      if (worker) {
        worker.onmessage = cb;
        worker.postMessage(mes);
      }
      else {
        onMessage({ data: mes } as any).then(res => {
          cb(res as any);
        });
      }
    });
  }

  static getInstance() {
    if (!instance) {
      instance = new MbVideoEncoder();
    }
    return instance;
  }
}

export default MbVideoEncoder;
