import { d2r } from '../math/geom';
import {
  identity,
  isE,
  multiplyRotateX,
  multiplyRotateY,
  multiplyRotateZ,
  multiplyScaleX,
  multiplyScaleY,
  multiplySkewX,
  multiplySkewY,
  multiplyTfo,
  tfoMultiply,
} from '../math/matrix';
import { ComputedStyle } from './define';

export function calRotateX(t: Float32Array, v: number) {
  return calRotateXRadian(t, d2r(v));
}

export function calRotateXRadian(t: Float32Array, v: number) {
  const sin = Math.sin(v);
  const cos = Math.cos(v);
  t[5] = t[10] = cos;
  t[6] = sin;
  t[9] = -sin;
  return t;
}

export function calRotateY(t: Float32Array, v: number) {
  return calRotateYRadian(t, d2r(v));
}

export function calRotateYRadian(t: Float32Array, v: number) {
  const sin = Math.sin(v);
  const cos = Math.cos(v);
  t[0] = t[10] = cos;
  t[8] = sin;
  t[2] = -sin;
  return t;
}

export function calRotateZ(t: Float32Array, v: number) {
  return calRotateZRadian(t, d2r(v));
}

export function calRotateZRadian(t: Float32Array, v: number) {
  const sin = Math.sin(v);
  const cos = Math.cos(v);
  t[0] = t[5] = cos;
  t[1] = sin;
  t[4] = -sin;
  return t;
}

// 已有计算好的变换矩阵，根据tfo原点计算最终的matrix
export function calMatrixByOrigin(m: Float32Array, ox: number, oy: number) {
  let res = m.slice(0) as Float32Array;
  if (ox === 0 && oy === 0 || isE(m)) {
    return res;
  }
  res = tfoMultiply(ox, oy, res);
  res = multiplyTfo(res, -ox, -oy);
  return res;
}

export function calTransformByMatrixAndOrigin(matrix: Float32Array, x: number, y: number) {
  let res = matrix.slice(0) as Float32Array;
  res = multiplyTfo(res, x, y);
  res = tfoMultiply(-x, -y, res);
  return res;
}

export function calPerspectiveMatrix(perspective: number, ox: number, oy: number) {
  let res = identity() as Float32Array;
  // 最小值限制1
  if (perspective >= 1) {
    res[11] = -1 / perspective;
    if (ox || oy) {
      res = tfoMultiply(ox, oy, res);
      res = multiplyTfo(res, -ox, -oy);
    }
  }
  return res;
}

export function calTransform(computedStyle: Partial<Pick<ComputedStyle, 'translateX'
  | 'translateY'
  | 'translateZ'
  | 'rotateX'
  | 'rotateY'
  | 'rotateZ'
  | 'skewX'
  | 'skewY'
  | 'scaleX'
  | 'scaleY'
>>, transform?: Float32Array) {
  if (!transform) {
    transform = identity();
  }
  const { translateX, translateY, translateZ, rotateX, rotateY, rotateZ, scaleX, scaleY, skewX, skewY } = computedStyle;
  transform[12] = translateX || 0;
  transform[13] = translateY || 0;
  transform[14] = translateZ || 0;
  if (rotateX) {
    if(isE(transform)) {
      calRotateX(transform, rotateX);
    }
    else {
      multiplyRotateX(transform, d2r(rotateX));
    }
  }
  if (rotateY) {
    if(isE(transform)) {
      calRotateY(transform, rotateY);
    }
    else {
      multiplyRotateY(transform, d2r(rotateY));
    }
  }
  if (rotateZ) {
    if(isE(transform)) {
      calRotateZ(transform, rotateZ);
    }
    else {
      multiplyRotateZ(transform, d2r(rotateZ));
    }
  }
  if (skewX) {
    if(isE(transform)) {
      transform[4] = Math.tan(d2r(skewX));
    }
    else {
      multiplySkewX(transform, d2r(skewX));
    }
  }
  if (skewY) {
    if(isE(transform)) {
      transform[1] = Math.tan(d2r(skewY));
    }
    else {
      multiplySkewY(transform, d2r(skewY));
    }
  }
  if (scaleX !== undefined && scaleX !== 1) {
    if (isE(transform)) {
      transform[0] = scaleX;
    }
    else {
      multiplyScaleX(transform, scaleX);
    }
  }
  if (scaleY !== undefined && scaleY !== 1) {
    if (isE(transform)) {
      transform[5] = scaleY;
    }
    else {
      multiplyScaleY(transform, scaleY);
    }
  }
  return transform;
}

export default {
  calRotateX,
  calRotateXRadian,
  calRotateZ,
  calRotateZRadian,
  calMatrixByOrigin,
  calTransform,
  calTransformByMatrixAndOrigin,
  calPerspectiveMatrix,
};
