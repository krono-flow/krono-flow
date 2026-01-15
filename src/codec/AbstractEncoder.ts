import Event from '../util/Event';
import Root from '../node/Root';
import { EncodeOptions } from './define';

export type EncoderConstructor = new () => AbstractEncoder;

abstract class AbstractEncoder extends Event {
  constructor() {
    super();
  }

  abstract start(root: Root, encodeOptions?: EncodeOptions): Promise<ArrayBuffer | undefined>;
}

export default AbstractEncoder;
