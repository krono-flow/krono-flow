import Event from '../util/Event';
import { CacheGOP } from './define';

abstract class AbstractDecoder extends Event {
  constructor() {
    super();
  }

  abstract start(time: number): void;

  abstract getFrameByTime(time: number): VideoFrame | undefined;

  abstract release(): void;

  abstract get gopList(): CacheGOP[];

  abstract get currentGOP(): CacheGOP;
}

export default AbstractDecoder;
