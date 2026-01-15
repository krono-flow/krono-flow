import AbstractDecoder, { DecoderConstructor } from './AbstractDecoder';
import AbstractEncoder, { EncoderConstructor } from './AbstractEncoder';
import { MbVideoDecoderEvent, MbVideoEncoderEvent } from './define';
import MbVideoDecoder from './MbVideoDecoder';
import MbVideoEncoder from './MbVideoEncoder';

let defaultDecoder: DecoderConstructor = MbVideoDecoder;

let defaultEncoder: EncoderConstructor = MbVideoEncoder;

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
  getEncoder() {
    return defaultEncoder;
  },
  setEncoder(v: EncoderConstructor) {
    defaultEncoder = v;
  }
};
