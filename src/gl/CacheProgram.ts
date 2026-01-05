let last: CacheProgram | undefined = undefined;

/**
 * 缓存program，以及里面的attribute/uniform的location，连续使用时不必每次寻找，
 * 切换program，则需要重新初始化location
 */
export class CacheProgram {
  program: WebGLProgram;
  options: {
    uniform?: string[],
    attrib?: string[],
  };
  uniform: Record<string, WebGLUniformLocation>;
  attrib: Record<string, number>;
  uniformValue: Record<string, any>;

  constructor(gl: WebGL2RenderingContext | WebGLRenderingContext, p: WebGLProgram, options?: {
    uniform?: string[],
    attrib?: string[],
  }) {
    this.program = p;
    this.options = options || {};
    this.uniform = {};
    this.attrib = {};
    this.uniformValue = {};
    this.initLocations(gl);
  }

  initLocations(gl: WebGL2RenderingContext | WebGLRenderingContext) {
    if (this.options.uniform) {
      this.options.uniform.forEach(k => {
        this.uniform[k] = gl.getUniformLocation(this.program, k)!;
      });
    }
    if (this.options.attrib) {
      this.options.attrib.forEach(k => {
        this.attrib[k] = gl.getAttribLocation(this.program, k);
      });
    }
  }

  static useProgram(gl: WebGL2RenderingContext | WebGLRenderingContext, cp: CacheProgram) {
    if (last !== cp) {
      last = cp;
      gl.useProgram(cp.program);
      // cp.initLocations(gl);
      // cp.uniformValue = {};
    }
  }
}

export default CacheProgram;
