import parserPkg from './parser';
import {
  Item as ItemType,
  JCssAnimations as JCssAnimationsType,
  JTimeAnimations as JTimeAnimationsType,
  JRichAnimations as JRichAnimationsType,
} from './parser/define';
import nodePkg from './node';
import util from './util';
import stylePkg from './style';
import config from './config';
import interactionPkg from './interaction';
import animationPkg from './animation';
import { Options as OptionsType } from './animation/AbstractAnimation';
import { KeyFrame as KeyFrameType, JKeyFrame as JKeyFrameType } from './animation/CssAnimation';
import { JKeyFrameRich as JKeyFrameRichType, KeyFrameRich as KeyFrameRichType } from './animation/RichAnimation';
import math from './math';
import historyPkg from './history';
import refreshPkg from './refresh';
import formatPkg, {
  JPoint as JPointType,
  Point as PointType,
  JStyle as JStyleType,
  Props as PropsType,
  RootProps as RootPropsType,
  BitmapProps as BitmapPropsType,
  TextProps as TextPropsType,
  VideoProps as VideoPropsType,
  AudioProps as AudioPropsType,
  LottieProps as LottiePropsType,
  PolylineProps as PolylinePropsType,
  LottieMeta as LottieMetaType,
  RichIndex as RichIndexType,
  JRich as JRichType,
} from './format';
import codecPkg from './codec';
import {
  AudioChunk as AudioChunkType,
  GOP as GOPType,
  SimpleGOP as SimpleGOPType,
  VideoAudioMeta as VideoAudioMetaType,
  Cache as CacheType,
  CacheGOP as CacheGOPType,
  EncodeOptions as EncodeOptionsType,
  DecoderMessageType as DecoderMessageTypeType,
  DecoderMessageEvent as DecoderMessageEventType,
  EncoderMessageType as EncoderMessageTypeType,
  EncoderMessageEvent as EncoderMessageEventType,
} from './codec/define';
import { DecoderConstructor as DecoderConstructorType } from './codec/AbstractDecoder';
import { EncoderConstructor as EncoderConstructorType } from './codec/AbstractEncoder';

export namespace node {
  export type Container = InstanceType<typeof nodePkg.Container>;
  export type Bitmap = InstanceType<typeof nodePkg.Bitmap>;
  export type Node = InstanceType<typeof nodePkg.Node>;
  export type Root = InstanceType<typeof nodePkg.Root>;
  export type Video = InstanceType<typeof nodePkg.Video>;
  export type Audio = InstanceType<typeof nodePkg.Audio>;
  export type Text = InstanceType<typeof nodePkg.Text>;
  export type Lottie = InstanceType<typeof nodePkg.Lottie>;
  export namespace geom {
    export type Polyline = InstanceType<typeof nodePkg.Polyline>;
  }
}

export namespace animation {
  export type AbstractAnimation = InstanceType<typeof animationPkg.AbstractAnimation>;
  export type CssAnimation = InstanceType<typeof animationPkg.CssAnimation>;
  export type GifAnimation = InstanceType<typeof animationPkg.GifAnimation>;
  export type RichAnimation = InstanceType<typeof animationPkg.RichAnimation>;
  export type TimeAnimation = InstanceType<typeof animationPkg.TimeAnimation>;
  export type AniController = InstanceType<typeof animationPkg.AniController>;
  export type Options = OptionsType;
  export type KeyFrame = KeyFrameType;
  export type JKeyFrame = JKeyFrameType;
  export type JKeyFrameRich = JKeyFrameRichType;
  export type KeyFrameRich = KeyFrameRichType;
}

export namespace history {
  export type History = InstanceType<typeof historyPkg.History>;
  export type AbstractCommand = InstanceType<typeof historyPkg.AbstractCommand>;
  export type MoveCommand = InstanceType<typeof historyPkg.MoveCommand>;
  export type RemoveCommand = InstanceType<typeof historyPkg.RemoveCommand>;
  export type ResizeCommand = InstanceType<typeof historyPkg.ResizeCommand>;
  export type RotateCommand = InstanceType<typeof historyPkg.RotateCommand>;
  export type TextCommand = InstanceType<typeof historyPkg.TextCommand>;
}

export namespace interaction {
  export type Listener = InstanceType<typeof interactionPkg.Listener>;
  export type Select = InstanceType<typeof interactionPkg.Select>;
  export type Input = InstanceType<typeof interactionPkg.Input>;
}

export namespace refresh {
  export type CanvasCache = InstanceType<typeof refreshPkg.CanvasCache>;
  export type TextureCache = InstanceType<typeof refreshPkg.TextureCache>;
}

export namespace format {
  export type JPoint = JPointType;
  export type Point = PointType;
  export type JStyle = JStyleType;
  export type Props = PropsType;
  export type RootProps = RootPropsType;
  export type BitmapProps = BitmapPropsType;
  export type TextProps = TextPropsType;
  export type VideoProps = VideoPropsType;
  export type AudioProps = AudioPropsType;
  export type LottieProps = LottiePropsType;
  export type PolylineProps = PolylinePropsType;
  export type LottieMeta = LottieMetaType;
  export type RichIndex = RichIndexType;
  export type JRich = JRichType;
}

export namespace parser {
  export type Item = ItemType;
  export type JCssAnimations = JCssAnimationsType;
  export type JTimeAnimations = JTimeAnimationsType;
  export type JRichAnimations = JRichAnimationsType;
}

export namespace codec {
  export type AbstractDecoder = InstanceType<typeof codecPkg.AbstractDecoder>;
  export type AbstractEncoder = InstanceType<typeof codecPkg.AbstractEncoder>;
  export type GOP = GOPType;
  export type SimpleGOP = SimpleGOPType;
  export type VideoAudioMeta = AudioChunkType;
  export type AudioChunk = VideoAudioMetaType;
  export type Cache = CacheType;
  export type CacheGOP = CacheGOPType;
  export type EncodeOptions = EncodeOptionsType;
  export type DecoderConstructor = DecoderConstructorType;
  export type EncoderConstructor = EncoderConstructorType;
  export type DecoderMessageType = DecoderMessageTypeType;
  export type DecoderMessageEvent = DecoderMessageEventType;
  export type EncoderMessageType = EncoderMessageTypeType;
  export type EncoderMessageEvent = EncoderMessageEventType;
}

export default {
  parser: parserPkg,
  node: nodePkg,
  util,
  config,
  style: stylePkg,
  interaction: interactionPkg,
  animation: animationPkg,
  math,
  history: historyPkg,
  refresh: refreshPkg,
  format: formatPkg,
  codec: codecPkg,
};
