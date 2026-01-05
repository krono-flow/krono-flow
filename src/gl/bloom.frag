#ifdef GL_ES
precision mediump float;
#endif

varying vec2 v_texCoords;
uniform sampler2D u_texture1;
uniform sampler2D u_texture2;

// ACES Tone Mapping 近似公式
// 作用：让超过 1.0 的超亮区域平滑过渡，不会出现大片“死白”
vec3 ACESFilm(vec3 x) {
  float a = 2.51;
  float b = 0.03;
  float c = 2.43;
  float d = 0.59;
  float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

void main() {
  // 1. 获取原图颜色并转入线性空间
  vec3 sceneColor = texture2D(u_texture1, v_texCoords).rgb;
  sceneColor = pow(sceneColor, vec3(2.2));
  // 2. 获取辉光颜色 (它本身就是在线性空间处理的)
  vec3 bloomColor = texture2D(u_texture2, v_texCoords).rgb;
  // 3. 加法合成，这一步之后，像素值可能会超 1.0
  vec3 result = sceneColor + bloomColor;
  // 4. 色调映射 (Tone Mapping)
  // 非常关键！它能把超亮的 HDR 数值映射回显示器能显示的 [0, 1] 范围
  // 同时保留高光部分的色彩饱和度
  result = ACESFilm(result);
  // 5. 伽马校正回 sRGB 空间
  result = pow(result, vec3(1.0 / 2.2));
  gl_FragColor = vec4(result, 1.0);
}
