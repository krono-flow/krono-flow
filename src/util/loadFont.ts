import font from '../style/font';

export type LoadFontRes = {
  success: boolean;
  arrayBuffer?: ArrayBuffer;
  release: () => void;
};

enum State {
  NONE = 0,
  LOADING = 1,
  LOADED = 2,
}

const HASH: Record<string, {
  state: State,
  list: Array<(p: LoadFontRes) => void>,
  count: number, // 简易计数器回收
  res: LoadFontRes,
}> = {};

export async function loadFont(url: string, fontFamily?: string, options?: RequestInit) {
  let cache = HASH[url];
  // 已加载或正在加载的复用
  if (cache) {
    cache.count++;
    if (cache.state === State.LOADED) {
      return cache.res;
    }
    else if (cache.state === State.LOADING) {
      return new Promise<LoadFontRes>((resolve) => {
        cache.list.push(resolve);
      })
    }
  }
  // 新加载
  cache = HASH[url] = {
    state: State.LOADING,
    list: [],
    count: 0,
    res: {
      success: false,
      release() {
        cache.count--;
        if (cache.count <= 0) {
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
  const ab = await data.arrayBuffer();
  await font.registerAb(ab, fontFamily);
  cache.count++;
  return new Promise<LoadFontRes>((resolve) => {
    cache.res.success = true;
    cache.res.arrayBuffer = ab;
    cache.state = State.LOADED;
    resolve(cache.res);
    cache.list.splice(0).forEach(item => {
      cache.count++;
      item(cache.res);
    });
  });
}
