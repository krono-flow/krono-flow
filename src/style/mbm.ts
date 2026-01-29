import { MixBlendMode } from './define';

export function getCanvasGCO(blend: MixBlendMode) {
  switch (blend) {
    case MixBlendMode.MULTIPLY:
      return 'multiply';
    case MixBlendMode.SCREEN:
      return 'screen';
    case MixBlendMode.OVERLAY:
      return 'overlay';
    case MixBlendMode.DARKEN:
      return 'darken';
    case MixBlendMode.LIGHTEN:
      return 'lighten';
    case MixBlendMode.COLOR_DODGE:
      return 'color-dodge';
    case MixBlendMode.COLOR_BURN:
      return 'color-burn';
    case MixBlendMode.HARD_LIGHT:
      return 'hard-light';
    case MixBlendMode.SOFT_LIGHT:
      return 'soft-light';
    case MixBlendMode.DIFFERENCE:
      return 'difference';
    case MixBlendMode.EXCLUSION:
      return 'exclusion';
    case MixBlendMode.HUE:
      return 'hue';
    case MixBlendMode.SATURATION:
      return 'saturation';
    case MixBlendMode.COLOR:
      return 'color';
    case MixBlendMode.LUMINOSITY:
      return 'luminosity';
    default:
      return 'source-over';
  }
}
