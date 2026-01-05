export function genFrameBufferWithTexture(
  gl: WebGL2RenderingContext | WebGLRenderingContext,
  texture: WebGLTexture | undefined,
  width: number,
  height: number,
) {
  const frameBuffer = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
  if (texture) {
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0,
    );
  }
  gl.viewport(0, 0, width, height);
  return frameBuffer;
}

export function releaseFrameBuffer(
  gl: WebGL2RenderingContext | WebGLRenderingContext,
  frameBuffer: WebGLFramebuffer,
  width?: number,
  height?: number,
) {
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    null,
    0,
  );
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.deleteFramebuffer(frameBuffer);
  if (width && height) {
    gl.viewport(0, 0, width, height);
  }
}
