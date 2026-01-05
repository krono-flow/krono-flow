attribute vec4 a_position;
varying vec4 v_position;
attribute vec2 a_texCoords;
varying vec2 v_texCoords;

void main() {
  gl_Position = vec4(a_position.xy, 0, a_position.z);
  v_position = gl_Position;
  v_texCoords = a_texCoords;
}
