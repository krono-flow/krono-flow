#version 300 es

in vec3 a_position;
in vec2 a_texCoords;
in float a_opacity;
in float a_textureIndex;
in vec4 a_clip;
out vec4 v_position;
out vec2 v_texCoords;
out float v_opacity;
out float v_textureIndex;
out vec4 v_clip;

void main() {
  gl_Position = vec4(a_position.xy, 0, a_position.z);
  v_position = gl_Position;
  v_texCoords = a_texCoords;
  v_opacity = a_opacity;
  v_textureIndex = a_textureIndex;
  v_clip = a_clip;
}
