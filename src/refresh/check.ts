import { calRectPoints } from '../math/matrix';
import { isConvexPolygonOverlapRect, isRectsOverlap } from '../math/geom';

export function checkInScreen(
  bbox: Float32Array,
  matrix: Float32Array | undefined,
  width: number,
  height: number,
) {
  return checkInRect(bbox, matrix, 0, 0, width, height);
}

export function checkInRect(
  bbox: Float32Array,
  matrix: Float32Array | undefined,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const box = calRectPoints(bbox[0], bbox[1], bbox[2], bbox[3], matrix);
  let { x1, y1, x2, y2, x3, y3, x4, y4 } = box;
  // box是无旋转矩形可以加速，注意可能因为镜像导致坐标顺序颠倒
  if (x1 === x4 && y1 === y2 && x2 === x3 && y3 === y4) {
    if (x1 > x2) {
      [x1, x3] = [x3, x1];
    }
    if (y2 > y3) {
      [y1, y3] = [y3, y1];
    }
    return isRectsOverlap(x, y, x + width, y + height, x1, y1, x3, y3, false);
  }
  return isConvexPolygonOverlapRect(x, y, x + width, y + height, [
    { x: x1, y: y1 },
    { x: x2, y: y2 },
    { x: x3, y: y3 },
    { x: x4, y: y4 },
  ], false);
}
