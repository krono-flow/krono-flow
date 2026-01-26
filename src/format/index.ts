import { DEFAULT_COMPUTED_STYLE, DEFAULT_STYLE } from './dft';
import {
  ComputedStyle,
  CURVE_MODE,
} from '../style/define';
import { VideoAudioMeta } from '../codec/define';
import { JCssAnimations } from '../parser/define';

export type Props = {
  uuid?: string;
  name?: string;
  isLocked?: boolean;
  style?: Partial<JStyle>;
  animations?: JCssAnimations[];
}

export type RootProps = Props & {
  contextAttributes?: any,
  style: Partial<JStyle> & {
    width: number;
    height: number;
  };
}

export type ComponentProps = Props & {}

export type JPoint = {
  x: number;
  y: number;
  cornerRadius?: number;
  curveMode?: 'none' | 'straight' | 'mirrored' | 'asymmetric' | 'disconnected';
  fx?: number; // from控制点
  fy?: number;
  tx?: number; // to控制点
  ty?: number;
  hasCurveFrom?: boolean;
  hasCurveTo?: boolean;
};

export type Point = Omit<JPoint, 'curveMode'> & {
  curveMode: CURVE_MODE;
  cornerRadius: number;
  fx: number;
  fy: number;
  tx: number;
  ty: number;
  absX: number; // 算上宽高的绝对像素值
  absY: number;
  absFx: number;
  absFy: number;
  absTx: number;
  absTy: number;
  dspX: number; // 绝对值和相对于AP的matrix的值，展示在面板上
  dspY: number;
  dspFx: number;
  dspFy: number;
  dspTx: number;
  dspTy: number;
};

export type PolylineProps = Props & {
  isClosed: boolean;
  points: JPoint[];
}

export type BitmapProps = Props & {
  src: string;
  frameIndex?: number;
  onLoad?: () => void;
}

export type VideoProps = Props & {
  src: string;
  currentTime?: number;
  onMeta?: (o: VideoAudioMeta) => void;
  // onLoad?: (o: VideoAudioData) => void;
  onCanplay?: () => void;
  onError?: (e: string) => void;
  onWaiting?: () => void;
  volumn?: number;
  options?: RequestInit;
}

export type AudioProps = Props & {
  src: string;
  currentTime?: number;
  onMeta?: (o: VideoAudioMeta) => void;
  // onLoad?: (o: LoadAudioRes) => void;
  onCanplay?: () => void;
  onError?: (e: string) => void;
  onWaiting?: () => void;
  volumn?: number;
  options?: RequestInit;
};

export type LottieMeta = {
  duration: number;
};

export type LottieProps = Props & {
  src?: string;
  json?: JSON;
  currentTime?: number;
  onMeta?: (o: LottieMeta) => void;
  onLoad?: () => void;
  options?: RequestInit;
};

export type TextProps = Props & {
  content: string;
  rich?: JRich[];
  textBehaviour?: 'auto' | 'autoH' | 'fixed'; // sketch中特有，考虑字体的不确定性，记录原始文本框的大小位置对齐以便初始化
}

export type RichIndex = {
  location: number;
  length: number;
};

export type JRich = Partial<Pick<JStyle,
  'fontFamily'
  | 'fontSize'
  | 'fontWeight'
  | 'lineHeight'
  | 'letterSpacing'
  | 'paragraphSpacing'
  | 'fontStyle'
  | 'textAlign'
  | 'textDecoration'
  | 'color'
  | 'textShadow'
  | 'stroke'
  | 'strokeWidth'
  | 'strokeEnable'
  | 'opacity'
  | 'visibility'
>> & RichIndex;

type Origin = number | 'left' | 'right' | 'top' | 'bottom' | 'center' | string;

export type JStyle = {
  position: 'static' | 'relative' | 'absolute';
  display: 'none' | 'block' | 'inline' | 'inlineBlock' | 'flex';
  top: number | string;
  right: number | string;
  bottom: number | string;
  left: number | string;
  width: number | string;
  height: number | string;
  lineHeight: number | 'normal';
  fontFamily: string;
  fontSize: number;
  fontWeight: number | string;
  fontStyle: 'normal' | 'italic' | 'oblique';
  letterSpacing: number;
  paragraphSpacing: number;
  textAlign: 'left' | 'center' | 'right' | 'justify';
  textVerticalAlign: 'top' | 'middle' | 'bottom';
  textDecoration: Array<'none' | 'underline' | 'line-through' | 'lineThrough'>;
  textShadow: string;
  color: string | number[];
  visibility: 'visible' | 'hidden';
  opacity: number;
  backgroundColor: string | number[];
  fill: Array<string | number[]>;
  fillOpacity: number[];
  fillEnable: boolean[];
  fillMode: string[];
  fillRule: 'nonzero' | 'evenodd';
  stroke: Array<string | number[]>;
  strokeEnable: boolean[];
  strokeWidth: number[];
  strokePosition: Array<'center' | 'inside' | 'outside'>;
  strokeMode: string[];
  strokeDasharray: number[];
  strokeLinecap: 'butt' | 'round' | 'square';
  strokeLinejoin: 'miter' | 'round' | 'bevel';
  strokeMiterlimit: number;
  translateX: string | number;
  translateY: string | number;
  translateZ: string | number;
  skewX: number;
  skewY: number;
  scaleX: number;
  scaleY: number;
  rotateX: number;
  rotateY: number;
  rotateZ: number;
  transformOrigin: ([Origin, Origin]) | string;
  perspective: number;
  perspectiveOrigin: ([Origin, Origin]) | string;
  perspectiveSelf: number;
  mixBlendMode:
    | 'normal'
    | 'multiply'
    | 'screen'
    | 'overlay'
    | 'darken'
    | 'lighten'
    | 'color-dodge'
    | 'colorDodge'
    | 'color-burn'
    | 'colorBurn'
    | 'hard-light'
    | 'hardLight'
    | 'soft-light'
    | 'softLight'
    | 'difference'
    | 'exclusion'
    | 'hue'
    | 'saturation'
    | 'color'
    | 'luminosity';
  pointerEvents: boolean;
  maskMode: 'none' | 'alpha' | 'gray' | 'alpha-with' | 'gray-with';
  breakMask: boolean;
  objectFit: 'fill' | 'contain' | 'cover';
  borderTopLeftRadius: number,
  borderTopRightRadius: number,
  borderBottomLeftRadius: number,
  borderBottomRightRadius: number,
  overflow: 'visible' | 'hidden';
  filter: string[];
};

export type ResizeStyle = Partial<Pick<JStyle, 'left' | 'right' | 'top' | 'bottom' | 'width' | 'height' | 'scaleX' | 'scaleY'>>;

export type RotateZStyle = Pick<JStyle, 'rotateZ'>;

export type ModifyJRichStyle = Partial<Omit<JRich, 'location' | 'length'>>;

export function getDefaultJStyle(v?: Partial<JStyle>): JStyle {
  const dft = Object.assign({}, DEFAULT_STYLE);
  ([
    'transformOrigin',
    'perspectiveOrigin',
    'color',
    'backgroundColor',
    'stroke',
    'strokeWidth',
    'strokeEnable',
    'strokeMode',
    'strokeDasharray',
    'strokeDasharray',
    'fill',
    'fillOpacity',
    'fillEnable',
    'fillMode',
    'filter',
    'textDecoration',
  ] as const).forEach(k => {
    // @ts-ignore
    dft[k] = dft[k].slice(0);
  });
  return Object.assign(dft, v);
}

export function getDefaultComputedStyle(v?: Partial<ComputedStyle>): ComputedStyle {
  const dft = Object.assign({}, DEFAULT_COMPUTED_STYLE);
  ([
    'transformOrigin',
    'perspectiveOrigin',
    'color',
    'backgroundColor',
    'stroke',
    'strokeWidth',
    'strokeEnable',
    'strokeMode',
    'strokeDasharray',
    'strokeDasharray',
    'fill',
    'fillOpacity',
    'fillEnable',
    'fillMode',
    'filter',
    'textDecoration',
  ] as const).forEach(k => {
    // @ts-ignore
    dft[k] = dft[k].slice(0);
  });
  return Object.assign(dft, v);
}

export default {
  getDefaultJStyle,
  getDefaultComputedStyle,
};
