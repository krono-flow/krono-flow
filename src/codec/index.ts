import AbstractDecoder, { DecoderConstructor } from './AbstractDecoder';
import AbstractEncoder from './AbstractEncoder';
import { MbVideoDecoderEvent, MbVideoEncoderEvent } from './define';
import MbVideoDecoder from './MbVideoDecoder';
import MbVideoEncoder from './MbVideoEncoder';

let defaultDecoder: DecoderConstructor = MbVideoDecoder;

export default {
  AbstractDecoder,
  AbstractEncoder,
  MbVideoDecoder,
  MbVideoDecoderEvent,
  MbVideoEncoder,
  MbVideoEncoderEvent,
  getDecoder() {
    return defaultDecoder;
  },
  setDecoder(v: DecoderConstructor) {
    defaultDecoder = v;
  },
};
