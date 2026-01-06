#ifdef GL_ES
precision mediump float;
#endif

varying vec2 v_texCoords;
uniform vec2 u_xy;
uniform sampler2D u_texture1;
uniform sampler2D u_texture2;

void main() {
  vec4 color1 = texture2D(u_texture1, v_texCoords);
  vec4 color2 = texture2D(u_texture2, v_texCoords) * 0.25;
  color2 += texture2D(u_texture2, v_texCoords + vec2(u_xy.x, u_xy.y)) * 0.125;
  color2 += texture2D(u_texture2, v_texCoords + vec2(u_xy.x, -u_xy.y)) * 0.125;
  color2 += texture2D(u_texture2, v_texCoords + vec2(-u_xy.x, u_xy.y)) * 0.125;
  color2 += texture2D(u_texture2, v_texCoords + vec2(-u_xy.x, -u_xy.y)) * 0.125;
  color2 += texture2D(u_texture2, v_texCoords + vec2(u_xy.x, 0)) * 0.0625;
  color2 += texture2D(u_texture2, v_texCoords + vec2(-u_xy.x, 0)) * 0.0625;
  color2 += texture2D(u_texture2, v_texCoords + vec2(0, u_xy.y)) * 0.0625;
  color2 += texture2D(u_texture2, v_texCoords + vec2(0, -u_xy.y)) * 0.0625;
  gl_FragColor = vec4(color1 + color2 * 0.6);
}
