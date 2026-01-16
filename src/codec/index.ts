import AbstractDecoder, { DecoderConstructor } from './AbstractDecoder';
import AbstractEncoder, { EncoderConstructor } from './AbstractEncoder';
import { VideoDecoderEvent, VideoEncoderEvent } from './define';
import MbVideoDecoder from './MbVideoDecoder';
import MbVideoEncoder from './MbVideoEncoder';
import * as define from './define';

let defaultDecoder: DecoderConstructor = MbVideoDecoder;

let defaultEncoder: EncoderConstructor = MbVideoEncoder;

export default {
  AbstractDecoder,
  AbstractEncoder,
  MbVideoDecoder,
  VideoDecoderEvent,
  MbVideoEncoder,
  VideoEncoderEvent,
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
  define,
};
