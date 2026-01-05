let max = 2048;
let manual = false;
let MAX_TEXTURE_SIZE = max;
let hasInit = false;

export default {
  debug: false,
  offscreenCanvas: false,
  get maxTextureSize() { // 系统纹理块尺寸限制记录，手动优先级>自动，默认2048自动不能超过
    return max;
  },
  set maxTextureSize(v: number) {
    if (hasInit) {
      max = Math.min(v, MAX_TEXTURE_SIZE);
    }
    else {
      max = v;
    }
    manual = true;
  },
  get MAX_TEXTURE_SIZE() {
    return MAX_TEXTURE_SIZE;
  },
  MAX_TEXTURE_IMAGE_UNITS: 8,
  MAX_VARYING_VECTORS: 15,
  // 初始化root的时候才会调用
  init(maxSize: number, maxUnits: number, maxVectors: number) {
    if (!manual) {
      max = Math.min(max, maxSize);
    }
    // 手动事先设置了超限的尺寸需缩小
    else if (maxSize < max) {
      max = maxSize;
    }
    hasInit = true;
    MAX_TEXTURE_SIZE = maxSize;
    this.MAX_TEXTURE_IMAGE_UNITS = maxUnits;
    this.MAX_VARYING_VECTORS = maxVectors;
  },
  defaultFontFamily: 'Arial',
  defaultFontSize: 16,
  historyTime: 1000, // 添加历史记录时命令之间是否合并的时间差阈值
  decoderWorker: '',
  decoderWorkerStr: '',
  encoderWorker: '',
  encoderWorkerStr: '',
  decodeNextDuration: 0, // 距离多久ms内开始预解码下一关键帧区域
  releasePrevDuration: 0, // 同上，释放上一关键帧区域
  gopMinDuration: 0, // 低于多少ms的gop合并成一个大的逻辑gop一口气处理加载解码，防止碎片化影响性能
  preloadAll: false, // 是否全部加载模式而不是默认分段
  mute: false, // 全局静音，不解码合成音频部分
  indexedDB: false,
  encoderFrameQue: 0, // 渲染传给合成时帧队列缓存多少，0为一帧一帧渲染等待合成，负数为无穷大，建议4低内存高并发
};
