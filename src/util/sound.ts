/**
 * 将双声道数据混合为一个单声道数据（求平均）。
 * @param {Float32Array} leftChannelData - 左声道数据。
 * @param {Float32Array} rightChannelData - 右声道数据。
 * @returns {Float32Array} - 混合后的单声道数据。
 */
export function stereo2Mono(leftChannelData: Float32Array, rightChannelData: Float32Array) {
  const length = leftChannelData.length;
  // 创建一个新的 Float32Array 来存储单声道数据
  const monoChannelData = new Float32Array(length);

  for (let i = 0; i < length; i++) {
    // 求平均值: (左 + 右) / 2
    monoChannelData[i] = (leftChannelData[i] + rightChannelData[i]) * 0.5;
  }

  return monoChannelData;
}

// 提取audioBuffer中的一段，毫秒单位
export function extractAudioBuffer(sourceBuffer: AudioBuffer, start: number, end: number) {
  const { sampleRate, numberOfChannels } = sourceBuffer;
  // Start Frame: 帧 = 时间 (s) * 采样率
  const startFrame = Math.floor((start * 1e-3) * sampleRate);
  const endFrame = Math.min(
    Math.ceil((end * 1e-3) * sampleRate),
    sourceBuffer.length,
  );
  const numberOfFrames = endFrame - startFrame;
  if (numberOfFrames <= 0) {
    return;
  }
  // const res: AudioChunk[] = [];
  // for (let i = 0; i < numberOfFrames; i++) {
  //   const index = startFrame + i;
  //   const timestamp = index * 1e3 / sampleRate;
  //   const duration = 1e3 / sampleRate;
  //   const channels: Float32Array[] = [];
  //   for (let i = 0; i < numberOfChannels; i++) {
  //     // 获取原始通道数据
  //     const channelData = sourceBuffer.getChannelData(i);
  //     const segmentView = channelData.subarray(
  //       startFrame,
  //       startFrame + 1,
  //     );
  //     channels.push(new Float32Array(segmentView));
  //   }
  //   res.push({
  //     format: 'f32-planar' as const,
  //     channels,
  //     timestamp,
  //     duration,
  //     sampleRate,
  //     numberOfChannels,
  //     numberOfFrames: 1,
  //   });
  // }
  // return res;
  const timestamp = startFrame * 1e3 / sampleRate;
  const duration = numberOfFrames * 1e3 / sampleRate;
  const channels: Float32Array[] = [];
  for (let i = 0; i < numberOfChannels; i++) {
    // 获取原始通道数据
    const channelData = sourceBuffer.getChannelData(i);
    const segmentView = channelData.subarray(
      startFrame,
      endFrame
    );
    channels.push(new Float32Array(segmentView));
  }
  return {
    format: 'f32-planar' as const,
    channels,
    numberOfFrames,
    startFrame,
    endFrame,
    sampleRate,
    numberOfChannels,
    timestamp,
    duration,
  };
}

export async function reSample(
  sourceBuffer: AudioBuffer,
  numberOfChannels: number,
  targetSampleRate: number,
) {
  if (sourceBuffer.numberOfChannels === numberOfChannels && sourceBuffer.sampleRate === targetSampleRate) {
    return sourceBuffer;
  }
  const targetLength: number = Math.round(sourceBuffer.length * targetSampleRate / sourceBuffer.sampleRate);
  const targetContext = new OfflineAudioContext(numberOfChannels, targetLength, targetSampleRate);
  const sourceNode: AudioBufferSourceNode = targetContext.createBufferSource();
  // 如果是单声道->双声道，生成新的audioBuffer
  if (sourceBuffer.numberOfChannels === 1 && numberOfChannels === 2) {
    const tempContext = new OfflineAudioContext(2, sourceBuffer.length, sourceBuffer.sampleRate);
    const buffer = tempContext.createBuffer(2, sourceBuffer.length, sourceBuffer.sampleRate);
    const monoData = sourceBuffer.getChannelData(0);
    buffer.copyToChannel(monoData, 0, 0);
    buffer.copyToChannel(monoData, 1, 0);
    sourceNode.buffer = buffer;
  }
  // 相同或降声道无需关心
  else {
    sourceNode.buffer = sourceBuffer;
  }
  // sourceNode.buffer = sourceBuffer;
  sourceNode.connect(targetContext.destination);
  sourceNode.start(0);
  return await targetContext.startRendering();
}

export function sliceAudioBuffer(audioBuffer: AudioBuffer, start: number, end: number) {
  const startFrame = Math.floor(start * 1e-3 * audioBuffer.sampleRate);
  const endFrame = Math.min(Math.ceil(end * 1e-3 * audioBuffer.sampleRate), audioBuffer.length);
  if (startFrame > endFrame || startFrame >= audioBuffer.length) {
    throw new Error('Invalid range');
  }
  if (startFrame === 0 && endFrame >= audioBuffer.length - 1) {
    return audioBuffer;
  }
  const context = new OfflineAudioContext(audioBuffer.numberOfChannels, endFrame - startFrame + 1, audioBuffer.sampleRate);
  const buffer = context.createBuffer(audioBuffer.numberOfChannels, endFrame - startFrame + 1, audioBuffer.sampleRate);
  for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
    const data = audioBuffer.getChannelData(i);
    const view = data.subarray(startFrame, endFrame + 1);
    buffer.copyToChannel(view, i, 0);
  }
  return buffer;
}

/**
 * 将 S16 (16位整数) 数据块转换为 AudioBuffer 所需的 Float32Array 格式。
 * @param s16DataBlock - 包含单个通道 S16 数据的 ArrayBuffer 或 TypedArray。
 * @param totalFrames - 该通道应包含的总帧数（样本数）。
 * @returns 转换后的 Float32Array。
 */
export function convertS16ToFloat32(
  s16DataBlock: ArrayBuffer | ArrayBufferView | Float32Array,
  totalFrames: number,
) {

  // 1. 创建 Int16Array 视图来读取原始的 16 位数据
  // 注意：我们使用 ArrayBuffer 或其底层 ArrayBuffer 来创建视图
  const sourceInt16 = new Int16Array(
    s16DataBlock instanceof ArrayBuffer ? s16DataBlock : s16DataBlock.buffer
  );

  // 校验数据长度
  // S16 是 2 字节/样本，所以 Int16Array 的 length 应该等于总帧数
  if (sourceInt16.length !== totalFrames) {
    console.error(`数据长度校验失败：预期 ${totalFrames} 个样本，实际 Int16Array 长度为 ${sourceInt16.length}。`);
    // 这是一个致命错误，是加速的根本原因！
  }

  // 2. 创建目标 Float32Array
  const targetFloat32 = new Float32Array(totalFrames);

  // 16 位整数的最大绝对值（用于归一化）
  const MAX_INT_16 = 32768.0;

  // 3. 循环转换和归一化
  for (let i = 0; i < totalFrames; i++) {
    const intSample = sourceInt16[i];

    // 将整数值归一化到 [-1.0, 1.0) 范围
    targetFloat32[i] = intSample / MAX_INT_16;
  }

  return targetFloat32;
}

export default {
  stereo2Mono,
  extractAudioBuffer,
  reSample,
  sliceAudioBuffer,
  convertS16ToFloat32,
};
