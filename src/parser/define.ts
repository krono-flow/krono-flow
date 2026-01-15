import { Options } from '../animation/AbstractAnimation';
import { JKeyFrame } from '../animation/CssAnimation';
import { JKeyFrameRich } from '../animation/RichAnimation';
import {
  AudioProps,
  BitmapProps,
  LottieProps,
  PolylineProps,
  Props,
  RootProps,
  TextProps,
  VideoProps
} from '../format';
import Node from '../node/Node';

export type JCssAnimations = {
  keyframes: JKeyFrame[];
  options: Options;
};

export type JTimeAnimations = {
  start: number;
  options: Options;
};

export type JRichAnimations = {
  keyframes: JKeyFrameRich[];
  options: Options;
};

export type Item = {
  tagName: 'container';
  props: Props;
  children?: (Item | Node)[];
  animations?: JCssAnimations[];
} | {
  tagName: 'img';
  props: BitmapProps;
  animations?: JCssAnimations[];
} | {
  tagName: 'text';
  props: TextProps;
  animations?: (JCssAnimations | JRichAnimations)[];
} | {
  tagName: 'video';
  props: VideoProps;
  animations?: (JCssAnimations | JTimeAnimations)[];
} | {
  tagName: 'audio';
  props: AudioProps;
  animations?: (JCssAnimations | JTimeAnimations)[];
} | {
  tagName: 'lottie';
  props: LottieProps;
  animations?: JCssAnimations[];
} | {
  tagName: 'polyline';
  props: PolylineProps;
  animations?: JCssAnimations[];
};

export type ItemRoot = {
  tagName: 'root',
  props: RootProps,
  children?: (Item | Node)[],
};

export type ParserOptions = {
  dom?: HTMLElement;
};
