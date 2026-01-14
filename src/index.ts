import parser from './parser';
import node from './node';
import util from './util';
import style from './style';
import config from './config';
import interaction from './interaction';
import animation from './animation';
import { Options as OptionsType } from './animation/AbstractAnimation';
import { KeyFrame as KeyFrameType, JKeyFrame as JKeyFrameType } from './animation/CssAnimation';
import { JKeyFrameRich as JKeyFrameRichType, KeyFrameRich as KeyFrameRichType } from './animation/RichAnimation';
import math from './math';
import history from './history';
import refresh from './refresh';
import format, { JPoint as JPointType, JStyle as JStyleType } from './format';
import codec from './codec';

export namespace node {
  export type Container = InstanceType<typeof node.Container>;
  export type Bitmap = InstanceType<typeof node.Bitmap>;
  export type Node = InstanceType<typeof node.Node>;
  export type Root = InstanceType<typeof node.Root>;
  export type Video = InstanceType<typeof node.Video>;
  export type Audio = InstanceType<typeof node.Audio>;
  export type Text = InstanceType<typeof node.Text>;
  export type Lottie = InstanceType<typeof node.Lottie>;
  export namespace geom {
    export type Polyline = InstanceType<typeof node.Polyline>;
  }
}

export namespace animation {
  export type AbstractAnimation = InstanceType<typeof animation.AbstractAnimation>;
  export type CssAnimation = InstanceType<typeof animation.CssAnimation>;
  export type GifAnimation = InstanceType<typeof animation.GifAnimation>;
  export type RichAnimation = InstanceType<typeof animation.RichAnimation>;
  export type TimeAnimation = InstanceType<typeof animation.TimeAnimation>;
  export type AniController = InstanceType<typeof animation.AniController>;
  export type Options = OptionsType;
  export type KeyFrame = KeyFrameType;
  export type JKeyFrame = JKeyFrameType;
  export type JKeyFrameRich = JKeyFrameRichType;
  export type KeyFrameRich = KeyFrameRichType;
}

export namespace history {
  export type History = InstanceType<typeof history.History>;
  export type AbstractCommand = InstanceType<typeof history.AbstractCommand>;
  export type MoveCommand = InstanceType<typeof history.MoveCommand>;
  export type RemoveCommand = InstanceType<typeof history.RemoveCommand>;
  export type ResizeCommand = InstanceType<typeof history.ResizeCommand>;
  export type RotateCommand = InstanceType<typeof history.RotateCommand>;
  export type TextCommand = InstanceType<typeof history.TextCommand>;
}

export namespace interaction {
  export type Listener = InstanceType<typeof interaction.Listener>;
  export type Select = InstanceType<typeof interaction.Select>;
  export type Input = InstanceType<typeof interaction.Input>;
}

export namespace refresh {
  export type CanvasCache = InstanceType<typeof refresh.CanvasCache>;
  export type TextureCache = InstanceType<typeof refresh.TextureCache>;
}

export namespace format {
  export type JPoint = JPointType;
  export type JStyle = JStyleType;
}

export default {
  parser,
  node,
  util,
  config,
  style,
  interaction,
  animation,
  math,
  history,
  refresh,
  format,
  codec,
};
