import Event from './Event';
import inject from './inject';
import opentype from './opentype';
import type from './type';
import { loadImg } from './loadImg';
import { loadAudio } from './loadAudio';
import { loadFont } from './loadFont';
import { loadRange } from './loadRangeCache';
import MbVideoDecoder, { MbVideoDecoderEvent } from './MbVideoDecoder';
import MbVideoEncoder, { MbVideoEncoderEvent } from './MbVideoEncoder';
import sound from './sound';

export default {
  type,
  Event,
  inject,
  opentype,
  loadImg,
  loadAudio,
  loadFont,
  loadRange,
  MbVideoDecoder,
  MbVideoDecoderEvent,
  MbVideoEncoder,
  MbVideoEncoderEvent,
  sound,
};
