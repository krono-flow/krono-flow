#ifdef GL_ES
precision mediump float;
#endif

varying vec2 v_texCoords;
uniform sampler2D u_texture;
uniform float u_threshold;
uniform float u_knee;

void main() {
  vec4 color = texture2D(u_texture, v_texCoords);
  // 1. 转到线性空间（解决暗部虚高问题）
  vec3 linearColor = pow(color.rgb, vec3(2.2));
  // 2. 计算亮度 (在线性空间下，不需要再次平方)，HSP 颜色模型
  float brightness = dot(linearColor, vec3(0.299, 0.587, 0.114));
  // 3. 接入 knee 软阈值
  float k = u_threshold * u_knee;
  float soft = brightness - u_threshold + k;
  soft = clamp(soft, 0.0, 2.0 * k);
  soft = (soft * soft) / (4.0 * k + 0.0001);
  float factor = max(soft, brightness - u_threshold) / max(brightness, 0.0001);
  // 4. 提取出的亮部
  vec3 brightPart = linearColor * factor;
  gl_FragColor = vec4(brightPart, 1.0);
}
