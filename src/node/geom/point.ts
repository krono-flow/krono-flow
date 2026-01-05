import { Point } from '../../format';
import { sliceBezier } from '../../math/bezier';
import { CURVE_MODE } from '../../style/define';
import { getCurve, getStraight, isCornerPoint, XY } from './corner';

export function buildPoints(points: Point[], isClosed: boolean, width = 1, height = 1) {
  if (!points.length) {
    return [];
  }
  const coords = [];
  let hasCorner = false;
  // 先算出真实尺寸，按w/h把[0,1]坐标转换
  for (let i = 0, len = points.length; i < len; i++) {
    const item = points[i];
    item.absX = (item.x || 0) * width;
    item.absY = (item.y || 0) * height;
    item.absTx = item.tx * width;
    item.absTy = item.ty * height;
    item.absFx = item.fx * width;
    item.absFy = item.fy * height;
    if (isCornerPoint(item)) {
      hasCorner = true;
    }
  }
  // 如果有圆角，拟合画圆
  const cache: Array<{
    prevTangent: XY,
    prevHandle: XY,
    nextTangent: XY,
    nextHandle: XY,
    t1?: number,
    t2?: number,
  } | undefined> = [];
  if (hasCorner) {
    // 将圆角点拆分为2个顶点
    for (let i = 0, len = points.length; i < len; i++) {
      const point = points[i];
      if (!isCornerPoint(point)) {
        continue;
      }
      // 观察前后2个顶点的情况
      const prevIdx = i ? i - 1 : len - 1;
      const nextIdx = (i + 1) % len;
      const prevPoint = points[prevIdx];
      const nextPoint = points[nextIdx];
      let radius = point.cornerRadius;
      // 看前后2点是否也设置了圆角，相邻的圆角强制要求2点之间必须是直线，有一方是曲线的话走离散近似解
      const isPrevCorner = isCornerPoint(prevPoint);
      const isPrevStraight =
        isPrevCorner ||
        prevPoint.curveMode === CURVE_MODE.STRAIGHT ||
        !prevPoint.hasCurveFrom;
      const isNextCorner = isCornerPoint(nextPoint);
      const isNextStraight =
        isNextCorner ||
        nextPoint.curveMode === CURVE_MODE.STRAIGHT ||
        !nextPoint.hasCurveTo;
      // 先看最普通的直线，可以用角平分线+半径最小值约束求解
      if (isPrevStraight && isNextStraight) {
        cache[i] = getStraight(prevPoint, point, nextPoint, isPrevCorner, isNextCorner, radius);
      }
      // 两边只要有贝塞尔（一定是2阶），就只能用离散来逼近求圆心路径，2个圆心路径交点为所需圆心坐标
      else {
        cache[i] = getCurve(prevPoint, point, nextPoint, isPrevCorner, isNextCorner, radius);
      }
    }
  }
  // 将圆角的2个点替换掉原本的1个点
  const temp = points.map(item => Object.assign({}, item));
  for (let i = 0, len = temp.length; i < len; i++) {
    const c = cache[i];
    if (c) {
      const { prevTangent, prevHandle, nextTangent, nextHandle } = c;
      const p: Point = {
        x: 0,
        y: 0,
        cornerRadius: 0,
        curveMode: CURVE_MODE.NONE,
        hasCurveFrom: true,
        fx: 0,
        fy: 0,
        hasCurveTo: false,
        tx: 0,
        ty: 0,
        absX: prevTangent.x,
        absY: prevTangent.y,
        absFx: prevHandle.x,
        absFy: prevHandle.y,
        absTx: 0,
        absTy: 0,
        dspX: 0,
        dspY: 0,
        dspFx: 0,
        dspFy: 0,
        dspTx: 0,
        dspTy: 0,
      };
      const n: Point = {
        x: 0,
        y: 0,
        cornerRadius: 0,
        curveMode: CURVE_MODE.NONE,
        hasCurveFrom: false,
        fx: 0,
        fy: 0,
        hasCurveTo: true,
        tx: 0,
        ty: 0,
        absX: nextTangent.x,
        absY: nextTangent.y,
        absFx: 0,
        absFy: 0,
        absTx: nextHandle.x,
        absTy: nextHandle.y,
        dspX: 0,
        dspY: 0,
        dspFx: 0,
        dspFy: 0,
        dspTx: 0,
        dspTy: 0,
      };
      // 前后如果是曲线，需用t计算截取，改变控制点即可
      if (c.t1) {
        const prev = temp[(i + len - 1) % len];
        const curve = sliceBezier([
          { x: prev.absX, y: prev.absY },
          { x: prev.absFx, y: prev.absFy },
          { x: temp[i].absX, y: temp[i].absY },
        ], 0, c.t1);
        prev.absFx = curve[1].x;
        prev.absFy = curve[1].y;
      }
      if (c.t2) {
        const next = temp[(i + 1) % len];
        const curve = sliceBezier([
          { x: next.absX, y: next.absY },
          { x: next.absTx, y: next.absTy },
          { x: temp[i].absX, y: temp[i].absY },
        ], 0, 1 - c.t2);
        next.absTx = curve[1].x;
        next.absTy = curve[1].y;
      }
      // 插入新点注意索引
      temp.splice(i, 1, p, n);
      i++;
      len++;
      cache.splice(i, 0, undefined);
    }
  }
  // 换算为容易渲染的方式，[cx1?, cy1?, cx2?, cy2?, x, y]，贝塞尔控制点是前面的到当前的
  const first = temp[0];
  const p: number[] = [
    first.absX,
    first.absY,
  ];
  coords.push(p);
  const len = temp.length;
  for (let i = 1; i < len; i++) {
    const item = temp[i];
    const prev = temp[i - 1];
    const p: number[] = [
      item.absX,
      item.absY,
    ];
    if (item.hasCurveTo) {
      p.unshift(item.absTx, item.absTy);
    }
    if (prev.hasCurveFrom) {
      p.unshift(prev.absFx, prev.absFy);
    }
    coords.push(p);
  }
  // 闭合
  if (isClosed) {
    const last = temp[len - 1];
    const p: number[] = [
      first.absX,
      first.absY,
    ];
    if (first.hasCurveTo) {
      p.unshift(first.absTx, first.absTy);
    }
    if (last.hasCurveFrom) {
      p.unshift(last.absFx, last.absFy);
    }
    coords.push(p);
  }
  return coords;
}
