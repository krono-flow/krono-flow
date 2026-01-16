import { calRectPoints } from '../math/matrix';
import inject from '../util/inject';
import CacheProgram from './CacheProgram';

export function initShaders(
  gl: WebGL2RenderingContext | WebGLRenderingContext,
  vshader: string,
  fshader: string,
) {
  let program = createProgram(gl, vshader, fshader);
  if (!program) {
    throw new Error('Failed to create program');
  }

  // 要开启透明度，用以绘制透明的图形
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  return program;
}

function createProgram(
  gl: WebGL2RenderingContext | WebGLRenderingContext,
  vshader: string,
  fshader: string,
) {
  // Create shader object
  let vertexShader = loadShader(gl, gl.VERTEX_SHADER, vshader);
  let fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fshader);
  if (!vertexShader || !fragmentShader) {
    return null;
  }

  // Create a program object
  let program = gl.createProgram();
  if (!program) {
    return null;
  }
  // @ts-ignore
  program.vertexShader = vertexShader;
  // @ts-ignore
  program.fragmentShader = fragmentShader;

  // Attach the shader objects
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);

  // Link the program object
  gl.linkProgram(program);

  // Check the result of linking
  let linked = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (!linked) {
    let error = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    gl.deleteShader(fragmentShader);
    gl.deleteShader(vertexShader);
    throw new Error('Failed to link program: ' + error);
  }
  return program;
}

export function loadShader(
  gl: WebGL2RenderingContext | WebGLRenderingContext,
  type: number,
  source: string,
) {
  // Create shader object
  let shader = gl.createShader(type);
  if (shader === null) {
    throw new Error('unable to create shader');
  }

  // Set the shader program
  gl.shaderSource(shader, source);

  // Compile the shader
  gl.compileShader(shader);

  // Check the result of compilation
  let compiled = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (!compiled) {
    let error = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error('Failed to compile shader: ' + error);
  }

  return shader;
}

export function createTexture(
  gl: WebGL2RenderingContext | WebGLRenderingContext,
  n?: number,
  tex?: TexImageSource,
  width?: number,
  height?: number,
): WebGLTexture {
  const texture = gl.createTexture()!;
  if (n !== undefined) {
    bindTexture(gl, texture, n);
  }
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  // 传入需要绑定的纹理
  if (tex) {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tex);
  }
  // 或者尺寸来绑定fbo
  else if (width && height) {
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );
  }
  else {
    throw new Error('Missing texImageSource or w/h');
  }
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  // 只有bitmap可能出现放大的情况
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return texture;
}

export function bindTexture(
  gl: WebGL2RenderingContext | WebGLRenderingContext,
  texture: WebGLTexture,
  n: number,
) {
  // @ts-ignore
  gl.activeTexture(gl['TEXTURE' + n]);
  gl.bindTexture(gl.TEXTURE_2D, texture);
}

export type DrawData = {
  opacity: number;
  matrix?: Float32Array;
  bbox: Float32Array;
  tc?: { x1: number, y1: number, x3: number, y3: number };
  t: WebGLTexture;
  dx?: number; // bbox计算前偏移，避免创建新bbox垃圾回收，一般是局部汇总时左上原点不是0,0使用
  dy?: number;
};

// 缓存，避免每次创建，相同长度复用
let lastVtPoint: Float32Array;
let lastVtTex: Float32Array;

export function drawTextureCache(
  gl: WebGL2RenderingContext | WebGLRenderingContext,
  cx: number,
  cy: number,
  cacheProgram: CacheProgram,
  drawData: DrawData,
) {
  // 是否使用缓存TypeArray，避免垃圾回收
  let vtPoint: Float32Array, vtTex: Float32Array;
  if (lastVtPoint) {
    vtPoint = lastVtPoint;
  }
  else {
    vtPoint = lastVtPoint = new Float32Array(12);
  }
  if (lastVtTex) {
    vtTex = lastVtTex;
  }
  else {
    vtTex = lastVtTex = new Float32Array(8);
  }
  const {
    matrix,
    bbox,
    tc,
    t,
    dx = 0,
    dy = 0,
  } = drawData;
  bindTexture(gl, t, 0);
  const { t1, t2, t3, t4 } = bbox2Coords(bbox, cx, cy, dx, dy, matrix);
  vtPoint[0] = t1.x;
  vtPoint[1] = t1.y;
  vtPoint[2] = t1.w || 1;
  vtPoint[3] = t4.x;
  vtPoint[4] = t4.y;
  vtPoint[5] = t4.w || 1;
  vtPoint[6] = t2.x;
  vtPoint[7] = t2.y;
  vtPoint[8] = t2.w || 1;
  vtPoint[9] = t3.x;
  vtPoint[10] = t3.y;
  vtPoint[11] = t3.w || 1;
  // 纹理坐标默认0,1，除非传入tc指定范围
  if (tc) {
    vtTex[0] = tc.x1;
    vtTex[1] = tc.y3;
    vtTex[2] = tc.x1;
    vtTex[3] = tc.y1;
    vtTex[4] = tc.x3;
    vtTex[5] = tc.y3;
    vtTex[6] = tc.x3;
    vtTex[7] = tc.y1;
  }
  else {
    vtTex[0] = 0;
    vtTex[1] = 1;
    vtTex[2] = 0;
    vtTex[3] = 0;
    vtTex[4] = 1;
    vtTex[5] = 1;
    vtTex[6] = 1;
    vtTex[7] = 0;
  }
  // 顶点buffer
  const pointBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, pointBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, vtPoint, gl.STATIC_DRAW);
  const a_position = cacheProgram.attrib.a_position;
  gl.vertexAttribPointer(a_position, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(a_position);
  // 纹理buffer
  const texBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, texBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, vtTex, gl.STATIC_DRAW);
  const a_texCoords = cacheProgram.attrib.a_texCoords;
  gl.vertexAttribPointer(a_texCoords, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(a_texCoords);
  // opacity
  const uniformValue = cacheProgram.uniformValue;
  if (uniformValue.u_opacity !== drawData.opacity) {
    uniformValue.u_opacity = drawData.opacity;
    const u_opacity = cacheProgram.uniform.u_opacity;
    gl.uniform1f(u_opacity, drawData.opacity);
  }
  // 纹理单元
  if (uniformValue.u_texture !== 0) {
    uniformValue.u_texture = 0;
    const u_texture = cacheProgram.uniform.u_texture;
    gl.uniform1i(u_texture, 0);
  }
  // clip范围
  // if (uniformValue.u_clip_x1 !== x1
  //   || uniformValue.u_clip_y1 !== y1
  //   || uniformValue.u_clip_x2 !== x2
  //   || uniformValue.u_clip_y2 !== y2) {
  //   uniformValue.u_clip_x1 = x1;
  //   uniformValue.u_clip_y1 = y1;
  //   uniformValue.u_clip_x2 = x2;
  //   uniformValue.u_clip_y2 = y2;
  //   const u_clip = cacheProgram.uniform.u_clip;
  //   gl.uniform4f(u_clip, x1, y1, x2, y2);
  // }
  // 渲染并销毁
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  gl.deleteBuffer(pointBuffer);
  gl.deleteBuffer(texBuffer);
  gl.disableVertexAttribArray(a_position);
  gl.disableVertexAttribArray(a_texCoords);
}

const MAX_TEXTURE_IMAGE_UNITS = 16;
const vtPoint = new Float32Array(MAX_TEXTURE_IMAGE_UNITS * 12);
const vtTex = new Float32Array(MAX_TEXTURE_IMAGE_UNITS * 8);
const vtOpacity = new Float32Array(MAX_TEXTURE_IMAGE_UNITS * 4);
const vtTexIndex = new Uint16Array(MAX_TEXTURE_IMAGE_UNITS * 4);
// const vtClip = new Float32Array(MAX_TEXTURE_IMAGE_UNITS * 16);
const uArray = new Uint16Array(MAX_TEXTURE_IMAGE_UNITS);
for (let i = 0; i < MAX_TEXTURE_IMAGE_UNITS; i++) {
  uArray[i] = i;
}
const indices = new Uint16Array(MAX_TEXTURE_IMAGE_UNITS * 5 - 1);
for (let i = 0; i < indices.length; i++) {
  const rem = (i + 1) % 5;
  if (rem) {
    const n = Math.floor(i / 5);
    indices[i] = n * 4 + rem - 1;
  }
  else {
    indices[i] = 65535;
  }
}

function drawPrItem(
  gl: WebGL2RenderingContext,
  cx: number,
  cy: number,
  cacheProgram: CacheProgram,
  list: DrawData[],
) {
  const length = list.length;
  if (length > MAX_TEXTURE_IMAGE_UNITS) {
    throw new Error('DrawData size is ' + length + ', max is ' + MAX_TEXTURE_IMAGE_UNITS);
  }
  for (let i = 0; i < length; i++) {
    const {
      opacity,
      matrix,
      bbox,
      tc,
      t,
      dx = 0,
      dy = 0,
    } = list[i];
    bindTexture(gl, t, i);
    const { t1, t2, t3, t4 } = bbox2Coords(bbox, cx, cy, dx, dy, matrix);
    vtPoint[i * 12] = t1.x;
    vtPoint[i * 12 + 1] = t1.y;
    vtPoint[i * 12 + 2] = t1.w || 1;
    vtPoint[i * 12 + 3] = t4.x;
    vtPoint[i * 12 + 4] = t4.y;
    vtPoint[i * 12 + 5] = t4.w || 1;
    vtPoint[i * 12 + 6] = t2.x;
    vtPoint[i * 12 + 7] = t2.y;
    vtPoint[i * 12 + 8] = t2.w || 1;
    vtPoint[i * 12 + 9] = t3.x;
    vtPoint[i * 12 + 10] = t3.y;
    vtPoint[i * 12 + 11] = t3.w || 1;
    if (tc) { // 纹理坐标默认0,1，除非传入tc指定范围
      vtTex[i * 8] = tc.x1;
      vtTex[i * 8 + 1] = tc.y1;
      vtTex[i * 8 + 2] = tc.x1;
      vtTex[i * 8 + 3] = tc.y3;
      vtTex[i * 8 + 4] = tc.x3;
      vtTex[i * 8 + 5] = tc.y1;
      vtTex[i * 8 + 6] = tc.x3;
      vtTex[i * 8 + 7] = tc.y3;
    }
    else {
      vtTex[i * 8] = 0;
      vtTex[i * 8 + 1] = 1;
      vtTex[i * 8 + 2] = 0;
      vtTex[i * 8 + 3] = 0;
      vtTex[i * 8 + 4] = 1;
      vtTex[i * 8 + 5] = 1;
      vtTex[i * 8 + 6] = 1;
      vtTex[i * 8 + 7] = 0;
    }
    vtOpacity[i * 4] = opacity;
    vtOpacity[i * 4 + 1] = opacity;
    vtOpacity[i * 4 + 2] = opacity;
    vtOpacity[i * 4 + 3] = opacity;
    vtTexIndex[i * 4] = i;
    vtTexIndex[i * 4 + 1] = i;
    vtTexIndex[i * 4 + 2] = i;
    vtTexIndex[i * 4 + 3] = i;
    // vtClip[i * 16] = x1;
    // vtClip[i * 16 + 1] = y1;
    // vtClip[i * 16 + 2] = x2;
    // vtClip[i * 16 + 3] = y2;
    // vtClip[i * 16 + 4] = x1;
    // vtClip[i * 16 + 5] = y1;
    // vtClip[i * 16 + 6] = x2;
    // vtClip[i * 16 + 7] = y2;
    // vtClip[i * 16 + 8] = x1;
    // vtClip[i * 16 + 9] = y1;
    // vtClip[i * 16 + 10] = x2;
    // vtClip[i * 16 + 11] = y2;
    // vtClip[i * 16 + 12] = x1;
    // vtClip[i * 16 + 13] = y1;
    // vtClip[i * 16 + 14] = x2;
    // vtClip[i * 16 + 15] = y2;
  }
  // 顶点buffer
  const pointBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, pointBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, vtPoint, gl.STATIC_DRAW);
  const a_position = cacheProgram.attrib.a_position;
  gl.vertexAttribPointer(a_position, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(a_position);
  // 纹理buffer
  const texBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, texBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, vtTex, gl.STATIC_DRAW);
  const a_texCoords = cacheProgram.attrib.a_texCoords;
  gl.vertexAttribPointer(a_texCoords, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(a_texCoords);
  // opacity
  const opacityBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, opacityBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, vtOpacity, gl.STATIC_DRAW);
  const a_opacity = cacheProgram.attrib.a_opacity;
  gl.vertexAttribPointer(a_opacity, 1, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(a_opacity);
  // 纹理单元索引
  const texUnitBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, texUnitBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, vtTexIndex, gl.STATIC_DRAW);
  const a_textureIndex = cacheProgram.attrib.a_textureIndex;
  gl.vertexAttribPointer(a_textureIndex, 1, gl.UNSIGNED_SHORT, false, 0, 0);
  gl.enableVertexAttribArray(a_textureIndex);
  // clip
  // const clipBuffer = gl.createBuffer();
  // gl.bindBuffer(gl.ARRAY_BUFFER, clipBuffer);
  // gl.bufferData(gl.ARRAY_BUFFER, vtClip, gl.STATIC_DRAW);
  // const a_clip = cacheProgram.attrib.a_clip;
  // gl.vertexAttribPointer(a_clip, 4, gl.FLOAT, false, 0, 0);
  // gl.enableVertexAttribArray(a_clip);
  // 纹理
  const uniformValue = cacheProgram.uniformValue;
  uArray.forEach(item => {
    const k = 'u_texture[' + item + ']';
    if (uniformValue[k] !== item) {
      uniformValue[k] = item;
      const u = cacheProgram.uniform[k];
      gl.uniform1i(u, item);
    }
  });
  // 图元重启索引
  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
  // 渲染
  gl.drawElements(gl.TRIANGLE_STRIP, length * 5 - 1, gl.UNSIGNED_SHORT, 0);
}

export function drawPr(
  gl: WebGL2RenderingContext,
  cx: number,
  cy: number,
  cacheProgram: CacheProgram,
  list: DrawData[],
) {
  const length = list.length;
  if (!length) {
    return;
  }
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  // 每16个分为一组，进行图元重启一次DrawCall
  const num = Math.floor(list.length / MAX_TEXTURE_IMAGE_UNITS);
  for (let i = 0; i < num; i++) {
    drawPrItem(
      gl,
      cx,
      cy,
      cacheProgram,
      list.slice(i * MAX_TEXTURE_IMAGE_UNITS, i * MAX_TEXTURE_IMAGE_UNITS + 16),
    );
  }
  // 末尾零散的不够16个的
  const rem = list.length % MAX_TEXTURE_IMAGE_UNITS;
  if (rem) {
    drawPrItem(
      gl,
      cx,
      cy,
      cacheProgram,
      list.slice(num * MAX_TEXTURE_IMAGE_UNITS),
    );
  }
  gl.bindVertexArray(null);
}

export function getSingleCoords() {
  const vtPoint = new Float32Array(8),
    vtTex = new Float32Array(8);
  vtPoint[0] = -1;
  vtPoint[1] = -1;
  vtPoint[2] = -1;
  vtPoint[3] = 1;
  vtPoint[4] = 1;
  vtPoint[5] = -1;
  vtPoint[6] = 1;
  vtPoint[7] = 1;
  vtTex[0] = 0;
  vtTex[1] = 0;
  vtTex[2] = 0;
  vtTex[3] = 1;
  vtTex[4] = 1;
  vtTex[5] = 0;
  vtTex[6] = 1;
  vtTex[7] = 1;
  return { vtPoint, vtTex };
}

export function preSingle(
  gl: WebGL2RenderingContext | WebGLRenderingContext,
  cacheProgram: CacheProgram,
) {
  const { vtPoint, vtTex } = getSingleCoords();
  // 顶点buffer
  const pointBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, pointBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, vtPoint, gl.STATIC_DRAW);
  const a_position = cacheProgram.attrib.a_position;
  gl.vertexAttribPointer(a_position, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(a_position);
  // 纹理buffer
  const texBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, texBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, vtTex, gl.STATIC_DRAW);
  const a_texCoords = cacheProgram.attrib.a_texCoords;
  gl.vertexAttribPointer(a_texCoords, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(a_texCoords);
  return { pointBuffer, a_position, texBuffer, a_texCoords };
}

export function drawMask(
  gl: WebGL2RenderingContext | WebGLRenderingContext,
  cacheProgram: CacheProgram,
  mask: WebGLTexture,
  summary: WebGLTexture,
  dx = 0,
  dy = 0,
) {
  const { pointBuffer, a_position, texBuffer, a_texCoords } = preSingle(gl, cacheProgram);
  // 纹理单元
  bindTexture(gl, mask, 0);
  bindTexture(gl, summary, 1);
  const u_texture1 = cacheProgram.uniform.u_texture1;
  gl.uniform1i(u_texture1, 0);
  const u_texture2 = cacheProgram.uniform.u_texture2;
  gl.uniform1i(u_texture2, 1);
  const u_d = cacheProgram.uniform.u_d;
  // 仅gray有
  if (u_d !== undefined) {
    gl.uniform2f(u_d, dx, dy);
  }
  // 渲染并销毁
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  gl.deleteBuffer(pointBuffer);
  gl.deleteBuffer(texBuffer);
  gl.disableVertexAttribArray(a_position);
  gl.disableVertexAttribArray(a_texCoords);
}

export function drawBox(
  gl: WebGL2RenderingContext | WebGLRenderingContext,
  cacheProgram: CacheProgram,
  texture: WebGLTexture,
  width: number,
  height: number,
  boxes: number[],
) {
  const { pointBuffer, a_position, texBuffer, a_texCoords } = preSingle(gl, cacheProgram);
  // 方框模糊设置宽高方向等
  const u_texture = cacheProgram.uniform.u_texture;
  const u_pw = cacheProgram.uniform.u_pw;
  const u_ph = cacheProgram.uniform.u_ph;
  gl.uniform1f(u_pw, 1 / width);
  gl.uniform1f(u_ph, 1 / height);
  const u_direction = cacheProgram.uniform.u_direction;
  const u_r = cacheProgram.uniform.u_r;
  let tex1 = texture;
  let tex2 = createTexture(gl, 0, undefined, width, height);
  let tex3 = createTexture(gl, 0, undefined, width, height);
  for (let i = 0, len = boxes.length; i < len; i++) {
    const d = boxes[i];
    const r = (d - 1) >> 1;
    gl.uniform1i(u_r, r);
    // tex1到tex2
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      tex2,
      0,
    );
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    bindTexture(gl, tex1, 0);
    gl.uniform1i(u_texture, 0);
    gl.uniform1i(u_direction, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    // tex2到tex3
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      tex3,
      0,
    );
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    bindTexture(gl, tex2, 0);
    gl.uniform1i(u_direction, 1);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    // 循环，tex1的原始传入不能改变，tex3变成tex1作为新的输入
    tex1 = tex3;
  }
  // 回收
  gl.deleteBuffer(pointBuffer);
  gl.deleteBuffer(texBuffer);
  gl.disableVertexAttribArray(a_position);
  gl.disableVertexAttribArray(a_texCoords);
  gl.deleteTexture(tex2);
  return tex3;
}

export function drawDual(
  gl: WebGL2RenderingContext | WebGLRenderingContext,
  cacheProgram: CacheProgram,
  texture: WebGLTexture,
  width: number,
  height: number,
  w: number,
  h: number,
  distance = 1,
) {
  const { pointBuffer, a_position, texBuffer, a_texCoords } = preSingle(gl, cacheProgram);
  const u_xy = cacheProgram.uniform.u_xy;
  gl.uniform2f(u_xy, distance / width, distance / height);
  const tex = createTexture(gl, 0, undefined, w, h);
  const u_texture = cacheProgram.uniform.u_texture;
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    tex,
    0,
  );
  bindTexture(gl, texture, 0);
  gl.uniform1i(u_texture, 0);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  // 回收
  gl.deleteBuffer(pointBuffer);
  gl.deleteBuffer(texBuffer);
  gl.disableVertexAttribArray(a_position);
  gl.disableVertexAttribArray(a_texCoords);
  return tex;
}

export function drawMotion(
  gl: WebGL2RenderingContext | WebGLRenderingContext,
  cacheProgram: CacheProgram,
  texture: WebGLTexture,
  kernel: number, // 半径
  radian: number, // 角度
  offset: number, // 偏移，和半径相同就等于是一个方向模糊
  width: number,
  height: number,
  willLimit = false,
) {
  const { pointBuffer, a_position, texBuffer, a_texCoords } = preSingle(gl, cacheProgram);
  // 参数，内核长度，根据长度计算的纹理参考坐标范围，偏移范围
  const k = Math.floor(kernel);
  if (k !== cacheProgram.uniformValue.u_kernel) {
    const u_kernel = cacheProgram.uniform.u_kernel;
    gl.uniform1i(u_kernel, Math.floor(kernel));
  }
  if (willLimit !== cacheProgram.uniformValue.u_limit) {
    const u_limit = cacheProgram.uniform.u_limit;
    gl.uniform1i(u_limit, willLimit ? 1 : 0);
  }
  const sin = Math.sin(radian) * kernel / height;
  const cos = Math.cos(radian) * kernel / width;
  const h = Math.sin(radian) * offset / height;
  const v = Math.cos(radian) * offset / width;
  const u_velocity = cacheProgram.uniform.u_velocity;
  gl.uniform4f(u_velocity, cos, sin, v, h);
  const u_texture = cacheProgram.uniform.u_texture;
  // 类似高斯模糊，但不拆分xy，直接一起固定执行
  let tex1 = texture;
  let tex2 = createTexture(gl, 0, undefined, width, height);
  let tex3 = createTexture(gl, 0, undefined, width, height);
  // 执行2次，三角形滤波，效果会平滑，3次更加平滑
  for (let i = 0; i < 3; i++) {
    // tex1到tex2
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      [tex2, tex3, tex2][i],
      0,
    );
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    bindTexture(gl, [tex1, tex2, tex3][i], 0);
    gl.uniform1i(u_texture, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  // 销毁
  gl.deleteBuffer(pointBuffer);
  gl.deleteBuffer(texBuffer);
  gl.disableVertexAttribArray(a_position);
  gl.disableVertexAttribArray(a_texCoords);
  gl.deleteTexture(tex3);
  return tex2;
}

export function drawRadial(
  gl: WebGL2RenderingContext | WebGLRenderingContext,
  cacheProgram: CacheProgram,
  texture: WebGLTexture,
  ratio: number,
  kernel: number,
  center: [number, number],
  width: number,
  height: number,
) {
  const { pointBuffer, a_position, texBuffer, a_texCoords } = preSingle(gl, cacheProgram);
  // 参数
  const u_kernel = cacheProgram.uniform.u_kernel;
  gl.uniform1i(u_kernel, kernel);
  const u_center = cacheProgram.uniform.u_center;
  gl.uniform2f(u_center, center[0], center[1]);
  const u_ratio = cacheProgram.uniform.u_ratio;
  gl.uniform1f(u_ratio, ratio);
  // 类似高斯模糊，但不拆分xy，直接一起固定执行
  let res = texture;
  const recycle: WebGLTexture[] = []; // 3次过程中新生成的中间纹理需要回收，先1次
  for (let i = 0; i < 1; i++) {
    const t = createTexture(gl, 0, undefined, width, height);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      t,
      0,
    );
    bindTexture(gl, res, 0);
    const u_texture = cacheProgram.uniform.u_texture;
    gl.uniform1i(u_texture, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    recycle.push(res);
    res = t;
  }
  // 销毁
  gl.deleteBuffer(pointBuffer);
  gl.deleteBuffer(texBuffer);
  gl.disableVertexAttribArray(a_position);
  gl.disableVertexAttribArray(a_texCoords);
  recycle.forEach((item) => {
    // 传入的原始不回收，交由外部控制
    if (item !== texture) {
      gl.deleteTexture(item);
    }
  });
  return res;
}

export function drawBloom(
  gl: WebGL2RenderingContext | WebGLRenderingContext,
  cacheProgram: CacheProgram,
  texture1: WebGLTexture,
  texture2: WebGLTexture,
) {
  const { pointBuffer, a_position, texBuffer, a_texCoords } = preSingle(gl, cacheProgram);
  bindTexture(gl, texture1, 0);
  bindTexture(gl, texture2, 1);
  gl.uniform1i(cacheProgram.uniform.u_texture1, 0);
  gl.uniform1i(cacheProgram.uniform.u_texture2, 1);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  // 回收
  gl.deleteBuffer(pointBuffer);
  gl.deleteBuffer(texBuffer);
  gl.disableVertexAttribArray(a_position);
  gl.disableVertexAttribArray(a_texCoords);
}

export function drawBloomBlur(
  gl: WebGL2RenderingContext | WebGLRenderingContext,
  cacheProgram: CacheProgram,
  texture: WebGLTexture,
  threshold: number,
  knee: number,
) {
  const { pointBuffer, a_position, texBuffer, a_texCoords } = preSingle(gl, cacheProgram);
  // 参数
  if (threshold !== cacheProgram.uniformValue.u_threshold) {
    const u_threshold = cacheProgram.uniform.u_threshold;
    gl.uniform1f(u_threshold, threshold);
  }
  if (knee !== cacheProgram.uniformValue.u_knee) {
    const u_knee = cacheProgram.uniform.u_knee;
    gl.uniform1f(u_knee, knee);
  }
  bindTexture(gl, texture, 0);
  const u_texture = cacheProgram.uniform.u_texture;
  gl.uniform1i(u_texture, 0);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  // 回收
  gl.deleteBuffer(pointBuffer);
  gl.deleteBuffer(texBuffer);
  gl.disableVertexAttribArray(a_position);
  gl.disableVertexAttribArray(a_texCoords);
}

export function drawDualDown13(
  gl: WebGL2RenderingContext | WebGLRenderingContext,
  cacheProgram: CacheProgram,
  texture: WebGLTexture,
  width: number,
  height: number,
  distance = 1,
) {
  const { pointBuffer, a_position, texBuffer, a_texCoords } = preSingle(gl, cacheProgram);
  const u_xy = cacheProgram.uniform.u_xy;
  gl.uniform2f(u_xy, distance / width, distance / height);
  bindTexture(gl, texture, 0);
  gl.uniform1i(cacheProgram.uniform.u_texture, 0);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  // 回收
  gl.deleteBuffer(pointBuffer);
  gl.deleteBuffer(texBuffer);
  gl.disableVertexAttribArray(a_position);
  gl.disableVertexAttribArray(a_texCoords);
}

export function drawDualUp13(
  gl: WebGL2RenderingContext | WebGLRenderingContext,
  cacheProgram: CacheProgram,
  texture1: WebGLTexture,
  texture2: WebGLTexture,
  width: number,
  height: number,
  distance = 1,
) {
  const { pointBuffer, a_position, texBuffer, a_texCoords } = preSingle(gl, cacheProgram);
  const u_xy = cacheProgram.uniform.u_xy;
  gl.uniform2f(u_xy, distance / width, distance / height);
  bindTexture(gl, texture1, 0);
  bindTexture(gl, texture2, 1);
  gl.uniform1i(cacheProgram.uniform.u_texture1, 0);
  gl.uniform1i(cacheProgram.uniform.u_texture2, 1);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  // 回收
  gl.deleteBuffer(pointBuffer);
  gl.deleteBuffer(texBuffer);
  gl.disableVertexAttribArray(a_position);
  gl.disableVertexAttribArray(a_texCoords);
}

export const drawMbm = drawMask;

export function drawColorMatrix(
  gl: WebGL2RenderingContext | WebGLRenderingContext,
  cacheProgram: CacheProgram,
  texture: WebGLTexture,
  m: number[],
) {
  const { pointBuffer, a_position, texBuffer, a_texCoords } = preSingle(gl, cacheProgram);
  // 纹理单元
  bindTexture(gl, texture, 0);
  const u_texture = cacheProgram.uniform.u_texture;
  gl.uniform1i(u_texture, 0);
  // matrix，headless-gl兼容数组方式
  const u_m = cacheProgram.uniform['u_m[0]'];
  gl.uniform1fv(u_m, new Float32Array(m));
  // 渲染并销毁
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  gl.deleteBuffer(pointBuffer);
  gl.deleteBuffer(texBuffer);
  gl.disableVertexAttribArray(a_position);
  gl.disableVertexAttribArray(a_texCoords);
}

export function drawLightDark(
  gl: WebGL2RenderingContext | WebGLRenderingContext,
  cacheProgram: CacheProgram,
  texture: WebGLTexture,
  radius: number,
  radian: number,
  width: number,
  height: number,
) {
  const { pointBuffer, a_position, texBuffer, a_texCoords } = preSingle(gl, cacheProgram);
  const h = Math.sin(radian) / height;
  const v = Math.cos(radian) / width;
  const u_velocity = cacheProgram.uniform.u_velocity;
  gl.uniform2f(u_velocity, h, v);
  const r = Math.floor(radius);
  if (r !== cacheProgram.uniformValue.u_radius) {
    const u_radius = cacheProgram.uniform.u_radius;
    gl.uniform1i(u_radius, r);
  }
  // 纹理单元
  bindTexture(gl, texture, 0);
  const u_texture = cacheProgram.uniform.u_texture;
  gl.uniform1i(u_texture, 0);
  // 渲染并销毁
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  gl.deleteBuffer(pointBuffer);
  gl.deleteBuffer(texBuffer);
  gl.disableVertexAttribArray(a_position);
  gl.disableVertexAttribArray(a_texCoords);
}

function pointNDC(
  x: number,
  y: number,
  z: number,
  w: number,
  cx: number,
  cy: number,
  cz: number,
  // w = 1,
  // cz: number,
  flipY = true,
) {
  if (w && w !== 1) {
    x /= w;
    y /= w;
    z /= w;
  }
  if (x === cx) {
    x = 0;
  }
  else {
    x = (x - cx) / cx;
  }
  if (y === cy) {
    y = 0;
  }
  else {
    if (flipY) {
      y = (cy - y) / cy;
    }
    else {
      y = (y - cy) / cy;
    }
  }
  if (cz) {
    z /= -cz;
  }
  return { x: x * w, y: y * w, z: z * w, w };
}

/**
 * 这里的换算非常绕，bbox是节点本身不包含缩放画布的scale的，参与和bbox的偏移计算，
 * matrix是最终世界matrix，包含了画布缩放的scale（PageContainer上），因此坐标是bbox乘matrix，
 * dx/dy不参与matrix计算
 */
function bbox2Coords(
  bbox: Float32Array,
  cx: number,
  cy: number,
  dx = 0,
  dy = 0,
  matrix?: Float32Array,
  offsetX = 0, // 应用matrix后的偏移，一般用不到
  offsetY = 0,
) {
  const t = calRectPoints(
    bbox[0] + dx,
    bbox[1] + dy,
    bbox[2] + dx,
    bbox[3] + dy,
    matrix,
  );
  const { x1, y1, z1, w1, x2, y2, z2, w2, x3, y3, z3, w3, x4, y4, z4, w4 } = t;
  const cz = Math.max(z1 || 0, z2 || 0, z3 || 0, z4 || 0, Math.sqrt(cx * cx + cy * cy));
  const t1 = pointNDC(x1 + offsetX, y1 + offsetY, z1 || 0, w1 || 1, cx, cy, cz);
  const t2 = pointNDC(x2 + offsetX, y2 + offsetY, z2 || 0, w2 || 1, cx, cy, cz);
  const t3 = pointNDC(x3 + offsetX, y3 + offsetY, z3 || 0, w3 || 1, cx, cy, cz);
  const t4 = pointNDC(x4 + offsetX, y4 + offsetY, z4 || 0, w4 || 1,  cx, cy, cz);
  return { t1, t2, t3, t4 };
}

// 从已绑定的framebuffer中获取当前图像数据debug
export function texture2Blob (gl: WebGL2RenderingContext | WebGLRenderingContext, w: number, h: number, title?: string) {
  const pixels = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  const os = inject.getOffscreenCanvas(w, h);
  const id = os.ctx.getImageData(0, 0, w, h);
  for (let i = 0, len = w * h * 4; i < len ;i++) {
    id.data[i] = pixels[i];
  }
  os.ctx.putImageData(id, 0, 0);
  const img = document.createElement('img');
  if (title) {
    img.title = title;
  }
  if (os.canvas instanceof HTMLCanvasElement) {
    os.canvas.toBlob(blob => {
      if (blob) {
        img.src = URL.createObjectURL(blob!);
        // img.style.backgroundColor = '#000';
        img.style.transform = 'scaleY(-1)';
        document.body.appendChild(img);
        os.release();
      }
    });
  }
}
