#version 300 es
#ifdef GL_ES
precision mediump float;
#endif

in vec4 v_position;
in vec2 v_texCoords;
in float v_opacity;
in float v_textureIndex;
//in vec4 v_clip;
out vec4 fragColor;
uniform sampler2D u_texture[16];

void main() {
//  if (v_position.x < v_clip[0] || v_position.x > v_clip[2] || v_position.y < v_clip[1] || v_position.y > v_clip[3]) {
//    discard;
//  }
  if (v_opacity <= 0.0) {
    discard;
  }
  vec4 color;
  if (v_textureIndex == 0.0) {
    color = texture(u_texture[0], v_texCoords);
  }
  else if (v_textureIndex == 1.0) {
    color = texture(u_texture[1], v_texCoords);
  }
  else if (v_textureIndex == 2.0) {
    color = texture(u_texture[2], v_texCoords);
  }
  else if (v_textureIndex == 3.0) {
    color = texture(u_texture[3], v_texCoords);
  }
  else if (v_textureIndex == 4.0) {
    color = texture(u_texture[4], v_texCoords);
  }
  else if (v_textureIndex == 5.0) {
    color = texture(u_texture[5], v_texCoords);
  }
  else if (v_textureIndex == 6.0) {
    color = texture(u_texture[6], v_texCoords);
  }
  else if (v_textureIndex == 7.0) {
    color = texture(u_texture[7], v_texCoords);
  }
  else if (v_textureIndex == 8.0) {
    color = texture(u_texture[8], v_texCoords);
  }
  else if (v_textureIndex == 9.0) {
    color = texture(u_texture[9], v_texCoords);
  }
  else if (v_textureIndex == 10.0) {
    color = texture(u_texture[10], v_texCoords);
  }
  else if (v_textureIndex == 11.0) {
    color = texture(u_texture[11], v_texCoords);
  }
  else if (v_textureIndex == 12.0) {
    color = texture(u_texture[12], v_texCoords);
  }
  else if (v_textureIndex == 13.0) {
    color = texture(u_texture[13], v_texCoords);
  }
  else if (v_textureIndex == 14.0) {
    color = texture(u_texture[14], v_texCoords);
  }
  else if (v_textureIndex == 15.0) {
    color = texture(u_texture[15], v_texCoords);
  }
  fragColor = color * v_opacity;
}
