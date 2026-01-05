import { ComputedFilter, ComputedGradient, Gradient, Style, StyleUnit } from './define';

export function calComputedFill(fill: Style['fill']) {
  return fill.map((item) => {
    if (Array.isArray(item.v)) {
      return item.v.slice(0);
    }
    const v = item.v as Gradient;
    return {
      t: v.t,
      d: v.d.slice(0),
      stops: v.stops.map(item => {
        const offset = item.offset.v * 0.01;
        return {
          color: item.color.v.slice(0),
          offset,
        };
      }),
    } as ComputedGradient;
  });
}

export function calComputedStroke(stroke: Style['stroke']) {
  return stroke.map((item) => {
    if (Array.isArray(item.v)) {
      return item.v.slice(0);
    }
    const v = item.v as Gradient;
    return {
      t: v.t,
      d: v.d.slice(0),
      stops: v.stops.map(item => {
        const offset = item.offset ? item.offset.v * 0.01 : undefined;
        return {
          color: item.color.v.slice(0),
          offset,
        };
      }),
    } as ComputedGradient;
  });
}

export function calComputedFilter(filter: Style['filter'], w: number, h: number) {
  return filter.map(item => {
    const { v, u } = item;
    if (u === StyleUnit.GAUSS_BLUR) {
      const radius = v.radius.u === StyleUnit.PERCENT ? v.radius.v * w * 0.01 : v.radius.v;
      return { radius, u };
    }
    else if (u === StyleUnit.RADIAL_BLUR) {
      const radius = v.radius.u === StyleUnit.PERCENT ? v.radius.v * w * 0.01 : v.radius.v;
      const center = v.center.map((n, i) => {
        return n.u === StyleUnit.PERCENT ? n.v * (i ? h : w) * 0.01 : n.v;
      }) as [number, number];
      return { radius, center, u };
    }
    else if (u === StyleUnit.MOTION_BLUR) {
      const radius = v.radius.u === StyleUnit.PERCENT ? v.radius.v * w * 0.01 : v.radius.v;
      return { radius, angle: v.angle.v, offset: v.offset.v, u };
    }
    else if (u === StyleUnit.BLOOM) {
      return { threshold: v.threshold.v, knee: v.knee.v, u };
    }
    else if (u === StyleUnit.LIGHT_DARK) {
      return { radius: v.radius.v, angle: v.angle.v, u };
    }
    else if (u === StyleUnit.HUE_ROTATE) {
      return { radius: v.radius.v, u };
    }
    else if (u === StyleUnit.SATURATE) {
      return { radius: v.radius.v, u };
    }
    else if (u === StyleUnit.BRIGHTNESS) {
      return { radius: v.radius.v, u };
    }
    else if (u === StyleUnit.CONTRAST) {
      return { radius: v.radius.v, u };
    }
    else if (u === StyleUnit.SEPIA) {
      return { radius: v.radius.v, u };
    }
  }) as ComputedFilter[];
}

export default {
  calComputedFill,
  calComputedStroke,
  calComputedFilter,
};
