#ifdef GL_ES
precision mediump float;
#endif

varying vec2 v_texCoords;
uniform sampler2D u_texture;
uniform int u_kernel;
uniform vec4 u_velocity;
uniform int u_limit;

const int MAX_KERNEL_SIZE = 1024;

void main() {
  vec4 color = texture2D(u_texture, v_texCoords + u_velocity.zw);
  for (int i = 1; i < MAX_KERNEL_SIZE; i++) {
    if (i >= u_kernel) {
      break;
    }
    vec2 bias = u_velocity.xy * (float(i) / float(u_kernel));
    vec2 c1 = v_texCoords + bias + u_velocity.zw;
    vec2 c2 = v_texCoords - bias + u_velocity.zw;
    // 超限从另外一边取
    if (u_limit == 1) {
      if (c1.x < 0.0) {
        c1.x += 1.0;
      }
      else if (c1.x > 1.0) {
        c1.x -= 1.0;
      }
      if (c1.y < 0.0) {
        c1.y += 1.0;
      }
      else if (c1.y > 1.0) {
        c1.y -= 1.0;
      }
      if (c2.x < 0.0) {
        c2.x += 1.0;
      }
      else if (c2.x > 1.0) {
        c2.x -= 1.0;
      }
      if (c2.y < 0.0) {
        c2.y += 1.0;
      }
      else if (c2.y > 1.0) {
        c2.y -= 1.0;
      }
    }
    color += texture2D(u_texture, c1);
    color += texture2D(u_texture, c2);
  }
  gl_FragColor = color / float((u_kernel - 1) * 2 + 1);
}
