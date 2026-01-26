import { RichIndex } from '../format';
import { DISPLAY, POSITION } from '../layout/define';

export enum StyleUnit {
  AUTO = 0,
  PX = 1,
  PERCENT = 2,
  NUMBER = 3,
  DEG = 4,
  RGBA = 5,
  BOOLEAN = 6,
  STRING = 7,
  GRADIENT = 8,
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

export type StyleStrValue = {
  v: string;
  u: StyleUnit.STRING;
};

export type StyleNumValue = {
  v: number;
  u:
    | StyleUnit.AUTO
    | StyleUnit.PX
    | StyleUnit.PERCENT
    | StyleUnit.NUMBER
    | StyleUnit.DEG;
};

export type StyleBoolValue = {
  v: boolean;
  u: StyleUnit.BOOLEAN;
};

export type StyleVisibilityValue = {
  v: VISIBILITY;
  u: StyleUnit.NUMBER;
};

export type StyleColorValue = {
  v: number[];
  u: StyleUnit.RGBA;
};

export type StyleFontStyleValue = {
  v: FONT_STYLE;
  u: StyleUnit.STRING;
};

export type StyleBooleanOperationValue = {
  v: BOOLEAN_OPERATION;
  u: StyleUnit.NUMBER;
};

export type StyleMbmValue = {
  v: MIX_BLEND_MODE;
  u: StyleUnit.NUMBER;
};

export type StyleObjectFitValue = {
  v: OBJECT_FIT;
  u: StyleUnit.NUMBER;
};

export type StyleTaValue = {
  v: TEXT_ALIGN;
  u: StyleUnit.NUMBER;
};

export type StyleTvaValue = {
  v: TEXT_VERTICAL_ALIGN;
  u: StyleUnit.NUMBER;
};

export type StyleTdValue = {
  v: TEXT_DECORATION;
  u: StyleUnit.NUMBER;
};

export type ColorStop = {
  color: StyleColorValue;
  offset: StyleNumValue;
};

export type ComputedColorStop = {
  color: number[];
  offset: number;
};

export type Gradient = {
  t: GRADIENT;
  d: number[];
  stops: ColorStop[];
};

export type ComputedGradient = {
  t: GRADIENT;
  d: number[];
  stops: ComputedColorStop[];
};

export type StyleGradientValue = {
  v: Gradient;
  u: StyleUnit.GRADIENT;
};

export type StyleFillRuleValue = {
  v: FILL_RULE;
  u: StyleUnit.NUMBER;
};

export type StyleMaskValue = {
  v: MASK;
  u: StyleUnit.NUMBER;
};

export type StyleStrokeLinecapValue = {
  v: STROKE_LINE_CAP;
  u: StyleUnit.NUMBER;
};

export type StyleStrokeLinejoinValue = {
  v: STROKE_LINE_JOIN;
  u: StyleUnit.NUMBER;
};

export type StyleStrokePositionValue = {
  v: STROKE_POSITION;
  u: StyleUnit.NUMBER;
};

export type StyleTextShadowValue = {
  v: TextShadow;
  u: StyleUnit.SHADOW;
};

export type TextShadow = {
  x: number;
  y: number;
  blur: number;
  color: number[];
};

export type ComputedTextShadow = TextShadow;

export type StyleDisplayValue = {
  v: DISPLAY;
  u: StyleUnit.NUMBER;
};

export type StylePositionValue = {
  v: POSITION,
  u: StyleUnit.NUMBER;
};

export type Style = {
  position: StylePositionValue;
  display: StyleDisplayValue;
  top: StyleNumValue;
  right: StyleNumValue;
  bottom: StyleNumValue;
  left: StyleNumValue;
  width: StyleNumValue;
  height: StyleNumValue;
  lineHeight: StyleNumValue;
  fontFamily: StyleStrValue;
  fontSize: StyleNumValue;
  fontWeight: StyleNumValue;
  fontStyle: StyleFontStyleValue;
  letterSpacing: StyleNumValue;
  paragraphSpacing: StyleNumValue;
  textAlign: StyleTaValue;
  textVerticalAlign: StyleTvaValue;
  textDecoration: StyleTdValue[];
  textShadow: StyleTextShadowValue;
  color: StyleColorValue;
  visibility: StyleVisibilityValue;
  opacity: StyleNumValue;
  backgroundColor: StyleColorValue;
  fill: Array<StyleColorValue | StyleGradientValue>;
  fillEnable: StyleBoolValue[];
  fillOpacity: StyleNumValue[];
  fillMode: StyleMbmValue[];
  fillRule: StyleFillRuleValue;
  stroke: Array<StyleColorValue | StyleGradientValue>;
  strokeEnable: StyleBoolValue[];
  strokeWidth: StyleNumValue[];
  strokePosition: StyleStrokePositionValue[];
  strokeMode: StyleMbmValue[];
  strokeDasharray: StyleNumValue[];
  strokeLinecap: StyleStrokeLinecapValue;
  strokeLinejoin: StyleStrokeLinejoinValue;
  strokeMiterlimit: StyleNumValue;
  translateX: StyleNumValue;
  translateY: StyleNumValue;
  translateZ: StyleNumValue;
  skewX: StyleNumValue;
  skewY: StyleNumValue;
  scaleX: StyleNumValue;
  scaleY: StyleNumValue;
  rotateX: StyleNumValue;
  rotateY: StyleNumValue;
  rotateZ: StyleNumValue;
  transformOrigin: [StyleNumValue, StyleNumValue];
  perspective: StyleNumValue;
  perspectiveOrigin: [StyleNumValue, StyleNumValue];
  perspectiveSelf: StyleNumValue;
  pointerEvents: StyleBoolValue;
  maskMode: StyleMaskValue;
  breakMask: StyleBoolValue;
  mixBlendMode: StyleMbmValue;
  objectFit: StyleObjectFitValue;
  borderTopLeftRadius: StyleNumValue;
  borderTopRightRadius: StyleNumValue;
  borderBottomLeftRadius: StyleNumValue;
  borderBottomRightRadius: StyleNumValue;
  overflow: StyleOverflowValue;
  filter: (StyleFilter)[];
};

export { DISPLAY, POSITION };

export type ComputedStyle = {
  position: POSITION;
  display: DISPLAY;
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
  fontStyle: FONT_STYLE;
  letterSpacing: number;
  paragraphSpacing: number;
  textAlign: TEXT_ALIGN;
  textVerticalAlign: TEXT_VERTICAL_ALIGN;
  textDecoration: TEXT_DECORATION[];
  textShadow: ComputedTextShadow;
  color: number[];
  visibility: VISIBILITY;
  opacity: number;
  backgroundColor: number[];
  fill: Array<number[] | ComputedGradient>;
  fillEnable: boolean[];
  fillOpacity: number[];
  fillMode: MIX_BLEND_MODE[];
  fillRule: FILL_RULE;
  stroke: Array<number[] | ComputedGradient>;
  strokeEnable: boolean[];
  strokeWidth: number[];
  strokePosition: STROKE_POSITION[];
  strokeMode: MIX_BLEND_MODE[];
  strokeDasharray: number[];
  strokeLinecap: STROKE_LINE_CAP;
  strokeLinejoin: STROKE_LINE_JOIN;
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
  mixBlendMode: MIX_BLEND_MODE;
  pointerEvents: boolean;
  maskMode: MASK;
  breakMask: boolean;
  objectFit: OBJECT_FIT;
  borderTopLeftRadius: number;
  borderTopRightRadius: number;
  borderBottomLeftRadius: number;
  borderBottomRightRadius: number;
  overflow: OVERFLOW;
  filter: (ComputedFilter)[];
};

export enum TEXT_ALIGN {
  LEFT = 0,
  RIGHT = 1,
  CENTER = 2,
  JUSTIFY = 3,
}

export enum TEXT_VERTICAL_ALIGN {
  TOP = 0,
  MIDDLE = 1,
  BOTTOM = 2,
}

export enum MIX_BLEND_MODE {
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

export enum FONT_STYLE {
  NORMAL = 0,
  ITALIC = 1,
  OBLIQUE = 2,
}

export enum GRADIENT {
  LINEAR = 0,
  RADIAL = 1,
  CONIC = 2,
}

export enum BOOLEAN_OPERATION {
  NONE = 0,
  UNION = 1,
  SUBTRACT = 2,
  INTERSECT = 3,
  XOR = 4,
}

export enum FILL_RULE {
  NON_ZERO = 0,
  EVEN_ODD = 1,
}

export enum MASK {
  NONE = 0,
  OUTLINE = 1,
  ALPHA = 2,
  GRAY = 3,
  ALPHA_WITH = 4,
  GRAY_WITH = 5,
}

export enum STROKE_LINE_CAP {
  BUTT = 0,
  ROUND = 1,
  SQUARE = 2,
}

export enum STROKE_LINE_JOIN {
  MITER = 0,
  ROUND = 1,
  BEVEL = 2,
}

export enum STROKE_POSITION {
  CENTER = 0,
  INSIDE = 1,
  OUTSIDE = 2,
}

export enum PATTERN_FILL_TYPE {
  TILE = 0,
  FILL = 1,
  STRETCH = 2,
  FIT = 3,
}

export enum VISIBILITY {
  VISIBLE = 0,
  HIDDEN = 1,
}

export enum TEXT_DECORATION {
  NONE = 0,
  UNDERLINE = 1,
  LINE_THROUGH = 2,
}

export enum OVERFLOW {
  VISIBLE = 0,
  HIDDEN = 1,
  CLIP = 2,
}

export enum OBJECT_FIT {
  FILL = 0,
  CONTAIN = 1,
  COVER = 2,
}

export type StyleOverflowValue = {
  v: OVERFLOW;
  u: number;
}

export type GaussBlur = {
  v: {
    radius: StyleNumValue;
  },
  u: StyleUnit.GAUSS_BLUR;
};

export type ComputedGaussBlur = { radius: number, u: StyleUnit.GAUSS_BLUR };

export type RadialBlur = {
  v: {
    radius: StyleNumValue;
    center: [StyleNumValue, StyleNumValue];
  },
  u: StyleUnit.RADIAL_BLUR;
};

export type ComputedRadialBlur = { radius: number, center: [number, number], u: StyleUnit.RADIAL_BLUR };

export type MotionBlur = {
  v: {
    radius: StyleNumValue;
    angle: StyleNumValue;
    offset: StyleNumValue;
  },
  u: StyleUnit.MOTION_BLUR;
};

export type ComputedMotionBlur = { radius: number, angle: number, offset: number, u: StyleUnit.MOTION_BLUR };

export type Bloom = {
  v: {
    threshold: StyleNumValue;
    knee: StyleNumValue;
  },
  u: StyleUnit.BLOOM;
};

export type ComputedBloom = { threshold: number, knee: number, u: StyleUnit.BLOOM };

export type LightDark = {
  v: {
    radius: StyleNumValue;
    angle: StyleNumValue;
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
    radius: StyleNumValue;
  },
  u: StyleUnit.HUE_ROTATE;
};

export type ComputedHueRotate = {
  radius: number;
  u: StyleUnit.HUE_ROTATE;
};

export type Saturate = {
  v: {
    radius: StyleNumValue;
  },
  u: StyleUnit.SATURATE;
};

export type ComputedSaturate = {
  radius: number;
  u: StyleUnit.SATURATE;
};

export type Brightness = {
  v: {
    radius: StyleNumValue;
  },
  u: StyleUnit.BRIGHTNESS;
};

export type ComputedBrightness = {
  radius: number;
  u: StyleUnit.BRIGHTNESS;
};

export type Contrast = {
  v: {
    radius: StyleNumValue;
  },
  u: StyleUnit.CONTRAST;
};

export type ComputedContrast = {
  radius: number;
  u: StyleUnit.CONTRAST;
};

export type Sepia = {
  v: {
    radius: StyleNumValue;
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
  | HueRotate | Saturate | Brightness | Contrast | Sepia;

export type ComputedFilter = ComputedGaussBlur | ComputedRadialBlur | ComputedMotionBlur | ComputedBloom
  | ComputedLightDark | ComputedHueRotate | ComputedSaturate | ComputedBrightness | ComputedContrast
  | ComputedSepia;

export function calUnit(v: string | number, degOrNumber2Px = false): StyleNumValue {
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

export enum CURVE_MODE {
  NONE = 0,
  STRAIGHT = 1,
  MIRRORED = 2,
  ASYMMETRIC = 3,
  DISCONNECTED = 4,
}

export default {
  StyleUnit,
  TEXT_ALIGN,
  TEXT_VERTICAL_ALIGN,
  MIX_BLEND_MODE,
  FONT_STYLE,
  GRADIENT,
  FILL_RULE,
  MASK,
  STROKE_LINE_CAP,
  STROKE_LINE_JOIN,
  STROKE_POSITION,
  PATTERN_FILL_TYPE,
  VISIBILITY,
  TEXT_DECORATION,
  OVERFLOW,
  calUnit,
  RICH_KEYS,
};
