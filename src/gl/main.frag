#ifdef GL_ES
precision mediump float;
#endif

varying vec4 v_position;
varying vec2 v_texCoords;
uniform float u_opacity;
//uniform vec4 u_clip;
uniform sampler2D u_texture;

void main() {
//  if (v_position.x < u_clip[0] || v_position.x > u_clip[2] || v_position.y < u_clip[1] || v_position.y > u_clip[3]) {
//    discard;
//  }
  if (u_opacity <= 0.0) {
    discard;
  }
  vec4 color = texture2D(u_texture, v_texCoords);
  if (color.a <= 0.0) {
    discard;
  }
  gl_FragColor = color * u_opacity;
}
