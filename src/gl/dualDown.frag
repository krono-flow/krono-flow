#ifdef GL_ES
precision mediump float;
#endif

varying vec2 v_texCoords;
uniform vec2 u_xy;
uniform sampler2D u_texture;

void main() {
  vec4 color = texture2D(u_texture, v_texCoords);
  color += texture2D(u_texture, v_texCoords + vec2(u_xy.x, u_xy.y)) * 0.125;
  color += texture2D(u_texture, v_texCoords + vec2(u_xy.x, -u_xy.y)) * 0.125;
  color += texture2D(u_texture, v_texCoords + vec2(-u_xy.x, u_xy.y)) * 0.125;
  color += texture2D(u_texture, v_texCoords + vec2(-u_xy.x, -u_xy.y)) * 0.125;
  gl_FragColor = color;
}
