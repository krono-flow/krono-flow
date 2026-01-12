import AbstractAnimation, { Options } from './AbstractAnimation';
import {
  binarySearchFrame,
  getCurrentFrames,
  getPercent,
  GradientTransition,
  normalizeEasing,
  normalizeKeyFramesOsEs,
  TextShadowTransition,
} from './CssAnimation';
import Text from '../node/Text';
import { JRich, RichIndex } from '../format';
import {
  ModifyRichStyle,
  Rich,
  StyleColorValue,
  StyleGradientValue,
  StyleNumValue,
  StyleTextShadowValue,
  StyleUnit,
} from '../style/define';
import { cloneStyle, cloneStyleItem, normalizeRich } from '../style/css';

export type JKeyFrameRich = {
  rich: JRich[],
  offset?: number;
  easing?: string | number[] | ((v: number) => number);
};

export type KeyFrameRich = {
  rich: (Partial<Rich> & RichIndex)[];
  time: number;
  easing?: (v: number) => number;
  transition: {
    key: keyof Rich,
    diff: number
      | number[]
      | TextShadowTransition
      | (number[] | GradientTransition | undefined)[]
  }[][];
  fixed: (keyof Rich)[][];
};

export class RichAnimation extends AbstractAnimation {
  node: Text;
  protected keyFrames: KeyFrameRich[];
  protected keyFramesR: KeyFrameRich[];
  currentKeyFrames: KeyFrameRich[];
  originRich: Rich[];

  constructor(node: Text, jKeyFrames: JKeyFrameRich[], options: Options) {
    super(node, options);
    this.node = node;
    this.keyFrames = [];
    this.keyFramesR = [];
    this.currentKeyFrames = this.keyFrames;
    this.originRich = [];
    this.initKeyFramesRich(jKeyFrames);
    this.setCurrentFrames();
  }

  private initKeyFramesRich(jKeyFrames: JKeyFrameRich[]) {
    if (!jKeyFrames.length) {
      return;
    }
    const { keys, keyFrames, keyFramesR, originRich, length } = parseKeyFrames(this.node, jKeyFrames, this.duration, this.easing);
    this.keyFrames = keyFrames;
    this.keyFramesR = keyFramesR;
    calTransition(this.node, this.keyFrames, keys, length);
    calTransition(this.node, this.keyFramesR, keys, length);
    this.originRich = originRich;
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
    const { node, originRich } = this;
    originRich.forEach(item => {
      node.updateFormatRangeStyle(item.location, item.length, item);
    });
  }

  private setCurrentFrames() {
    const { direction, keyFrames, keyFramesR, _playCount } = this;
    this.currentKeyFrames = getCurrentFrames<KeyFrameRich>(direction, _playCount, keyFrames ,keyFramesR);
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
      i = binarySearchFrame<KeyFrameRich>(0, length - 1, time, currentKeyFrames);
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
      const { transition, fixed, rich } = currentKeyFrame;
      // 可计算差值部分
      transition.forEach((list, i) => {
        const update: ModifyRichStyle = {};
        const ri: RichIndex = { location: 0, length: 0 };
        list.forEach(item => {
          const { key, diff } = item;
          if (key === 'opacity'
            || key === 'fontSize'
            || key === 'fontWeight'
            || key === 'lineHeight'
            || key === 'letterSpacing'
            || key === 'paragraphSpacing'
          ) {
            const o = cloneStyleItem(key, rich[i][key]!) as StyleNumValue;
            o.v += (diff as number) * percent;
            update[key] = o;
          }
          else if (key === 'color') {
            const o = cloneStyleItem(key, rich[i][key]!) as StyleColorValue;
            for (let i = 0; i < 4; i++) {
              o.v[i] += (diff as [number, number, number, number])[i] * percent;
            }
            update[key] = o;
          }
          else if (key === 'textShadow') {
            const o = cloneStyleItem(key, rich[i][key]!) as StyleTextShadowValue;
            o.v.x += (diff as TextShadowTransition).x * percent;
            o.v.y += (diff as TextShadowTransition).y * percent;
            o.v.blur += (diff as TextShadowTransition).blur * percent;
            for (let i = 0; i < 4; i++) {
              o.v.color[i] += ((diff as TextShadowTransition).color)[i] * percent;
            }
            update[key] = o;
          }
          else if (key === 'stroke') {
            const o = cloneStyleItem(key, rich[i][key]!) as (StyleColorValue | StyleGradientValue)[];
            for (let i = 0; i < Math.min(o.length, (diff as (number[] | GradientTransition | undefined)[]).length); i++) {
              const item = o[i];
              const df = (diff as (number[] | GradientTransition | undefined)[])[i];
              if (df) {
                if (item.u === StyleUnit.RGBA) {
                  item.v[0] += (df as number[])[0] * percent;
                  item.v[1] += (df as number[])[1] * percent;
                  item.v[2] += (df as number[])[2] * percent;
                  item.v[3] += (df as number[])[3] * percent;
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
            const o = cloneStyleItem(key, rich[i][key]!) as StyleNumValue[];
            o.forEach((item, i) => {
              item.v += (diff as number[])[i] * percent;
            });
            update[key] = o;
          }
          else if (key === 'location' || key === 'length') {
            ri[key] = Math.floor(rich[i][key] + (diff as number) * percent);
          }
        });
        // 固定部分
        fixed[i].forEach(key => {
          // @ts-ignore
          update[key] = Object.assign({}, rich[i][key]);
        });
        this.node.updateFormatRangeStyle(ri.location, ri.length, update);
      });
    }
  }

  onFirstInDelay() {
    const { fill, node, originRich } = this;
    if (fill === 'backwards' || fill === 'both') {
      this.currentKeyFrames[0].rich.forEach(item => {
        node.updateFormatRangeStyle(item.location, item.length, item);
      });
    }
    else {
      originRich.forEach(item => {
        node.updateFormatRangeStyle(item.location, item.length, item);
      });
    }
  }

  onFirstInEndDelay() {
    const { fill, node, originRich } = this;
    if (fill === 'forwards' || fill === 'both') {
      const currentKeyFrames = this.currentKeyFrames;
      const last = currentKeyFrames[currentKeyFrames.length - 1];
      last.rich.forEach(item => {
        node.updateFormatRangeStyle(item.location, item.length, item);
      });
    }
    else {
      originRich.forEach(item => {
        node.updateFormatRangeStyle(item.location, item.length, item);
      });
    }
  }

  onChangePlayCount() {
    this.setCurrentFrames();
  }
}

function parseKeyFrames(node: Text, jKeyFrames: JKeyFrameRich[], duration: number, ea?: (v: number) => number) {
  const list = normalizeKeyFramesOsEs(jKeyFrames) as JKeyFrameRich[];
  // rich本身还是个数组，每帧需要同索引rich对比，先求出最小rich的长度，超出的视作固定帧不变
  let length = 0;
  for(let i = 0, len = list.length; i < len; i++) {
    const item = list[i];
    if (i) {
      length = Math.min(item.rich.length);
    }
    else {
      length = item.rich.length;
    }
  }
  // 标准化，每个索引的keys都不一样
  const keyFrames: KeyFrameRich[] = [];
  const hash: Record<string, boolean>[] = [];
  const keys: (keyof Rich)[][] = [];
  for (let i = 0; i < length; i++) {
    hash[i] = {};
    keys[i] = [];
  }
  for(let i = 0, len = list.length; i < len; i++) {
    const item = list[i];
    const o: KeyFrameRich = {
      rich: [],
      time: item.offset! * duration,
      easing: ea,
      transition: [],
      fixed: [],
    };
    if (item.easing) {
      o.easing = normalizeEasing(item.easing);
    }
    keyFrames.push(o);
    for (let j = 0, len2 = item.rich.length; j < len2; j++) {
      const r = item.rich[j];
      const res = normalizeRich(r, node.style, false);
      o.rich[j] = res;
      if (j < length) {
        Object.keys(res).forEach(k => {
          if (k !== 'location' && k !== 'length' && !hash[j].hasOwnProperty(k)) {
            hash[j][k] = true;
            keys[j].push(k as keyof Rich);
          }
        });
      }
    }
  }
  // 补全
  keyFrames.forEach(item => {
    item.rich.forEach((r, i) => {
      if (i < length) {
        keys[i].forEach(k => {
          if (!r.hasOwnProperty(k)) {
            // 一定是style的key，不可能是location和length，它们不能缺
            Object.assign(r, cloneStyle(node.style, [k]));
          }
        });
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
  // 记录原始rich，动画结束可能需要还原
  const originRich: Rich[] = node.rich.map((item, i) => {
    return Object.assign({}, cloneStyle(item, keys[i]), {
      location: item.location,
      length: item.length,
    }) as Rich;
  });
  return {
    keys,
    keyFrames,
    keyFramesR,
    originRich,
    length,
  };
}

function calTransition(node: Text, keyFrames: KeyFrameRich[], keys: (keyof Rich)[][], length: number) {
  for (let i = 1, len = keyFrames.length; i < len; i++) {
    const prev = keyFrames[i - 1];
    const next = keyFrames[i];
    for (let j = 0; j < length; j++) {
      const pr = prev.rich[j];
      const nr = next.rich[j];
      prev.transition[j] = prev.transition[j] || [];
      prev.fixed[j] = prev.fixed[j] || [];
      next.transition[j] = next.transition[j] || [];
      next.fixed[j] = next.fixed[j] || [];
      keys[j].forEach(key => {
        const p = pr[key];
        const n = nr[key];
        if (key === 'fontSize'
          || key === 'fontWeight'
          || key === 'lineHeight'
          || key === 'letterSpacing'
          || key === 'paragraphSpacing'
          || key === 'opacity'
        ) {
          prev.transition[j].push({
            key,
            diff: (n as StyleNumValue).v - (p as StyleNumValue).v,
          });
        }
        else if (key === 'color') {
          const diff: [number, number, number, number] = [0, 0, 0, 0];
          for (let i = 0; i < 4; i++) {
            diff[i] = (n as StyleColorValue).v[i] - (p as StyleColorValue).v[i];
          }
          prev.transition[j].push({
            key,
            diff,
          });
        }
        else if (key === 'textShadow') {
          const pv = (p as StyleTextShadowValue).v;
          const nv = (n as StyleTextShadowValue).v;
          prev.transition[j].push({
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
        else if (key === 'stroke') {
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
          prev.transition[j].push({
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
          prev.transition[j].push({
            key,
            diff,
          });
        }
        else if (key === 'fontStyle'
          || key === 'textAlign'
          || key === 'visibility') {
          next.fixed[j].push(key);
          if (i === 1) {
            prev.fixed[j].push(key);
          }
        }
      });
      prev.transition[j].push({
        key: 'location',
        diff: nr.location - pr.location,
      });
      prev.transition[j].push({
        key: 'length',
        diff: nr.length - pr.length,
      });
    }
  }
}

export default RichAnimation;
