import Event from '../util/Event';
import { CacheGOP } from './define';

export type DecoderConstructor = new (url: string) => AbstractDecoder;

let id = 0;
abstract class AbstractDecoder extends Event {
  id: number;
  url: string;
  currentTime: number; // 当前解析的时间
  gopIndex: number; // 当前区域索引
  error: boolean;

  constructor(url: string) {
    super();
    this.url = url;
    this.currentTime = -Infinity;
    this.gopIndex = -1;
    this.error = false;
    this.id = id++;
  }

  abstract start(time: number): void;

  abstract getFrameByTime(time: number): VideoFrame | undefined;

  abstract releaseGOPList(): void;

  abstract release(): void;

  abstract get gopList(): CacheGOP[];

  abstract get currentGOP(): CacheGOP;
}

export default AbstractDecoder;
