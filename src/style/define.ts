import { RichIndex } from '../format';

export enum StyleUnit {
  AUTO = 0,
  PX = 1,
  PERCENT = 2,
  NUMBER = 3,
  DEG = 4,
  RGBA = 5,
  BOOLEAN = 6,
  STRING = 7,
  GradientType = 8,
  MATRIX = 9,
  SHADOW = 10,
  PATTERN = 11,
  GAUSS_BLUR = 12,
  MOTION_BLUR = 13,
  RADIAL_BLUR = 14,
  BLOOM = 15,
  LIGHT_DARK = 16,
  HUE_ROTATE = 17,
  SATURATE = 18,
  BRIGHTNESS = 19,
  CONTRAST = 20,
  SEPIA = 21,
}

export type StyleStr = {
  v: string;
  u: StyleUnit.STRING;
};

export type StyleNum = {
  v: number;
  u:
    | StyleUnit.AUTO
    | StyleUnit.PX
    | StyleUnit.PERCENT
    | StyleUnit.NUMBER
    | StyleUnit.DEG;
};

export type StyleBool = {
  v: boolean;
  u: StyleUnit.BOOLEAN;
};

export type StyleVisibility = {
  v: Visibility;
  u: StyleUnit.NUMBER;
};

export type StyleColor = {
  v: number[];
  u: StyleUnit.RGBA;
};

export type StyleFontStyle = {
  v: FontStyle;
  u: StyleUnit.STRING;
};

export type StyleMixBlendMode = {
  v: MixBlendMode;
  u: StyleUnit.NUMBER;
};

export type StyleObjectFit = {
  v: ObjectFit;
  u: StyleUnit.NUMBER;
};

export type StyleTextAlign = {
  v: TextAlign;
  u: StyleUnit.NUMBER;
};

export type StyleTextVerticalAlign = {
  v: TextVerticalAlign;
  u: StyleUnit.NUMBER;
};

export type StyleTextDecoration = {
  v: TextDecoration;
  u: StyleUnit.NUMBER;
};

export type ColorStop = {
  color: StyleColor;
  offset: StyleNum;
};

export type ComputedColorStop = {
  color: number[];
  offset: number;
};

export type Gradient = {
  t: GradientType;
  d: number[];
  stops: ColorStop[];
};

export type ComputedGradient = {
  t: GradientType;
  d: number[];
  stops: ComputedColorStop[];
};

export type StyleGradient = {
  v: Gradient;
  u: StyleUnit.GradientType;
};

export type StyleFillRule = {
  v: FillRule;
  u: StyleUnit.NUMBER;
};

export type StyleMask = {
  v: Mask;
  u: StyleUnit.NUMBER;
};

export type StyleStrokeLinecap = {
  v: StrokeLineCap;
  u: StyleUnit.NUMBER;
};

export type StyleStrokeLinejoin = {
  v: StrokeLineJoin;
  u: StyleUnit.NUMBER;
};

export type StyleStrokePosition = {
  v: StrokePosition;
  u: StyleUnit.NUMBER;
};

export type StyleShadow = {
  v: Shadow;
  u: StyleUnit.SHADOW;
};

export type Shadow = {
  x: number;
  y: number;
  blur: number;
  color: number[];
};

export type ComputedShadow = Shadow;

export enum Display {
  NONE = 0,
  BLOCK = 1,
  INLINE = 2,
  INLINE_BLOCK = 3,
  FLEX = 4,
  GRID = 5,
}

export type StyleDisplay = {
  v: Display;
  u: StyleUnit.NUMBER;
};

export enum Position {
  STATIC = 0,
  RELATIVE = 1,
  ABSOLUTE = 2,
}

export type StylePosition = {
  v: Position,
  u: StyleUnit.NUMBER;
};

export type Style = {
  position: StylePosition;
  display: StyleDisplay;
  top: StyleNum;
  right: StyleNum;
  bottom: StyleNum;
  left: StyleNum;
  width: StyleNum;
  height: StyleNum;
  lineHeight: StyleNum;
  fontFamily: StyleStr;
  fontSize: StyleNum;
  fontWeight: StyleNum;
  fontStyle: StyleFontStyle;
  letterSpacing: StyleNum;
  paragraphSpacing: StyleNum;
  textAlign: StyleTextAlign;
  textVerticalAlign: StyleTextVerticalAlign;
  textDecoration: StyleTextDecoration[];
  textShadow: StyleShadow;
  color: StyleColor;
  visibility: StyleVisibility;
  opacity: StyleNum;
  backgroundColor: StyleColor;
  fill: Array<StyleColor | StyleGradient>;
  fillEnable: StyleBool[];
  fillOpacity: StyleNum[];
  fillMode: StyleMixBlendMode[];
  fillRule: StyleFillRule;
  stroke: Array<StyleColor | StyleGradient>;
  strokeEnable: StyleBool[];
  strokeWidth: StyleNum[];
  strokePosition: StyleStrokePosition[];
  strokeMode: StyleMixBlendMode[];
  strokeDasharray: StyleNum[];
  strokeLinecap: StyleStrokeLinecap;
  strokeLinejoin: StyleStrokeLinejoin;
  strokeMiterlimit: StyleNum;
  translateX: StyleNum;
  translateY: StyleNum;
  translateZ: StyleNum;
  skewX: StyleNum;
  skewY: StyleNum;
  scaleX: StyleNum;
  scaleY: StyleNum;
  rotateX: StyleNum;
  rotateY: StyleNum;
  rotateZ: StyleNum;
  transformOrigin: [StyleNum, StyleNum];
  perspective: StyleNum;
  perspectiveOrigin: [StyleNum, StyleNum];
  perspectiveSelf: StyleNum;
  pointerEvents: StyleBool;
  maskMode: StyleMask;
  breakMask: StyleBool;
  mixBlendMode: StyleMixBlendMode;
  objectFit: StyleObjectFit;
  borderTopLeftRadius: StyleNum;
  borderTopRightRadius: StyleNum;
  borderBottomLeftRadius: StyleNum;
  borderBottomRightRadius: StyleNum;
  overflow: StyleOverflow;
  filter: (StyleFilter)[];
};

export type ComputedStyle = {
  position: Position;
  display: Display;
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
  lineHeight: number;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontStyle: FontStyle;
  letterSpacing: number;
  paragraphSpacing: number;
  textAlign: TextAlign;
  textVerticalAlign: TextVerticalAlign;
  textDecoration: TextDecoration[];
  textShadow: ComputedShadow;
  color: number[];
  visibility: Visibility;
  opacity: number;
  backgroundColor: number[];
  fill: Array<number[] | ComputedGradient>;
  fillEnable: boolean[];
  fillOpacity: number[];
  fillMode: MixBlendMode[];
  fillRule: FillRule;
  stroke: Array<number[] | ComputedGradient>;
  strokeEnable: boolean[];
  strokeWidth: number[];
  strokePosition: StrokePosition[];
  strokeMode: MixBlendMode[];
  strokeDasharray: number[];
  strokeLinecap: StrokeLineCap;
  strokeLinejoin: StrokeLineJoin;
  strokeMiterlimit: number;
  translateX: number;
  translateY: number;
  translateZ: number;
  skewX: number;
  skewY: number;
  scaleX: number;
  scaleY: number;
  rotateX: number;
  rotateY: number;
  rotateZ: number;
  transformOrigin: [number, number];
  perspective: number;
  perspectiveOrigin: [number, number];
  perspectiveSelf: number;
  mixBlendMode: MixBlendMode;
  pointerEvents: boolean;
  maskMode: Mask;
  breakMask: boolean;
  objectFit: ObjectFit;
  borderTopLeftRadius: number;
  borderTopRightRadius: number;
  borderBottomLeftRadius: number;
  borderBottomRightRadius: number;
  overflow: Overflow;
  filter: (ComputedFilter)[];
};

export enum TextAlign {
  LEFT = 0,
  RIGHT = 1,
  CENTER = 2,
  JUSTIFY = 3,
}

export enum TextVerticalAlign {
  TOP = 0,
  MIDDLE = 1,
  BOTTOM = 2,
}

export enum MixBlendMode {
  NORMAL = 0,
  MULTIPLY = 1,
  SCREEN = 2,
  OVERLAY = 3,
  DARKEN = 4,
  LIGHTEN = 5,
  COLOR_DODGE = 6,
  COLOR_BURN = 7,
  HARD_LIGHT = 8,
  SOFT_LIGHT = 9,
  DIFFERENCE = 10,
  EXCLUSION = 11,
  HUE = 12,
  SATURATION = 13,
  COLOR = 14,
  LUMINOSITY = 15,
}

export enum FontStyle {
  NORMAL = 0,
  ITALIC = 1,
  OBLIQUE = 2,
}

export enum GradientType {
  LINEAR = 0,
  RADIAL = 1,
  CONIC = 2,
}

export enum FillRule {
  NON_ZERO = 0,
  EVEN_ODD = 1,
}

export enum Mask {
  NONE = 0,
  OUTLINE = 1,
  ALPHA = 2,
  GRAY = 3,
  ALPHA_WITH = 4,
  GRAY_WITH = 5,
}

export enum StrokeLineCap {
  BUTT = 0,
  ROUND = 1,
  SQUARE = 2,
}

export enum StrokeLineJoin {
  MITER = 0,
  ROUND = 1,
  BEVEL = 2,
}

export enum StrokePosition {
  CENTER = 0,
  INSIDE = 1,
  OUTSIDE = 2,
}

export enum PatternFillType {
  TILE = 0,
  FILL = 1,
  STRETCH = 2,
  FIT = 3,
}

export enum Visibility {
  VISIBLE = 0,
  HIDDEN = 1,
}

export enum TextDecoration {
  NONE = 0,
  UNDERLINE = 1,
  LINE_THROUGH = 2,
}

export enum Overflow {
  VISIBLE = 0,
  HIDDEN = 1,
  CLIP = 2,
}

export enum ObjectFit {
  FILL = 0,
  CONTAIN = 1,
  COVER = 2,
}

export type StyleOverflow = {
  v: Overflow;
  u: number;
}

export type GaussBlur = {
  v: {
    radius: StyleNum;
  },
  u: StyleUnit.GAUSS_BLUR;
};

export type ComputedGaussBlur = { radius: number, u: StyleUnit.GAUSS_BLUR };

export type RadialBlur = {
  v: {
    radius: StyleNum;
    center: [StyleNum, StyleNum];
  },
  u: StyleUnit.RADIAL_BLUR;
};

export type ComputedRadialBlur = { radius: number, center: [number, number], u: StyleUnit.RADIAL_BLUR };

export type MotionBlur = {
  v: {
    radius: StyleNum;
    angle: StyleNum;
    offset: StyleNum;
  },
  u: StyleUnit.MOTION_BLUR;
};

export type ComputedMotionBlur = { radius: number, angle: number, offset: number, u: StyleUnit.MOTION_BLUR };

export type Bloom = {
  v: {
    threshold: StyleNum;
    knee: StyleNum;
  },
  u: StyleUnit.BLOOM;
};

export type ComputedBloom = { threshold: number, knee: number, u: StyleUnit.BLOOM };

export type LightDark = {
  v: {
    radius: StyleNum;
    angle: StyleNum;
  },
  u: StyleUnit.LIGHT_DARK;
};

export type ComputedLightDark = {
  radius: number;
  angle: number;
  u: StyleUnit.LIGHT_DARK;
}

export type HueRotate = {
  v: {
    radius: StyleNum;
  },
  u: StyleUnit.HUE_ROTATE;
};

export type ComputedHueRotate = {
  radius: number;
  u: StyleUnit.HUE_ROTATE;
};

export type Saturate = {
  v: {
    radius: StyleNum;
  },
  u: StyleUnit.SATURATE;
};

export type ComputedSaturate = {
  radius: number;
  u: StyleUnit.SATURATE;
};

export type Brightness = {
  v: {
    radius: StyleNum;
  },
  u: StyleUnit.BRIGHTNESS;
};

export type ComputedBrightness = {
  radius: number;
  u: StyleUnit.BRIGHTNESS;
};

export type Contrast = {
  v: {
    radius: StyleNum;
  },
  u: StyleUnit.CONTRAST;
};

export type ComputedContrast = {
  radius: number;
  u: StyleUnit.CONTRAST;
};

export type Sepia = {
  v: {
    radius: StyleNum;
  },
  u: StyleUnit.SEPIA;
};

export type ComputedSepia = {
  radius: number;
  u: StyleUnit.SEPIA;
};

export type Rich = Pick<Style,
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
> & RichIndex;

export type ComputedRich = Pick<ComputedStyle,
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
> & RichIndex;

export type ModifyRichStyle = Partial<Omit<Rich, 'location' | 'length'>>;

export type StyleFilter = GaussBlur | RadialBlur | MotionBlur | Bloom | LightDark
  | HueRotate | Saturate | Brightness | Contrast | Sepia | StyleShadow;

export type ComputedFilter = ComputedGaussBlur | ComputedRadialBlur | ComputedMotionBlur | ComputedBloom
  | ComputedLightDark | ComputedHueRotate | ComputedSaturate | ComputedBrightness | ComputedContrast
  | ComputedSepia | (ComputedShadow & { u: StyleUnit.SHADOW });

export function calUnit(v: string | number, degOrNumber2Px = false): StyleNum {
  if (v === 'auto') {
    return {
      v: 0,
      u: StyleUnit.AUTO,
    };
  }
  let n = parseFloat(v as string) || 0;
  if (/%$/.test(v as string)) {
    return {
      v: n,
      u: StyleUnit.PERCENT,
    };
  }
  else if (/px$/i.test(v as string)) {
    return {
      v: n,
      u: StyleUnit.PX,
    };
  }
  else if (/deg$/i.test(v as string)) {
    return {
      v: n,
      u: degOrNumber2Px ? StyleUnit.PX : StyleUnit.DEG,
    };
  }
  return {
    v: n,
    u: degOrNumber2Px ? StyleUnit.PX : StyleUnit.NUMBER,
  };
}

export const RICH_KEYS = [
  'fontFamily',
  'fontSize',
  'fontWeight',
  'lineHeight',
  'letterSpacing',
  'paragraphSpacing',
  'fontStyle',
  'textAlign',
  'textDecoration',
  'color',
  'textShadow',
  'stroke',
  'strokeWidth',
  'strokeEnable',
  'opacity',
  'visibility',
];

export enum CurveMode {
  NONE = 0,
  STRAIGHT = 1,
  MIRRORED = 2,
  ASYMMETRIC = 3,
  DISCONNECTED = 4,
}

export default {
  StyleUnit,
  TextAlign,
  TextVerticalAlign,
  MixBlendMode,
  FontStyle,
  GradientType,
  FillRule,
  Mask,
  StrokeLineCap,
  StrokeLineJoin,
  StrokePosition,
  PatternFillType,
  Visibility,
  TextDecoration,
  Overflow,
  calUnit,
  RICH_KEYS,
};
