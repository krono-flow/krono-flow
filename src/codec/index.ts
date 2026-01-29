import AbstractDecoder, { DecoderConstructor } from './AbstractDecoder';
import AbstractEncoder, { EncoderConstructor } from './AbstractEncoder';
import MbVideoDecoder from './MbVideoDecoder';
import MbVideoEncoder from './MbVideoEncoder';
import decoderEvent from './decoderEvent';
import encoderEvent from './encoderEvent';

let defaultDecoder: DecoderConstructor = MbVideoDecoder;

let defaultEncoder: EncoderConstructor = MbVideoEncoder;

export default {
  AbstractDecoder,
  AbstractEncoder,
  MbVideoDecoder,
  MbVideoEncoder,
  decoderEvent,
  encoderEvent,
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
  },
};
