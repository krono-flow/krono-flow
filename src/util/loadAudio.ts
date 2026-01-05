export type LoadAudioRes = {
  success: boolean;
  duration: number;
  audioBuffer?: AudioBuffer;
  release: () => void;
};

enum State {
  NONE = 0,
  LOADING = 1,
  LOADED = 2,
}

const HASH: Record<string, {
  state: State,
  list: Array<(p: LoadAudioRes) => void>,
  count: number, // 简易计数器回收
  res: LoadAudioRes,
}> = {};

export async function loadAudio(url: string, options?: RequestInit) {
  let cache = HASH[url];
  // 已加载或正在加载的复用
  if (cache) {
    cache.count++;
    if (cache.state === State.LOADED) {
      return cache.res;
    }
    else if (cache.state === State.LOADING) {
      return new Promise<LoadAudioRes>((resolve) => {
        cache.list.push(resolve);
      });
    }
  }
  // 新加载
  cache = HASH[url] = {
    state: State.LOADING,
    list: [],
    count: 0,
    res: {
      success: false,
      duration: 0,
      release() {
        cache.count--;
        if (cache.count <= 0) {
          cache.res.audioBuffer = undefined;
          delete HASH[url];
        }
      },
    },
  };
  const data = await fetch(url, Object.assign({
    mode: 'cors',
  }, options));
  if (data.status !== 200 && data.status !== 304) {
    cache.state = State.LOADED;
    return cache.res;
  }
  const buffer = await data.arrayBuffer();
  const ctx = new AudioContext();
  const audioBuffer = await ctx.decodeAudioData(buffer);
  cache.count++;
  return new Promise<LoadAudioRes>((resolve) => {
    cache.res.success = true;
    cache.res.audioBuffer = audioBuffer;
    cache.res.duration = Math.ceil(audioBuffer.duration * 1000);
    cache.state = State.LOADED;
    resolve(cache.res);
    cache.list.splice(0).forEach(item => {
      cache.count++;
      item(cache.res);
    });
  });
}
