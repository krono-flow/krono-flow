import { Options } from '../animation/AbstractAnimation';
import { JKeyFrame } from '../animation/CssAnimation';
import { JKeyFrameRich } from '../animation/RichAnimation';
import {
  AudioProps,
  BitmapProps, ComponentProps,
  LottieProps,
  PolylineProps,
  Props,
  RootProps,
  TextProps,
  VideoProps
} from '../format';
import AbstractNode from '../node/AbstractNode';

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
  children?: (Item | AbstractNode)[];
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
} | {
  tagName: 'component';
  props: ComponentProps;
  children?: (Item | AbstractNode)[];
  animations?: JCssAnimations[];
};

export type ItemRoot = {
  tagName: 'root',
  props: RootProps,
  children?: (Item | AbstractNode)[],
};

export type ParserOptions = {
  dom?: HTMLElement;
  gl?: WebGL2RenderingContext | WebGLRenderingContext;
  headless?: boolean;
};
