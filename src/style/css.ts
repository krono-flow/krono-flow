import { JPoint, JRich, JStyle, Point } from '../format';
import inject from '../util/inject';
import { isNil, isString } from '../util/type';
import {
  calUnit,
  ComputedFilter,
  ComputedRich,
  ComputedStyle,
  CURVE_MODE,
  FILL_RULE,
  FONT_STYLE,
  Gradient,
  MASK,
  MIX_BLEND_MODE,
  OBJECT_FIT,
  OVERFLOW,
  PATTERN_FILL_TYPE,
  Rich,
  RICH_KEYS,
  STROKE_LINE_CAP,
  STROKE_LINE_JOIN,
  STROKE_POSITION,
  Style,
  StyleBoolValue,
  StyleColorValue,
  StyleFilter,
  StyleGradientValue,
  StyleMbmValue,
  StyleNumValue,
  StyleStrokePositionValue,
  StyleTdValue,
  StyleTextShadowValue,
  StyleUnit,
  TEXT_ALIGN,
  TEXT_DECORATION,
  TEXT_VERTICAL_ALIGN,
  TextShadow,
  VISIBILITY,
} from './define';
import reg from './reg';
import { color2rgbaInt, color2rgbaStr } from './color';
import font from './font';
import { convert2Css, isGradient, parseGradient } from './gradient';
import config from '../config';

function compatibleTransform(k: string, v: StyleNumValue) {
  if (k === 'scaleX' || k === 'scaleY') {
    v.u = StyleUnit.NUMBER;
  }
  else if (k === 'translateX' || k === 'translateY' || k === 'translateZ'
    || k === 'perspective' || k === 'perspectiveSelf') {
    if (v.u === StyleUnit.NUMBER) {
      v.u = StyleUnit.PX;
    }
  }
  else if (k === 'rotateX' || k === 'rotateY' || k === 'rotateZ') {
    if (v.u === StyleUnit.NUMBER) {
      v.u = StyleUnit.DEG;
    }
  }
}

export function normalize(style: Partial<JStyle>) {
  const res: any = {};
  [
    'left', 'top', 'right', 'bottom', 'width', 'height',
    'borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius',
  ].forEach((k) => {
    let v = style[k as keyof JStyle];
    if (v === undefined) {
      return;
    }
    const n = calUnit((v as string | number) || 0, true);
    // 限定正数
    if (k === 'width' || k === 'height') {
      if (n.v < 0) {
        n.v = 0;
      }
    }
    res[k] = n;
  });
  if (style.lineHeight !== undefined) {
    const lineHeight = style.lineHeight;
    if (isNil(lineHeight) || lineHeight === 'normal') {
      res.lineHeight = {
        v: 0,
        u: StyleUnit.AUTO,
      };
    }
    else {
      let n = calUnit(lineHeight || 0, true);
      if (n.v <= 0) {
        n = {
          v: 0,
          u: StyleUnit.AUTO,
        };
      }
      res.lineHeight = n;
    }
  }
  if (style.fontFamily !== undefined) {
    res.fontFamily = {
      v: style.fontFamily
        .trim()
        .replace(/['"]/g, '')
        .replace(/\s*,\s*/g, ','),
      u: StyleUnit.STRING,
    };
  }
  if (style.fontSize !== undefined) {
    let n = calUnit(style.fontSize || config.defaultFontSize, true);
    if (n.v <= 0) {
      n.v = config.defaultFontSize;
    }
    res.fontSize = n;
  }
  if (style.fontWeight !== undefined) {
    const fontWeight = style.fontWeight;
    if (isString(fontWeight)) {
      if (/thin/i.test(fontWeight as string)) {
        res.fontWeight = { v: 100, u: StyleUnit.NUMBER };
      }
      else if (/lighter/i.test(fontWeight as string)) {
        res.fontWeight = { v: 200, u: StyleUnit.NUMBER };
      }
      else if (/light/i.test(fontWeight as string)) {
        res.fontWeight = { v: 300, u: StyleUnit.NUMBER };
      }
      else if (/medium/i.test(fontWeight as string)) {
        res.fontWeight = { v: 500, u: StyleUnit.NUMBER };
      }
      else if (/semiBold/i.test(fontWeight as string)) {
        res.fontWeight = { v: 600, u: StyleUnit.NUMBER };
      }
      else if (/bold/i.test(fontWeight as string)) {
        res.fontWeight = { v: 700, u: StyleUnit.NUMBER };
      }
      else if (/extraBold/i.test(fontWeight as string)) {
        res.fontWeight = { v: 800, u: StyleUnit.NUMBER };
      }
      else if (/black/i.test(fontWeight as string)) {
        res.fontWeight = { v: 900, u: StyleUnit.NUMBER };
      }
      else {
        res.fontWeight = { v: 400, u: StyleUnit.NUMBER };
      }
    }
    else {
      res.fontWeight = {
        v: Math.min(900, Math.max(100, parseInt(fontWeight as string) || 400)),
        u: StyleUnit.NUMBER,
      };
    }
  }
  if (style.fontStyle !== undefined) {
    const fontStyle = style.fontStyle;
    let v = FONT_STYLE.NORMAL;
    if (fontStyle && /italic/i.test(fontStyle)) {
      v = FONT_STYLE.ITALIC;
    }
    else if (fontStyle && /oblique/i.test(fontStyle)) {
      v = FONT_STYLE.OBLIQUE;
    }
    res.fontStyle = { v, u: StyleUnit.NUMBER };
  }
  if (style.letterSpacing !== undefined) {
    res.letterSpacing = calUnit(style.letterSpacing || 0, true);
  }
  if (style.paragraphSpacing !== undefined) {
    res.paragraphSpacing = calUnit(style.paragraphSpacing || 0, true);
  }
  if (style.textAlign !== undefined) {
    const textAlign = style.textAlign;
    let v = TEXT_ALIGN.LEFT;
    if (textAlign === 'center') {
      v = TEXT_ALIGN.CENTER;
    }
    else if (textAlign === 'right') {
      v = TEXT_ALIGN.RIGHT;
    }
    else if (textAlign === 'justify') {
      v = TEXT_ALIGN.JUSTIFY;
    }
    res.textAlign = { v, u: StyleUnit.NUMBER };
  }
  if (style.textVerticalAlign !== undefined) {
    const textVerticalAlign = style.textVerticalAlign;
    let v = TEXT_VERTICAL_ALIGN.TOP;
    if (textVerticalAlign === 'middle') {
      v = TEXT_VERTICAL_ALIGN.MIDDLE;
    }
    else if (textVerticalAlign === 'bottom') {
      v = TEXT_VERTICAL_ALIGN.BOTTOM;
    }
    res.textVerticalAlign = { v, u: StyleUnit.NUMBER };
  }
  if (style.textDecoration !== undefined) {
    const textDecoration = style.textDecoration;
    if (Array.isArray(textDecoration)) {
      res.textDecoration = textDecoration.map(item => {
        let v = TEXT_DECORATION.NONE;
        if (item === 'underline') {
          v = TEXT_DECORATION.UNDERLINE;
        }
        else if (item === 'line-through' || item === 'lineThrough') {
          v = TEXT_DECORATION.LINE_THROUGH;
        }
        return { v, u: StyleUnit.NUMBER };
      });
    }
    else {
      res.textDecoration = [];
    }
  }
  if (style.textShadow !== undefined) {
    if (reg.shadow.test(style.textShadow)) {
      const v = reg.shadow.exec(style.textShadow);
      if (v) {
        res.textShadow = {
          v: {
            x: parseFloat(v[1]),
            y: parseFloat(v[2]),
            blur: parseFloat(v[3]),
            color: color2rgbaInt(v[4]),
          },
          u: StyleUnit.SHADOW,
        };
      }
    }
    else {
      res.textShadow = {
        u: StyleUnit.SHADOW,
      };
    }
  }
  if (style.color !== undefined) {
    res.color = { v: color2rgbaInt(style.color), u: StyleUnit.RGBA };
  }
  if (style.visibility !== undefined) {
    res.visibility = {
      v: /hidden/i.test(style.visibility) ? VISIBILITY.HIDDEN : VISIBILITY.VISIBLE,
      u: StyleUnit.NUMBER,
    };
  }
  if (style.opacity !== undefined) {
    res.opacity = { v: Math.max(0, Math.min(1, style.opacity!)), u: StyleUnit.NUMBER };
  }
  if (style.backgroundColor !== undefined) {
    res.backgroundColor = { v: color2rgbaInt(style.backgroundColor), u: StyleUnit.RGBA };
  }
  if (style.fill !== undefined) {
    const fill = style.fill;
    if (Array.isArray(fill)) {
      res.fill = fill.map((item: string | number[]) => {
        if (isString(item)) {
          if (isGradient(item as string)) {
            const v = parseGradient(item as string);
            if (v) {
              return { v, u: StyleUnit.GRADIENT };
            }
          }
        }
        return { v: color2rgbaInt(item), u: StyleUnit.RGBA };
      });
    }
    else {
      res.fill = [];
    }
  }
  if (style.fillEnable !== undefined) {
    const fillEnable = style.fillEnable;
    if (Array.isArray(fillEnable)) {
      res.fillEnable = fillEnable.map((item: boolean) => {
        return { v: item, u: StyleUnit.BOOLEAN };
      });
    }
    else {
      res.fillEnable = res.fill.map(() => ({ v: true, u: StyleUnit.BOOLEAN }));
    }
  }
  if (style.fillOpacity !== undefined) {
    const fillOpacity = style.fillOpacity;
    if (Array.isArray(fillOpacity)) {
      res.fillOpacity = fillOpacity.map((item: number) => {
        return { v: Math.max(0, Math.min(1, item)), u: StyleUnit.NUMBER };
      });
    }
    else {
      res.fillOpacity = res.fill.map(() => ({ v: 1, u: StyleUnit.NUMBER }));
    }
  }
  if (style.fillMode !== undefined) {
    const fillMode = style.fillMode;
    if (Array.isArray(fillMode)) {
      res.fillMode = fillMode.map((item: string) => {
        return { v: getBlendMode(item), u: StyleUnit.NUMBER };
      });
    }
    else {
      res.fillMode = res.fill.map(() => ({ v: MIX_BLEND_MODE.NORMAL, u : StyleUnit.NUMBER }));
    }
  }
  if (style.fillRule !== undefined) {
    const fillRule = style.fillRule;
    res.fillRule = {
      v: fillRule === 'evenodd' ? FILL_RULE.EVEN_ODD : FILL_RULE.NON_ZERO,
      u: StyleUnit.NUMBER,
    };
  }
  if (style.stroke !== undefined) {
    const stroke = style.stroke;
    if (Array.isArray(stroke)) {
      res.stroke = stroke.map((item: string | number[]) => {
        if (isString(item)) {
          if (isGradient(item as string)) {
            const v = parseGradient(item as string);
            if (v) {
              return { v, u: StyleUnit.GRADIENT };
            }
          }
          else if (reg.img.test(item as string)) {
            const v = reg.img.exec(item as string);
            if (v) {
              let type = PATTERN_FILL_TYPE.TILE;
              const s = (item as string).replace(v[0], '');
              if (s.indexOf('fill') > -1) {
                type = PATTERN_FILL_TYPE.FILL;
              }
              else if (s.indexOf('stretch') > -1) {
                type = PATTERN_FILL_TYPE.STRETCH;
              }
              else if (s.indexOf('fit') > -1) {
                type = PATTERN_FILL_TYPE.FIT;
              }
              let scale;
              const v2 = /([\d.]+)%/.exec(s);
              if (v2) {
                scale = {
                  v: parseFloat(v2[1]),
                  u: StyleUnit.PERCENT,
                };
              }
              return { v: { url: v[2], type, scale }, u: StyleUnit.PATTERN };
            }
          }
        }
        return { v: color2rgbaInt(item), u: StyleUnit.RGBA };
      });
    }
    else {
      res.stroke = [];
    }
  }
  if (style.strokeEnable !== undefined) {
    const strokeEnable = style.strokeEnable;
    if (Array.isArray(strokeEnable)) {
      res.strokeEnable = strokeEnable.map((item: boolean) => {
        return { v: item, u: StyleUnit.BOOLEAN };
      });
    }
    else {
      res.strokeEnable = res.stroke.map(() => ({ v: true, u: StyleUnit.BOOLEAN }));
    }
  }
  if (style.strokeWidth !== undefined) {
    const strokeWidth = style.strokeWidth;
    if (Array.isArray(strokeWidth)) {
      res.strokeWidth = strokeWidth.map((item: number) => {
        return { v: Math.max(0, item), u: StyleUnit.PX };
      });
    }
    else {
      res.strokeWidth = res.stroke.map(() => ({ v: 1, u: StyleUnit.NUMBER }));
    }
  }
  if (style.strokePosition !== undefined) {
    const strokePosition = style.strokePosition;
    if (Array.isArray(strokePosition)) {
      res.strokePosition = strokePosition.map((item: string) => {
        let v = STROKE_POSITION.CENTER;
        if (item === 'inside') {
          v = STROKE_POSITION.INSIDE;
        }
        else if (item === 'outside') {
          v = STROKE_POSITION.OUTSIDE;
        }
        return { v, u: StyleUnit.NUMBER };
      });
    }
    else {
      res.strokePosition = res.stroke.map(() => ({ v: STROKE_POSITION.CENTER, u: StyleUnit.NUMBER }));
    }
  }
  if (style.strokeMode !== undefined) {
    const strokeMode = style.strokeMode;
    if (Array.isArray(strokeMode)) {
      res.strokeMode = strokeMode.map((item: string) => {
        return { v: getBlendMode(item), u: StyleUnit.NUMBER };
      });
    }
    else {
      res.strokeMode = res.stroke.map(() => ({ v: MIX_BLEND_MODE.NORMAL, u: StyleUnit.NUMBER }));
    }
  }
  if (style.strokeDasharray !== undefined) {
    const strokeDasharray = style.strokeDasharray;
    if (Array.isArray(strokeDasharray)) {
      res.strokeDasharray = strokeDasharray.map((item: number) => {
        return { v: Math.max(0, item), u: StyleUnit.PX };
      });
    }
    else {
      res.strokeDasharray = [];
    }
  }
  if (style.strokeLinecap !== undefined) {
    const strokeLinecap = style.strokeLinecap;
    let v = STROKE_LINE_CAP.BUTT;
    if (strokeLinecap === 'round') {
      v = STROKE_LINE_CAP.ROUND;
    }
    else if (strokeLinecap === 'square') {
      v = STROKE_LINE_CAP.SQUARE;
    }
    res.strokeLinecap = { v, u: StyleUnit.NUMBER };
  }
  if (style.strokeLinejoin !== undefined) {
    const strokeLinejoin = style.strokeLinejoin;
    let v = STROKE_LINE_JOIN.MITER;
    if (strokeLinejoin === 'round') {
      v = STROKE_LINE_JOIN.ROUND;
    }
    else if (strokeLinejoin === 'bevel') {
      v = STROKE_LINE_JOIN.BEVEL;
    }
    res.strokeLinejoin = { v, u: StyleUnit.NUMBER };
  }
  if (style.strokeMiterlimit !== undefined) {
    res.strokeMiterlimit = { v: style.strokeMiterlimit, u: StyleUnit.NUMBER };
  }
  (['translateX', 'translateY', 'translateZ', 'skewX', 'skewY', 'scaleX', 'scaleY', 'rotateX', 'rotateY', 'rotateZ',
    'perspective', 'perspectiveSelf'] as const).forEach((k) => {
    const v = style[k];
    if (v === undefined) {
      return;
    }
    const n = calUnit(v as string | number);
    // 没有单位或默认值处理单位
    compatibleTransform(k, n);
    res[k] = n;
  });
  (['transformOrigin', 'perspectiveOrigin'] as const).forEach(k => {
    const v = style[k];
    if (v === undefined) {
      return;
    }
    let o: Array<number | string>;
    if (Array.isArray(v)) {
      o = v;
    }
    else {
      o = (v || '').toString().match(reg.position) as Array<string>;
    }
    if (!o || !o.length) {
      o = [50, 50];
    }
    else if (o.length === 1) {
      o[1] = o[0];
    }
    const arr: Array<StyleNumValue> = [];
    for (let i = 0; i < 2; i++) {
      let item = o[i];
      if (/^[-+]?[\d.]/.test(item as string)) {
        let n = calUnit(item, true);
        arr.push(n);
      }
      else {
        arr.push({
          v: {
            top: 0,
            left: 0,
            center: 50,
            right: 100,
            bottom: 100,
          }[item] as number,
          u: StyleUnit.PERCENT,
        });
        // 不规范的写法变默认值50%
        if (isNil(arr[i].v)) {
          arr[i].v = 50;
        }
      }
    }
    res[k] = arr;
  });
  if (style.mixBlendMode !== undefined) {
    res.mixBlendMode = { v: getBlendMode(style.mixBlendMode), u: StyleUnit.NUMBER };
  }
  if (style.pointerEvents !== undefined) {
    res.pointerEvents = { v: style.pointerEvents, u: StyleUnit.BOOLEAN };
  }
  if (style.hasOwnProperty('maskMode')) {
    const maskMode = style.maskMode;
    let v = MASK.NONE;
    if (maskMode === 'alpha') {
      v = MASK.ALPHA;
    }
    else if (maskMode === 'gray') {
      v = MASK.GRAY;
    }
    else if (maskMode === 'alpha-with') {
      v = MASK.ALPHA_WITH;
    }
    else if (maskMode === 'gray-with') {
      v = MASK.GRAY_WITH;
    }
    res.maskMode = { v, u: StyleUnit.NUMBER };
  }
  if (style.hasOwnProperty('breakMask')) {
    res.breakMask = { v: !!style.breakMask, u: StyleUnit.BOOLEAN };
  }
  if (style.objectFit !== undefined) {
    res.objectFit = { v: getObjectFit(style.objectFit), u: StyleUnit.NUMBER };
  }
  if (style.overflow !== undefined) {
    const overflow = style.overflow;
    let v = OVERFLOW.VISIBLE;
    if (overflow === 'hidden') {
      v = OVERFLOW.HIDDEN;
    }
    res.overflow = {
      v,
      u: StyleUnit.NUMBER,
    };
  }
  if (style.filter !== undefined) {
    const list = Array.isArray(style.filter) ? style.filter : [style.filter];
    const filter: StyleFilter[] = [];
    list.forEach(item => {
      const match = /([\w-]+)\s*\((\s*.+\s*)\)/i.exec(item as string);
      if (match) {
        const k = match[1];
        const v = match[2];
        if (k === 'gaussBlur') {
          const n = parseFloat(v) || 0;
          filter.push({
            v: {
              radius: { v: Math.max(n, 0), u: StyleUnit.PX },
            },
            u: StyleUnit.GAUSS_BLUR,
          });
        }
        else if (k === 'radiaBlur') {
          const n = parseFloat(v) || 0;
          const mc = /,\s*(.+)\s*(?:,\s*(.+))?/.exec(v);
          const center = [{ v: 50, u: StyleUnit.PERCENT }, { v: 50, u: StyleUnit.PERCENT }] as [StyleNumValue, StyleNumValue];
          if (mc) {
            const x = calUnit(mc[1] as string | number);
            if (x.u !== StyleUnit.PX && x.u !== StyleUnit.PERCENT) {
              x.u = StyleUnit.PX;
            }
            center[0] = x;
            if (mc[2]) {
              const y = calUnit(mc[2] as string | number);
              if (y.u !== StyleUnit.PX && y.u !== StyleUnit.PERCENT) {
                y.u = StyleUnit.PX;
              }
              center[1] = y;
            }
            else {
              center[1] = { v: x.v, u: x.u };
            }
          }
          filter.push({
            v: {
              radius: { v: Math.max(n, 0), u: StyleUnit.PX },
              center,
            },
            u: StyleUnit.RADIAL_BLUR,
          });
        }
        else if (k === 'motionBlur') {
          const n = parseFloat(v) || 0;
          const angle = { v: 0, u: StyleUnit.DEG } as StyleNumValue;
          const offset = { v: 0, u: StyleUnit.DEG } as StyleNumValue;
          const m = /,\s*(.+)\s*(?:,\s*(.+))?/.exec(v);
          if (m) {
            const a = parseFloat(m[1]);
            angle.v = a || 0;
            if (m[2]) {
              const x = calUnit(m[2] as string | number);
              offset.v = x.v;
            }
          }
          filter.push({
            v: {
              radius: { v: Math.max(n, 0), u: StyleUnit.PX },
              angle,
              offset,
            },
            u: StyleUnit.MOTION_BLUR,
          });
        }
        else if (k === 'bloom') {
          const n = parseFloat(v) || 0;
          const mk = /,\s*([^,]+)/.exec(v);
          const knee = { v: 0.5, u: StyleUnit.NUMBER } as StyleNumValue;
          if (mk) {
            const b = calUnit(mk[1] as string | number);
            knee.v = Math.max(0, b.v);
          }
          filter.push({
            v: {
              threshold: { v: Math.max(n, 0), u: StyleUnit.NUMBER },
              knee,
            },
            u: StyleUnit.BLOOM,
          });
        }
        else if (k === 'lightDark') {
          const n = parseFloat(v) || 0;
          const angle = { v: 0, u: StyleUnit.DEG } as StyleNumValue;
          const m = /,\s*(.+)\s*(?:,\s*(.+))?/.exec(v);
          if (m) {
            const a = parseFloat(m[1]);
            angle.v = a || 0;
          }
          filter.push({
            v: {
              radius: { v: Math.max(n, 0), u: StyleUnit.PX },
              angle,
            },
            u: StyleUnit.LIGHT_DARK,
          });
        }
        else if (k === 'hueRotate') {
          const n = parseFloat(v) || 0;
          filter.push({
            v: {
              radius: { v: n, u: StyleUnit.DEG },
            },
            u: StyleUnit.HUE_ROTATE,
          });
        }
        else if (k === 'saturate') {
          const n = parseFloat(v) || 0;
          filter.push({
            v: {
              radius: { v: n * 0.01, u: StyleUnit.PERCENT },
            },
            u: StyleUnit.SATURATE,
          });
        }
        else if (k === 'brightness') {
          const n = parseFloat(v) || 0;
          filter.push({
            v: {
              radius: { v: n * 0.01, u: StyleUnit.PERCENT },
            },
            u: StyleUnit.BRIGHTNESS,
          });
        }
        else if (k === 'contrast') {
          const n = parseFloat(v) || 0;
          filter.push({
            v: {
              radius: { v: n * 0.01, u: StyleUnit.PERCENT },
            },
            u: StyleUnit.CONTRAST,
          });
        }
        else if (k === 'sepia') {
          const n = parseFloat(v) || 0;
          filter.push({
            v: {
              radius: { v: n * 0.01, u: StyleUnit.PERCENT },
            },
            u: StyleUnit.SEPIA,
          });
        }
      }
    });
    res.filter = filter;
  }
  return res;
}

export function setFontStyle(style: ComputedStyle | ComputedRich) {
  const fontSize = style.fontSize || config.defaultFontSize;
  let fontFamily = style.fontFamily || config.defaultFontFamily;
  if (/[\s.,/\\]/.test(fontFamily)) {
    fontFamily = '"' + fontFamily.replace(/"/g, '\\"') + '"';
  }
  let fontStyle = '';
  if (style.fontStyle === FONT_STYLE.ITALIC) {
    fontStyle = 'italic ';
  }
  let fontWeight = '';
  if (style.fontWeight !== 400) {
    fontWeight = style.fontWeight + ' ';
  }
  return (
    fontStyle +
    fontWeight +
    fontSize + 'px ' +
    fontFamily
  );
}

export function calFontFamily(fontFamily: string) {
  const ff = fontFamily.split(/\s*,\s*/);
  for (let i = 0, len = ff.length; i < len; i++) {
    let item = ff[i].replace(/^['"]/, '').replace(/['"]$/, '');
    if (font.hasRegister(item) || inject.checkSupportFontFamily(item)) {
      return item;
    }
  }
  return config.defaultFontFamily;
}

export function calNormalLineHeight(style: Pick<ComputedStyle, 'fontFamily' | 'fontSize'>, ff?: string) {
  if (!ff) {
    ff = calFontFamily(style.fontFamily);
  }
  const lhr =
    (font.data[ff] || font.data[config.defaultFontFamily] || font.data.Arial || {})
      .lhr;
  return style.fontSize * lhr;
}

/**
 * https://zhuanlan.zhihu.com/p/25808995
 * 根据字形信息计算baseline的正确值，差值上下均分
 */
export function getBaseline(style: Pick<ComputedStyle, 'fontSize' | 'fontFamily' | 'lineHeight'>, lineHeight?: number) {
  const fontSize = style.fontSize;
  const ff = calFontFamily(style.fontFamily);
  const normal = calNormalLineHeight(style, ff);
  const blr =
    (font.data[ff] || font.data[config.defaultFontFamily] || font.data.Arial || {})
      .blr || 1;
  return ((lineHeight ?? style.lineHeight) - normal) * 0.5 + fontSize * blr;
}

export function getContentArea(style: Pick<ComputedStyle, 'fontSize' | 'fontFamily' | 'lineHeight'>, lineHeight?: number) {
  const fontSize = style.fontSize;
  const ff = calFontFamily(style.fontFamily);
  const normal = calNormalLineHeight(style, ff);
  const car =
    (font.data[ff] || font.data[config.defaultFontFamily] || font.data.Arial || {})
      .car || 1;
  return ((lineHeight ?? style.lineHeight) - normal) * 0.5 + fontSize * car;
}

export function getBlendMode(blend: string) {
  let v = MIX_BLEND_MODE.NORMAL;
  if (/multiply/i.test(blend)) {
    v = MIX_BLEND_MODE.MULTIPLY;
  }
  else if (/screen/i.test(blend)) {
    v = MIX_BLEND_MODE.SCREEN;
  }
  else if (/overlay/i.test(blend)) {
    v = MIX_BLEND_MODE.OVERLAY;
  }
  else if (/darken/i.test(blend)) {
    v = MIX_BLEND_MODE.DARKEN;
  }
  else if (/lighten/i.test(blend)) {
    v = MIX_BLEND_MODE.LIGHTEN;
  }
  else if (/color[-\s]dodge/i.test(blend) || /colorDodge/.test(blend)) {
    v = MIX_BLEND_MODE.COLOR_DODGE;
  }
  else if (/color[-\s]burn/i.test(blend) || /colorBurn/.test(blend)) {
    v = MIX_BLEND_MODE.COLOR_BURN;
  }
  else if (/hard[\-\s]light/i.test(blend) || /hardLight/.test(blend)) {
    v = MIX_BLEND_MODE.HARD_LIGHT;
  }
  else if (/soft[-\s]light/i.test(blend) || /softLight/.test(blend)) {
    v = MIX_BLEND_MODE.SOFT_LIGHT;
  }
  else if (/difference/i.test(blend)) {
    v = MIX_BLEND_MODE.DIFFERENCE;
  }
  else if (/exclusion/i.test(blend)) {
    v = MIX_BLEND_MODE.EXCLUSION;
  }
  else if (/hue/i.test(blend)) {
    v = MIX_BLEND_MODE.HUE;
  }
  else if (/saturation/i.test(blend)) {
    v = MIX_BLEND_MODE.SATURATION;
  }
  else if (/color/i.test(blend)) {
    v = MIX_BLEND_MODE.COLOR;
  }
  else if (/luminosity/i.test(blend)) {
    v = MIX_BLEND_MODE.LUMINOSITY;
  }
  return v;
}

export function getObjectFit(s: string) {
  let v = OBJECT_FIT.FILL;
  if (s === 'contain') {
    v = OBJECT_FIT.CONTAIN;
  }
  else if (s === 'cover') {
    v = OBJECT_FIT.COVER;
  }
  return v;
}

export function equalStyle(a: Partial<Style>, b: Partial<Style>, k: keyof Style) {
  if (a === b) {
    return true;
  }
  let as = a[k] as any;
  let bs = b[k] as any;
  if (as === undefined && bs === undefined) {
    return true;
  }
  if (as === undefined || bs === undefined) {
    return false;
  }
  if (k === 'transformOrigin' || k === 'perspectiveOrigin') {
    return (
      as[0].v === bs[0].v &&
      as[0].u === bs[0].u &&
      as[1].v === bs[1].v &&
      as[1].u === bs[1].u
    );
  }
  if (k === 'color' || k === 'backgroundColor') {
    return (
      as.v[0] === bs.v[0] &&
      as.v[1] === bs.v[1] &&
      as.v[2] === bs.v[2] &&
      as.v[3] === bs.v[3]
    );
  }
  if (k === 'fill' || k === 'stroke') {
    if (as.length !== bs.length) {
      return false;
    }
    for (let i = 0, len = as.length; i < len; i++) {
      const ai = as[i],
        bi = bs[i];
      if (ai.u !== bi.u) {
        return false;
      }
      if (ai.u === StyleUnit.RGBA) {
        if (
          ai.v[0] !== bi.v[0] ||
          ai.v[1] !== bi.v[1] ||
          ai.v[2] !== bi.v[2] ||
          ai.v[3] !== bi.v[3]
        ) {
          return false;
        }
      }
      else if (ai.u === StyleUnit.GRADIENT) {
        if (ai.v.t !== bi.v.t) {
          return false;
        }
        if (ai.v.d.length !== bi.v.d.length) {
          return false;
        }
        for (let i = 0, len = ai.v.d.length; i < len; i++) {
          if (ai.v.d[i] !== bi.v.d[i]) {
            return false;
          }
        }
        if (ai.v.stops.length !== bi.v.stops.length) {
          return false;
        }
        for (let i = 0, len = ai.v.stops.length; i < len; i++) {
          const as = ai.v.stops[i],
            bs = bi.v.stops[i];
          if (
            as.color.v[0] !== bs.color.v[0] ||
            as.color.v[1] !== bs.color.v[1] ||
            as.color.v[2] !== bs.color.v[2] ||
            as.color.v[3] !== bs.color.v[3]
          ) {
            return false;
          }
          if ((as.offset && !bs.offset) || (!as.offset && bs.offset)) {
            return false;
          }
          if (as.offset.u !== bs.offset.u || as.offset.v !== bs.offset.v) {
            return false;
          }
        }
      }
    }
    return true;
  }
  if (k === 'filter') {
    if (as.length !== bs.length) {
      return false;
    }
    for (let i = 0, len = as.length; i < len; i++) {
      const ai = as[i],
        bi = bs[i];
      if (ai.u !== bi.u) {
        return false;
      }
      if (ai.u === StyleUnit.GAUSS_BLUR) {
        if (ai.v.radius.v !== bi.v.radius.v) {
          return false;
        }
      }
      else if (ai.u === StyleUnit.RADIAL_BLUR) {
        if (ai.v.radius.v !== bi.v.radius.v) {
          return false;
        }
        if (ai.v.center[0].v !== bi.v.center[0].v || ai.v.center[1].v !== bi.v.center[1].v) {
          return false;
        }
      }
      else if (ai.u === StyleUnit.MOTION_BLUR) {
        if (ai.v.radius.v !== bi.v.radius.v) {
          return false;
        }
        if (ai.v.angle.v !== bi.v.angle.v || ai.v.offset.v !== bi.v.offset.v) {
          return false;
        }
      }
      else if (ai.u === StyleUnit.BLOOM) {
        if (ai.v.threshold.v !== bi.v.threshold.v || ai.v.knee.v !== bi.v.knee.v) {
          return false;
        }
      }
      else if (ai.u === StyleUnit.LIGHT_DARK) {
        if (ai.v.radius.v !== bi.v.radius.v || ai.v.angle.v !== bi.v.angle.v) {
          return false;
        }
      }
      else if (ai.u === StyleUnit.HUE_ROTATE
        || ai.u === StyleUnit.SATURATE
        || ai.u === StyleUnit.BRIGHTNESS
        || ai.u === StyleUnit.CONTRAST
        || ai.u === StyleUnit.SEPIA
      ) {
        if (ai.v.radius.v !== bi.v.radius.v) {
          return false;
        }
      }
    }
    return true;
  }
  if (
    k === 'fillEnable' ||
    k === 'fillRule' ||
    k === 'fillOpacity' ||
    k === 'strokeEnable' ||
    k === 'strokeWidth' ||
    k === 'strokePosition' ||
    k === 'strokeDasharray'
  ) {
    if (as.length !== bs.length) {
      return false;
    }
    for (let i = 0, len = as.length; i < len; i++) {
      const ai = as[i],
        bi = bs[i];
      if (ai.u !== bi.u || ai.v !== bi.v) {
        return false;
      }
    }
    return true;
  }
  // 剩下的都是都一样的最简单普通样式
  return (as as any).v === (bs as any).v && (as as any).u === (bs as any).u;
}

export function cloneStyle(style: Partial<Style>, keys?: string | string[]) {
  if (!keys) {
    keys = Object.keys(style);
  }
  else if (!Array.isArray(keys)) {
    keys = [keys];
  }
  const res: Partial<Style> = {};
  for (let i = 0, len = keys.length; i < len; i++) {
    const k = keys[i] as keyof Style;
    const v = style[k];
    if (!v) {
      continue;
    }
    // @ts-ignore
    res[k] = cloneStyleItem(k, v);
  }
  return res;
}

export function cloneStyleItem(k: keyof Style, v: Style[keyof Style]) {
  if (k === 'transformOrigin' || k === 'perspectiveOrigin') {
    return [Object.assign({}, (v as StyleNumValue[])[0]), Object.assign({}, (v as StyleNumValue[])[1])];
  }
  else if (k === 'color' || k === 'backgroundColor') {
    return {
      v: (v as StyleColorValue).v.slice(0),
      u: (v as StyleColorValue).u,
    };
  }
  else if (k === 'textShadow') {
    return {
      v: {
        x: (v as StyleTextShadowValue).v.x,
        y: (v as StyleTextShadowValue).v.y,
        blur: (v as StyleTextShadowValue).v.blur,
        color: (v as StyleTextShadowValue).v.color.slice(0),
      },
      u: (v as any).u,
    };
  }
  else if (k === 'fill' || k === 'stroke') {
    return (v as (StyleColorValue | StyleGradientValue)[]).map(item => {
      if (item.u === StyleUnit.RGBA) {
        return {
          v: item.v.slice(0),
          u: item.u,
        };
      }
      else if (item.u === StyleUnit.GRADIENT) {
        return {
          v: {
            t: item.v.t,
            d: item.v.d.slice(0),
            stops: item.v.stops.map(cs => {
              return {
                color: {
                  v: cs.color.v.slice(0),
                  u: cs.color.u,
                },
                offset: {
                  v: cs.offset.v,
                  u: cs.offset.u,
                },
              };
            }),
          },
          u: item.u,
        };
      }
    });
  }
  else if (k === 'fillMode' || k === 'strokeMode' || k === 'textDecoration') {
    return (v as (StyleMbmValue | StyleTdValue)[]).map(item => Object.assign({}, item));
  }
  else if (
    k === 'fillEnable' ||
    k === 'fillOpacity' ||
    k === 'strokeEnable' ||
    k === 'strokeWidth' ||
    k === 'strokePosition' ||
    k === 'strokeDasharray'
  ) {
    return (v as (StyleBoolValue | StyleNumValue | StyleStrokePositionValue)[]).map(item => Object.assign({}, item));
  }
  else if (k === 'filter') {
    return (v as StyleFilter[]).map(item => {
      const o: any = {};
      if (item.u === StyleUnit.GAUSS_BLUR) {
        o.radius = Object.assign({}, item.v.radius);
      }
      else if (item.u === StyleUnit.RADIAL_BLUR) {
        o.radius = Object.assign({}, item.v.radius);
        o.center = item.v.center.map(item => Object.assign({}, item));
      }
      else if (item.u === StyleUnit.MOTION_BLUR) {
        o.radius = Object.assign({}, item.v.radius);
        o.angle = Object.assign({}, item.v.angle);
        o.offset = Object.assign({}, item.v.offset);
      }
      else if (item.u === StyleUnit.BLOOM) {
        o.threshold = Object.assign({}, item.v.threshold);
        o.knee = Object.assign({}, item.v.knee);
      }
      else if (item.u === StyleUnit.LIGHT_DARK) {
        o.radius = Object.assign({}, item.v.radius);
        o.angle = Object.assign({}, item.v.angle);
      }
      else if (item.u === StyleUnit.HUE_ROTATE
        || item.u === StyleUnit.SATURATE
        || item.u === StyleUnit.BRIGHTNESS
        || item.u === StyleUnit.CONTRAST
        || item.u === StyleUnit.SEPIA) {
        o.radius = Object.assign({}, item.v.radius);
      }
      return {
        v: o,
        u: item.u,
      };
    });
  }
  else {
    return Object.assign({}, v);
  }
}

export function calSize(v: StyleNumValue, p: number): number {
  if (v.u === StyleUnit.PX) {
    return v.v;
  }
  if (v.u === StyleUnit.PERCENT) {
    return v.v * p * 0.01;
  }
  return 0;
}

export function normalizeRich(rich: Partial<JRich>, style: Style, complete = true) {
  const res: any = {};
  if (complete) {
    RICH_KEYS.forEach((k) => {
      const v = style[k as keyof Style];
      if (v !== undefined) {
        res[k] = v;
      }
    });
  }
  return {
    location: rich.location,
    length: rich.length,
    ...res,
    ...normalize(rich),
  } as Rich;
}

export function getCssMbm(v: MIX_BLEND_MODE) {
  return [
    'normal',
    'multiply',
    'screen',
    'overlay',
    'darken',
    'lighten',
    'color-dodge',
    'color-burn',
    'hard-light',
    'soft-light',
    'difference',
    'exclusion',
    'hue',
    'saturation',
    'color',
    'luminosity',
  ][v];
}

export function getCssObjectFit(v: OBJECT_FIT) {
  return ['fill', 'contain', 'cover'][v];
}

export function getCssFilter(filter: ComputedFilter) {
  if (filter.u === StyleUnit.GAUSS_BLUR) {
    return 'gaussBlur(' + filter.radius + ')';
  }
  else if (filter.u === StyleUnit.RADIAL_BLUR) {
    return 'radialBlur(' + filter.radius + ',' + filter.center.join(', ') + ')';
  }
  else if (filter.u === StyleUnit.MOTION_BLUR) {
    return 'motionBlur(' + filter.radius + ',' + filter.offset + ')';
  }
  else if (filter.u === StyleUnit.BLOOM) {
    return 'bloom(' + filter.threshold + ',' + filter.knee + ')';
  }
  else if (filter.u === StyleUnit.LIGHT_DARK) {
    return 'lightDark(' + filter.radius + ',' + filter.angle + ')';
  }
}

export function getCssFillStroke(item: number[] | Gradient, width?: number, height?: number, standard = false) {
  if (Array.isArray(item)) {
    return color2rgbaStr(item);
  }
  return convert2Css(item as Gradient, width, height, standard);
}

export function getCssStrokePosition(o: STROKE_POSITION) {
  return (['center', 'inside', 'outside'][o] || 'inside') as 'center' | 'inside' | 'outside';
}

export function normalizePoints(item: JPoint) {
  return {
    x: item.x,
    y: item.y,
    cornerRadius: item.cornerRadius || 0,
    fx: item.fx ?? item.x,
    fy: item.fy ?? item.y,
    tx: item.tx ?? item.x,
    ty: item.ty ?? item.y,
    hasCurveFrom: item.hasCurveFrom || false,
    hasCurveTo: item.hasCurveTo || false,
    curveMode: ({
      'none': CURVE_MODE.NONE,
      'straight': CURVE_MODE.STRAIGHT,
      'mirrored': CURVE_MODE.MIRRORED,
      'asymmetric': CURVE_MODE.ASYMMETRIC,
      'disconnected': CURVE_MODE.DISCONNECTED,
    }[item.curveMode || 'none'] || CURVE_MODE.NONE) as Point['curveMode'],
    absX: 0,
    absY: 0,
    absFx: 0,
    absFy: 0,
    absTx: 0,
    absTy: 0,
    dspX: 0,
    dspY: 0,
    dspFx: 0,
    dspFy: 0,
    dspTx: 0,
    dspTy: 0,
  };
}

export function getCssTextShadow(item?: TextShadow) {
  if (!item) {
    return 'none';
  }
  return item.x + 'px ' + item.y + 'px ' + item.blur + ' px ' + color2rgbaStr(item.color);
}

export function getPropsRich(rich: Rich) {
  return {
    fontFamily: rich.fontFamily.v,
    fontSize: rich.fontSize.v,
    fontWeight: rich.fontWeight.v,
    lineHeight: rich.lineHeight.v,
    letterSpacing: rich.letterSpacing.v,
    paragraphSpacing: rich.paragraphSpacing.v,
    fontStyle: ['normal', 'italic', 'oblique'][rich.fontStyle.v] || 'normal',
    color: color2rgbaStr(rich.color.v),
    textAlign: (['left', 'right', 'center', 'justify'][rich.textAlign.v] || 'left') as JRich['textAlign'],
    textDecoration: rich.textDecoration.map(item => {
      return ['none', 'underline', 'lineThrough'][item.v] || 'none';
    }),
    textShadow: getCssTextShadow(rich.textShadow.v),
    stroke: rich.stroke.map(item => {
      return getCssFillStroke(item.v, 1, 1, true);
    }),
    strokeWidth: rich.strokeWidth.map(item => item.v),
    strokeEnable: rich.strokeEnable.map(item => item.v),
  } as JRich;
}

export default {
  normalize,
  equalStyle,
  cloneStyle,
  calSize,
  normalizeRich,
  getCssMbm,
  getCssFillStroke,
  getCssStrokePosition,
  normalizePoints,
  getPropsRich,
};
