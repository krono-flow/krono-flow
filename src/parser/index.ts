import Node from '../node/Node';
import Container from '../node/Container';
import Bitmap from '../node/Bitmap';
import Text from '../node/Text';
import Video from '../node/Video';
import Audio from '../node/Audio';
import Root from '../node/Root';
import Lottie from '../node/Lottie';
import Polyline from '../node/geom/Polyline';
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
import { JKeyFrame } from '../animation/CssAnimation';
import { Options } from '../animation/AbstractAnimation';

export type JAnimations = {
  keyframes: JKeyFrame[];
  options: Options;
};

export type Item = {
  tagName: 'container';
  props: Props;
  children?: (Item | Node)[];
  animations?: JAnimations[];
} | {
  tagName: 'img';
  props: BitmapProps;
  animations?: JAnimations[];
} | {
  tagName: 'text';
  props: TextProps;
  animations?: JAnimations[];
} | {
  tagName: 'video';
  props: VideoProps;
  animations?: JAnimations[];
} | {
  tagName: 'audio';
  props: AudioProps;
  animations?: JAnimations[];
} | {
  tagName: 'lottie';
  props: LottieProps;
  animations?: JAnimations[];
} | {
  tagName: 'polyline';
  props: PolylineProps;
  animations?: JAnimations[];
};

export type ItemRoot = {
  tagName: 'root',
  props: RootProps,
  children?: (Item | Node)[],
};

export type POptions = {
  dom?: HTMLElement;
};

export function parseJSON(json: Item | Node) {
  if (json instanceof Node) {
    return json;
  }
  const { tagName, props, animations } = json;
  if (!tagName) {
    throw new Error('Missing tagName');
  }
  let node: Node;
  if (tagName === 'container') {
    if(json.children && !Array.isArray(json.children)) {
      throw new Error('Children must be an array');
    }
    node = new Container(props, (json.children || []).map(item => {
      return parseJSON(item);
    }));
  }
  else if (tagName === 'img') {
    node = new Bitmap(props);
  }
  else if (tagName === 'text') {
    node = new Text(props);
  }
  else if (tagName === 'video') {
    node = new Video(props);
  }
  else if (tagName === 'audio') {
    node = new Audio(props);
  }
  else if (tagName === 'lottie') {
    node = new Lottie(props);
  }
  else if (tagName === 'polyline') {
    node = new Polyline(props);
  }
  else {
    throw new Error('Unknown tagName');
  }
  if (animations) {
    if (!Array.isArray(animations)) {
      throw new Error('Animations must be an array');
    }
    node.animationRecords = animations;
  }
  return node;
}

export function parseRoot(json: ItemRoot, options?: POptions) {
  const root = new Root(json.props, (json.children || []).map(item => {
    return parseJSON(item);
  }));
  if (options?.dom) {
    if (options.dom.tagName.toUpperCase() === 'CANVAS') {
      root.appendTo(options.dom as HTMLCanvasElement);
    }
    else {
      const canvas = document.createElement('canvas');
      canvas.width = root.props.style?.width as number;
      canvas.height = root.props.style?.height as number;
      options.dom.appendChild(canvas);
      root.appendTo(canvas);
    }
  }
  return root;
}

export function parse(json: Item | {
  tagName: 'root',
  props: RootProps,
  children?: (Item | Node)[],
}, options?: {
  dom?: HTMLElement;
}) {
  if (json.tagName === 'root') {
    return parseRoot(json, options);
  }
  else {
    return parseJSON(json);
  }
}

export default {
  parseJSON,
  parseRoot,
  parse,
};
