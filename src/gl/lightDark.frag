#ifdef GL_ES
precision mediump float;
#endif

varying vec2 v_texCoords;
uniform sampler2D u_texture;
uniform vec2 u_velocity;
uniform int u_radius;

const int MAX_KERNEL_SIZE = 1024;

void main() {
  vec4 color = texture2D(u_texture, v_texCoords);
  float total = float(u_radius);
  for (int i = 1; i < MAX_KERNEL_SIZE; i++) {
    if (i > u_radius) {
      break;
    }
    vec2 bias = u_velocity.xy * float(i);
    vec2 bias1 = v_texCoords + bias;
    vec2 bias2 = v_texCoords - bias;
    float add = 0.0;
    float reduce = 0.0;
    if (bias1.x < 0.0 || bias1.x > 1.0 || bias1.y < 0.0 || bias1.y > 1.0) {
      add = 1.0;
    }
    else {
      add = 1.0 - texture2D(u_texture, bias1).a;
    }
    if (bias2.x < 0.0 || bias2.x > 1.0 || bias2.y < 0.0 || bias2.y > 1.0) {
      reduce = -1.0;
    }
    else {
      reduce = texture2D(u_texture, bias2).a - 1.0;
    }
    float b = 0.0;
    // 防止亮的越亮暗的越暗，反过来亮的增加的少暗的增加的多，暗的减少的少亮的减少的多
    if (add > 0.0 || reduce < 0.0) {
      vec3 linearColor = pow(color.rgb, vec3(2.2));
      float bn = dot(linearColor, vec3(0.299, 0.587, 0.114));
      b = 1.0 - bn * bn;
    }
    if (add > 0.0) {
      float f = (total - float(i)) / total / total * b * 0.8;
      color.r += add * f;
      color.g += add * f;
      color.b += add * f;
    }
    if (reduce < 0.0) {
      float f = (total - float(i)) / total / total * b * 0.8;
      color.r += reduce * f;
      color.g += reduce * f;
      color.b += reduce * f;
    }
  }
  gl_FragColor = vec4(
    clamp(0.0, color.r, 1.0),
    clamp(0.0, color.g, 1.0),
    clamp(0.0, color.b, 1.0),
    color.a
  );
}
