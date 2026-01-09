import AbstractAnimation, { Options } from './AbstractAnimation';
import Node from '../node/Node';
import { JStyle } from '../format';
import easing from './easing';
import { isFunction, isNumber, isString } from '../util/type';
import {
  Bloom,
  GaussBlur,
  HueRotate,
  LightDark,
  MotionBlur,
  RadialBlur,
  Style,
  StyleColorValue,
  StyleFilter,
  StyleGradientValue,
  StyleNumValue,
  StyleTextShadowValue,
  StyleUnit,
} from '../style/define';
import css, { cloneStyle, cloneStyleItem } from '../style/css';

export type JOsEs = {
  offset?: number;
  easing?: string | number[] | ((v: number) => number);
};

export type JKeyFrame = Partial<JStyle> & JOsEs;

type FilterTransition = {
  radius?: number;
  angle?: number;
  offset?: number;
  center?: [number, number];
  threshold?: number;
  knee?: number;
};

export type TextShadowTransition = {
  x: number;
  y: number;
  blur: number;
  color: number[];
};

export type GradientTransition = {
  d: number[];
  stops: {
    color: number[];
    offset: number;
  }[];
};

export type OsEs = {
  time: number;
  easing?: (v: number) => number;
};

export type KeyFrame = {
  style: Partial<Style>;
  transition: {
    key: keyof Style,
    diff: number
      | number[]
      | FilterTransition[]
      | TextShadowTransition
      | (number[] | GradientTransition | undefined)[]
  }[]; // 到下帧有变化的key和差值
  fixed: (keyof Style)[]; // 固定不变化的key
} & OsEs;

export class CssAnimation extends AbstractAnimation {
  protected keyFrames: KeyFrame[];
  protected keyFramesR: KeyFrame[];
  currentKeyFrames: KeyFrame[];
  originStyle: Partial<Style>;

  constructor(node: Node, jKeyFrames: JKeyFrame[], options: Options) {
    super(node, options);
    this.keyFrames = [];
    this.keyFramesR = [];
    this.currentKeyFrames = this.keyFrames;
    this.originStyle = {};
    this.initKeyFrames(jKeyFrames);
    this.setCurrentFrames();
  }

  private initKeyFrames(jKeyFrames: JKeyFrame[]) {
    if (!jKeyFrames.length) {
      return;
    }
    const { keys, keyFrames, keyFramesR, originStyle } = parseKeyFrames(this.node, jKeyFrames, this.duration, this.easing);
    this.keyFrames = keyFrames;
    this.keyFramesR = keyFramesR;
    calTransition(this.node, this.keyFrames, keys);
    calTransition(this.node, this.keyFramesR, keys);
    this.originStyle = originStyle;
  }

  override finish() {
    if (this._playState === 'finished') {
      return;
    }
    super.finish();
    this.onFirstInEndDelay();
  }

  override cancel() {
    if (this._playState === 'idle') {
      return;
    }
    super.cancel();
    const { node } = this;
    node.updateFormatStyle(this.originStyle);
  }

  // 根据播放方向和初始轮次确定当前帧序列是正向还是反向
  private setCurrentFrames() {
    const { direction, keyFrames, keyFramesR, _playCount } = this;
    this.currentKeyFrames = getCurrentFrames<KeyFrame>(direction, _playCount, keyFrames ,keyFramesR);
  }

  override onRunning(delta: number, old?: number) {
    super.onRunning(delta, old);
    const { duration, delay, iterations, time, skipFrame } = this;
    if (skipFrame) {
      return;
    }
    const currentTime = this._currentTime;
    // 如有delay则这段时间等待状态，根据fill设置是否是初始帧样式
    if (currentTime < delay) {
      return;
    }
    const isLastCount = this._playCount >= iterations - 1;
    const currentKeyFrames = this.currentKeyFrames;
    const length = currentKeyFrames.length;
    // 只有2帧可优化（大部分情况），否则2分查找当前帧
    let i: number;
    if (length === 2) {
      i = time < duration ? 0 : 1;
    }
    else {
      i = binarySearchFrame<KeyFrame>(0, length - 1, time, currentKeyFrames);
    }
    const currentKeyFrame = currentKeyFrames[i];
    // 最后一帧结束动画，仅最后一轮才会进入
    const isLastKeyFrame = isLastCount && i === length - 1;
    let percent = isLastKeyFrame ? 0 : getPercent(currentKeyFrame.time, currentKeyFrames[i + 1].time, time, duration);
    // 最后结束特殊处理，根据endDelay/fill决定是否还原还是停留最后一帧
    if (isLastKeyFrame) {
    }
    // 两帧之间动画计算
    else {
      if (currentKeyFrame.easing) {
        percent = currentKeyFrame.easing(percent);
      }
      else if (this.easing) {
        percent = this.easing(percent);
      }
      const { transition, fixed, style } = currentKeyFrame;
      const update: Partial<Style> = {};
      // 可计算差值部分
      transition.forEach(item => {
        const { key, diff } = item;
        if (key === 'opacity'
          || key === 'translateX'
          || key === 'translateY'
          || key === 'translateZ'
          || key === 'scaleX'
          || key === 'scaleY'
          || key === 'rotateX'
          || key === 'rotateY'
          || key === 'rotateZ'
          || key === 'perspective'
          || key === 'perspectiveSelf'
          || key === 'fontSize'
          || key === 'fontWeight'
          || key === 'lineHeight'
          || key === 'letterSpacing'
          || key === 'paragraphSpacing'
        ) {
          const o = cloneStyleItem(key, style[key]!) as StyleNumValue;
          o.v += (diff as number) * percent;
          update[key] = o;
        }
        else if (key === 'color') {
          const o = cloneStyleItem(key, style[key]!) as StyleColorValue;
          for (let i = 0; i < 4; i++) {
            o.v[i] += (diff as [number, number, number, number])[i] * percent;
          }
          update[key] = o;
        }
        else if (key === 'textShadow') {
          const o = cloneStyleItem(key, style[key]!) as StyleTextShadowValue;
          o.v.x += (diff as TextShadowTransition).x * percent;
          o.v.y += (diff as TextShadowTransition).y * percent;
          o.v.blur += (diff as TextShadowTransition).blur * percent;
          for (let i = 0; i < 4; i++) {
            o.v.color[i] += ((diff as TextShadowTransition).color)[i] * percent;
          }
          update[key] = o;
        }
        else if (key === 'fill' || key === 'stroke') {
          const o = cloneStyleItem(key, style[key]!) as (StyleColorValue | StyleGradientValue)[];
          for (let i = 0; i < Math.min(o.length, (diff as (number[] | GradientTransition | undefined)[]).length); i++) {
            const item = o[i];
            const df = (diff as (number[] | GradientTransition | undefined)[])[i];
            if (df) {
              if (item.u === StyleUnit.RGBA) {
                item.v[0] += (df as number[])[0] * percent;
                item.v[1] += (df as number[])[0] * percent;
                item.v[2] += (df as number[])[0] * percent;
                item.v[3] += (df as number[])[0] * percent;
              }
              else if (item.u === StyleUnit.GRADIENT) {
                for (let j = 0; j < (df as GradientTransition).d.length; j++) {
                  item.v.d[j] += (df as GradientTransition).d[j] * percent;
                }
                for (let j = 0; j < (df as GradientTransition).stops.length; j++) {
                  item.v.stops[j].color.v[0] += (df as GradientTransition).stops[j].color[0] * percent;
                  item.v.stops[j].color.v[1] += (df as GradientTransition).stops[j].color[1] * percent;
                  item.v.stops[j].color.v[2] += (df as GradientTransition).stops[j].color[2] * percent;
                  item.v.stops[j].color.v[3] += (df as GradientTransition).stops[j].color[3] * percent;
                  item.v.stops[j].offset.v += (df as GradientTransition).stops[j].offset * percent;
                }
              }
            }
          }
          update[key] = o;
        }
        else if (key === 'strokeWidth') {
          const o = cloneStyleItem(key, style[key]!) as StyleNumValue[];
          o.forEach((item, i) => {
            item.v += (diff as number[])[i] * percent;
          });
          update[key] = o;
        }
        else if (key === 'transformOrigin' || key === 'perspectiveOrigin') {
          const o = cloneStyleItem(key, style[key]!) as [StyleNumValue, StyleNumValue];
          o[0].v += (diff as [number, number])[0] * percent;
          o[1].v += (diff as [number, number])[1] * percent;
          update[key] = o;
        }
        else if (key === 'filter') {
          const o = cloneStyleItem(key, style[key]!) as StyleFilter[];
          o.forEach((item, i) => {
            const d = (diff as FilterTransition[])[i];
            // 可能数量对不上，只对得上的部分做动画
            if (!d) {
              return;
            }
            if (item.u === StyleUnit.GAUSS_BLUR) {
              item.v.radius.v += d.radius! * percent;
            }
            if (item.u === StyleUnit.RADIAL_BLUR) {
              item.v.radius.v += d.radius! * percent;
              item.v.center[0].v += d.center![0] * percent;
              item.v.center[1].v += d.center![1] * percent;
            }
            else if (item.u === StyleUnit.MOTION_BLUR) {
              item.v.radius.v += d.radius! * percent;
              item.v.angle.v += d.angle! * percent;
              item.v.offset.v += d.offset! * percent;
            }
            else if (item.u === StyleUnit.BLOOM) {
              item.v.threshold.v += d.threshold! * percent;
              item.v.knee.v += d.knee! * percent;
            }
            else if (item.u === StyleUnit.LIGHT_DARK) {
              item.v.radius.v += d.radius! * percent;
              item.v.angle.v += d.angle! * percent;
            }
            else if (item.u === StyleUnit.HUE_ROTATE
              || item.u === StyleUnit.SATURATE
              || item.u === StyleUnit.BRIGHTNESS
              || item.u === StyleUnit.CONTRAST
              || item.u === StyleUnit.SEPIA
            ) {
              item.v.radius.v += d.radius! * percent;
            }
          });
          update[key] = o;
        }
      });
      // 固定部分
      fixed.forEach(key => {
        // @ts-ignore
        update[key] = cloneStyleItem(key, style[key]!);
      });
      this.node.updateFormatStyle(update);
    }
  }

  onFirstInDelay() {
    const { fill, node } = this;
    if (fill === 'backwards' || fill === 'both') {
      node.updateFormatStyle(this.currentKeyFrames[0].style);
    }
    else {
      node.updateFormatStyle(this.originStyle);
    }
  }

  onFirstInEndDelay() {
    const { fill, node } = this;
    if (fill === 'forwards' || fill === 'both') {
      const currentKeyFrames = this.currentKeyFrames;
      node.updateFormatStyle(currentKeyFrames[currentKeyFrames.length - 1].style);
    }
    else {
      node.updateFormatStyle(this.originStyle);
    }
  }

  onChangePlayCount() {
    this.setCurrentFrames();
  }
}

// 将关键帧序列标准化样式结构
function parseKeyFrames(node: Node, jKeyFrames: JKeyFrame[], duration: number, ea?: (v: number) => number) {
  const list = normalizeKeyFramesOsEs(jKeyFrames) as JKeyFrame[];
  // 标准化关键帧的样式，并统计有哪些样式出现
  const keyFrames: KeyFrame[] = [];
  const hash: Record<string, boolean> = {};
  const keys: (keyof Style)[] = [];
  for(let i = 0, len = list.length; i < len; i++) {
    const item = list[i];
    const style = css.normalize(item);
    Object.keys(style).forEach(k => {
      if (!hash.hasOwnProperty(k)) {
        hash[k] = true;
        keys.push(k as keyof Style);
      }
    });
    const o = {
      style,
      time: item.offset! * duration,
      easing: ea,
      transition: [],
      fixed: [],
    };
    if (item.easing) {
      o.easing = normalizeEasing(item.easing);
    }
    keyFrames.push(o);
  }
  // 添补没有声明完全的关键帧属性为节点当前值
  keyFrames.forEach(item => {
    const style = item.style;
    keys.forEach(k => {
      if (!style.hasOwnProperty(k)) {
        Object.assign(style, cloneStyle(node.style, [k]));
      }
    });
  });
  // 反向播放的
  const keyFramesR = keyFrames.map(item => {
    return Object.assign({}, item, {
      transition: [],
      fixed: [],
    });
  }).reverse();
  keyFramesR.forEach(item => {
    item.time = duration - item.time;
  });
  // 记录原始样式，动画结束可能需要还原
  const originStyle: Partial<Style> = cloneStyle(node.style, keys);
  return {
    keys,
    keyFrames,
    keyFramesR,
    originStyle,
  };
}

export function normalizeKeyFramesOsEs(jKeyFrames: JOsEs[]) {
  if (!jKeyFrames.length) {
    return [];
  }
  const list: JOsEs[] = [];
  // 过滤时间非法的，过滤后续offset<=前面的
  let prevOffset = 0;
  for (let i = 0, len = jKeyFrames.length; i < len; i++) {
    const item = jKeyFrames[i];
    if (isNumber(item.offset)) {
      const offset = item.offset!;
      if (offset < 0 || offset > 1) {
        continue;
      }
      if (offset <= prevOffset && i) {
        continue;
      }
      prevOffset = offset;
    }
    list.push(Object.assign({}, item));
  }
  // 只有1帧复制出来变成2帧方便运行
  if (list.length === 1) {
    list.push(Object.assign({}, list[0]));
    const clone = Object.assign({}, list[0]);
    if (list[0].offset === 1) {
      clone.offset = 0;
      list.unshift(clone);
    }
    else {
      clone.offset = 1;
      list.push(clone);
    }
  }
  // 首尾时间偏移强制为[0, 1]，不是的话前后加空帧
  const first = list[0];
  if (first.offset && first.offset > 0) {
    list.unshift({
      offset: 0,
    });
  }
  else {
    first.offset = 0;
  }
  const last = list[list.length - 1];
  if (last.offset && last.offset < 1) {
    list.push({
      offset: 1,
    });
  }
  else {
    last.offset = 1;
  }
  // 计算没有设置offset的帧
  for(let i = 1, len = list.length; i < len; i++) {
    const item = list[i];
    // 从i=1开始offset一定>0，找到下一个有offset的，最后一个一定是1，均分中间无声明的
    if (!isNumber(item.offset)) {
      let end: JKeyFrame;
      let j = i + 1;
      for(; j < len; j++) {
        end = list[j];
        if (end.offset) {
          break;
        }
      }
      const num = j - i + 1;
      const prev = list[i - 1];
      const per = (end!.offset! - prev.offset!) / num;
      for (let k = i; k < j; k++) {
        list[k].offset = prev.offset! + per * (k + 1 - i);
      }
      i = j;
    }
  }
  return list;
}

export function normalizeEasing(ea: string | number[] | ((v: number) => number)) {
  if (isFunction(ea)) {
    return ea as (v :number) => number;
  }
  else if (Array.isArray(ea)) {
    return easing.getEasing(ea as number[]);
  }
  else if (isString(ea)) {
    return easing[ea as 'linear' | 'easeIn' | 'easeOut' | 'easeInOut'];
  }
}

export function getCurrentFrames<KF>(direction: string, playCount: number, keyFrames: KF[], keyFramesR: KF[]) {
  if (direction === 'backwards') {
    return keyFramesR;
  }
  else if (direction === 'alternate') {
    if (playCount % 2 === 0) {
      return keyFrames;
    }
    else {
      return keyFramesR;
    }
  }
  else if (direction === 'alternateReverse') {
    if (playCount % 2 === 0) {
      return keyFramesR;
    }
    else {
      return keyFrames;
    }
  }
  else {
    return keyFrames;
  }
}

function calTransition(node: Node, keyFrames: KeyFrame[], keys: (keyof Style)[]) {
  for (let i = 1, len = keyFrames.length; i < len; i++) {
    const prev = keyFrames[i - 1];
    const next = keyFrames[i];
    const prevStyle = prev.style;
    const nextStyle = next.style;
    keys.forEach(key => {
      const p = prevStyle[key];
      const n = nextStyle[key];
      // 无单位变化数值
      if (key === 'opacity'
        || key === 'scaleX'
        || key === 'scaleY'
        || key === 'rotateX'
        || key === 'rotateY'
        || key === 'rotateZ'
        || key === 'fontSize'
        || key === 'fontWeight'
        || key === 'lineHeight'
        || key === 'letterSpacing'
        || key === 'paragraphSpacing'
      ) {
        prev.transition.push({
          key,
          diff: (n as StyleNumValue).v - (p as StyleNumValue).v,
        });
      }
      // 数值单位考虑不同单位换算
      else if (key === 'translateX'
        || key === 'translateY'
        || key === 'translateZ'
        || key === 'perspective'
        || key === 'perspectiveSelf'
      ) {
        if ((p as StyleNumValue).u === (n as StyleNumValue).u) {
          prev.transition.push({
            key,
            diff: (n as StyleNumValue).v - (p as StyleNumValue).v,
          });
        }
        else {
          let unit = 0;
          if (key === 'translateX' || key === 'translateZ' || key === 'perspective' || key === 'perspectiveSelf') {
            unit = node.computedStyle.width;
          }
          else if (key === 'translateY') {
            unit = node.computedStyle.height;
          }
          prev.transition.push({
            key,
            diff: calLengthByUnit((p as StyleNumValue), (n as StyleNumValue), unit),
          });
        }
      }
      else if (key === 'color') {
        const diff: [number, number, number, number] = [0, 0, 0, 0];
        for (let i = 0; i < 4; i++) {
          diff[i] = (n as StyleColorValue).v[i] - (p as StyleColorValue).v[i];
        }
        prev.transition.push({
          key,
          diff,
        });
      }
      else if (key === 'textShadow') {
        const pv = (p as StyleTextShadowValue).v;
        const nv = (n as StyleTextShadowValue).v;
        prev.transition.push({
          key,
          diff: {
            x: nv.x - pv.x,
            y: nv.y - pv.y,
            blur: nv.blur - pv.blur,
            color: [
              nv.color[0] - pv.color[0],
              nv.color[1] - pv.color[1],
              nv.color[2] - pv.color[2],
              nv.color[3] - pv.color[3],
            ],
          },
        });
      }
      else if (key === 'stroke' || key === 'fill') {
        const pv = p as (StyleColorValue | StyleGradientValue)[];
        const nv = n as (StyleColorValue | StyleGradientValue)[];
        const diff: (number[] | GradientTransition | undefined)[] = [];
        for (let i = 0; i < Math.min(pv.length, nv.length); i++) {
          const pi = pv[i];
          const ni = nv[i];
          if (pi.u === StyleUnit.RGBA && ni.u === StyleUnit.RGBA) {
            diff.push([
              ni.v[0] - pi.v[0],
              ni.v[1] - pi.v[1],
              ni.v[2] - pi.v[2],
              ni.v[3] - pi.v[3],
            ]);
          }
          else if (pi.u === StyleUnit.GRADIENT && ni.u === StyleUnit.GRADIENT) {
            if (pi.v.t === ni.v.t) {
              const d: number[] = [];
              for (let j = 0; j < Math.min(ni.v.d.length, pi.v.d.length); j++) {
                d.push(ni.v.d[j] - pi.v.d[j]);
              }
              const stops: { color: number[], offset: number }[] = [];
              for (let j = 0; j < Math.min(ni.v.stops.length, pi.v.stops.length); j++) {
                const p = ni.v.stops[j];
                const n = pi.v.stops[j];
                stops.push({
                  color: [
                    n.color.v[0] - p.color.v[0],
                    n.color.v[1] - p.color.v[1],
                    n.color.v[2] - p.color.v[2],
                    n.color.v[3] - p.color.v[3],
                  ],
                  offset: n.offset.v - p.offset.v,
                });
              }
              diff.push({
                d,
                stops,
              });
            }
            else {
              diff.push(undefined);
            }
          }
          else {
            diff.push(undefined);
          }
        }
        prev.transition.push({
          key,
          diff,
        });
      }
      else if (key === 'strokeWidth') {
        const pv = p as StyleNumValue[];
        const nv = n as StyleNumValue[];
        const diff: number[] = [];
        for (let i = 0; i < Math.min(pv.length, nv.length); i++) {
          diff.push(nv[i].v - pv[i].v);
        }
        prev.transition.push({
          key,
          diff,
        });
      }
      else if (key === 'transformOrigin' || key === 'perspectiveOrigin') {
        const pv = p as [StyleNumValue, StyleNumValue];
        const nv = n as [StyleNumValue, StyleNumValue];
        const diff: [number, number] = [0, 0];
        for (let i = 0; i < 2; i++) {
          if (pv[i].u === nv[i].u) {
            diff.push(nv[i].v - pv[i].v);
          }
          else {
            let unit = i ? node.computedStyle.height : node.computedStyle.width;
            prev.transition.push({
              key,
              diff: calLengthByUnit(nv[i], pv[i], unit),
            });
          }
        }
        prev.transition.push({
          key,
          diff,
        });
      }
      else if (key === 'filter') {
        const ps = (p as StyleFilter[]);
        const ns = (n as StyleFilter[]);
        let equal = true;
        for (let i = 0, len = Math.min(ps.length, ns.length); i < len; i++) {
          if (ps[i].u !== ns[i].u) {
            equal = false;
            break;
          }
        }
        if (equal) {
          const diff: FilterTransition[] = [];
          for (let i = 0, len = Math.min(ps.length, ns.length); i < len; i++) {
            const item = ps[i];
            const item2 = ns[i];
            const o = {} as FilterTransition;
            if (item.u === StyleUnit.GAUSS_BLUR) {
              o.radius = (item2 as GaussBlur).v.radius.v - item.v.radius.v;
            }
            else if (item.u === StyleUnit.RADIAL_BLUR) {
              o.radius = (item2 as RadialBlur).v.radius.v - item.v.radius.v;
              o.center = [
                calLengthByUnit((item2 as RadialBlur).v.center[0], item.v.center[0], node.computedStyle.width),
                calLengthByUnit((item2 as RadialBlur).v.center[1], item.v.center[1], node.computedStyle.height),
              ];
            }
            else if (item.u === StyleUnit.MOTION_BLUR) {
              o.radius = (item2 as MotionBlur).v.radius.v - item.v.radius.v;
              o.angle = (item2 as MotionBlur).v.angle.v - (item as MotionBlur).v.angle.v;
              o.offset = (item2 as MotionBlur).v.offset.v - (item as MotionBlur).v.offset.v;
            }
            else if (item.u === StyleUnit.BLOOM) {
              o.threshold = (item2 as Bloom).v.threshold.v - (item as Bloom).v.threshold.v;
              o.knee = (item2 as Bloom).v.knee.v - (item as Bloom).v.knee.v;
            }
            else if (item.u === StyleUnit.LIGHT_DARK) {
              o.radius = (item2 as LightDark).v.radius.v - (item as LightDark).v.radius.v;
              o.angle = (item2 as LightDark).v.angle.v - (item as LightDark).v.angle.v;
            }
            else if (item.u === StyleUnit.HUE_ROTATE
              || item.u === StyleUnit.SATURATE
              || item.u === StyleUnit.BRIGHTNESS
              || item.u === StyleUnit.CONTRAST
              || item.u === StyleUnit.SEPIA
            ) {
              o.radius = (item2 as HueRotate).v.radius.v - (item as HueRotate).v.radius.v;
            }
            diff.push(o);
          }
          prev.transition.push({
            key,
            diff,
          });
        }
      }
      else {
        next.fixed.push(key);
        // fixed很特殊首帧渲染需要
        if (i === 1) {
          prev.fixed.push(key);
        }
      }
    });
  }
}

function calLengthByUnit(p: StyleNumValue, n: StyleNumValue, unit: number) {
  if (p.u === StyleUnit.PX) {
    if (n.u === StyleUnit.PERCENT) {
      return n.v * 0.01 * unit - p.v;
    }
  }
  else if (p.u === StyleUnit.PERCENT) {
    if (n.u === StyleUnit.PX) {
      return n.v * 100 / unit - p.v;
    }
  }
  return 0;
}

export function binarySearchFrame<KF extends  { time: number }>(i: number, j: number, currentTime: number, keyFrames: KF[]) {
  while (i < j) {
    if (i === j - 1) {
      if (keyFrames[j].time <= currentTime) {
        return j;
      }
      return i;
    }
    const mid = i + ((j - i) >> 1);
    const time = keyFrames[mid].time;
    if (time === currentTime) {
      return mid;
    }
    if (time > currentTime) {
      j = Math.max(mid - 1, i);
    }
    else {
      i = Math.min(mid, j);
    }
  }
  return i;
}

export function getPercent(time0: number, time1: number, time: number, duration: number) {
  // 当前帧和下一帧之间的进度百分比
  let percent = 0;
  // 根据目前到下一帧的时间差，计算百分比，再反馈到变化数值上
  if (length === 2) {
    percent = time / duration;
  }
  else {
    const total = time1 - time0;
    percent = (time - time0) / total;
  }
  return percent;
}

export default CssAnimation;
