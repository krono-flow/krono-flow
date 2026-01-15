import Event from '../util/Event';
import { CacheGOP } from './define';

export type DecoderConstructor = new (url: string) => AbstractDecoder;

abstract class AbstractDecoder extends Event {
  url: string;
  abstract currentTime: number;
  abstract gopIndex: number;
  abstract error: boolean;

  constructor(url: string) {
    super();
    this.url = url;
  }

  abstract start(time: number): void;

  abstract getFrameByTime(time: number): VideoFrame | undefined;

  abstract releaseGOPList(): void;

  abstract release(): void;

  abstract get gopList(): CacheGOP[];

  abstract get currentGOP(): CacheGOP;
}

export default AbstractDecoder;
