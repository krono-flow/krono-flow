#ifdef GL_ES
precision mediump float;
#endif

varying vec2 v_texCoords;
uniform vec2 u_xy;
uniform sampler2D u_texture;

void main() {
  vec4 color = texture2D(u_texture, v_texCoords) * 0.125;
  color += texture2D(u_texture, v_texCoords + vec2(u_xy.x, u_xy.y)) * 0.125;
  color += texture2D(u_texture, v_texCoords + vec2(u_xy.x, -u_xy.y)) * 0.125;
  color += texture2D(u_texture, v_texCoords + vec2(-u_xy.x, u_xy.y)) * 0.125;
  color += texture2D(u_texture, v_texCoords + vec2(-u_xy.x, -u_xy.y)) * 0.125;
  color += texture2D(u_texture, v_texCoords + vec2(u_xy.x * 2.0, u_xy.y * 2.0)) * 0.03125;
  color += texture2D(u_texture, v_texCoords + vec2(u_xy.x * 2.0, -u_xy.y * 2.0)) * 0.03125;
  color += texture2D(u_texture, v_texCoords + vec2(-u_xy.x * 2.0, u_xy.y * 2.0)) * 0.03125;
  color += texture2D(u_texture, v_texCoords + vec2(-u_xy.x * 2.0, -u_xy.y * 2.0)) * 0.03125;
  color += texture2D(u_texture, v_texCoords + vec2(u_xy.x * 2.0, 0)) * 0.0625;
  color += texture2D(u_texture, v_texCoords + vec2(-u_xy.x * 2.0, 0)) * 0.0625;
  color += texture2D(u_texture, v_texCoords + vec2(0, u_xy.y * 2.0)) * 0.0625;
  color += texture2D(u_texture, v_texCoords + vec2(0, -u_xy.y * 2.0)) * 0.0625;
  gl_FragColor = color;
}
