export type LoadImgRes = {
  success: boolean;
  source?: HTMLImageElement;
  frames: VideoFrame[];
  width: number;
  height: number;
  release: () => void;
};

enum State {
  NONE = 0,
  LOADING = 1,
  LOADED = 2,
}

const HASH: Record<string, {
  state: State,
  list: Array<(p: LoadImgRes) => void>,
  count: number, // 简易计数器回收
  res: LoadImgRes,
}> = {};

function isGif(uint8array: Uint8Array) {
  const gif87a = [71, 73, 70, 56, 55, 97];
  const gif89a = [71, 73, 70, 56, 57, 97];
  return uint8array[0] === gif87a[0]
    && uint8array[1] === gif87a[1]
    && uint8array[2] === gif87a[2]
    && uint8array[3] === gif87a[3]
    && (uint8array[4] === gif87a[4] || uint8array[4] === gif89a[4])
    && uint8array[5] === gif87a[5];
}

export function getCacheImg(url: string) {
  const o = HASH[url];
  if (o?.state === State.LOADED) {
    return o.res;
  }
}

export async function loadImg(url: string, options?: RequestInit) {
  let cache = HASH[url];
  // 已加载或正在加载的复用
  if (cache) {
    cache.count++;
    if (cache.state === State.LOADED) {
      return cache.res;
    }
    else if (cache.state === State.LOADING) {
      return new Promise<LoadImgRes>((resolve) => {
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
      frames: [],
      width: 0,
      height: 0,
      release() {
        cache.count--;
        if (cache.count <= 0) {
          if (cache.res.source) {
            URL.revokeObjectURL(cache.res.source.src);
          }
          cache.res.frames.forEach(item => item.close());
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
  // 解析动图
  if (typeof ImageDecoder !== 'undefined') {
    const uint8array = new Uint8Array(ab);
    if (isGif(uint8array)) {
      const imageDecoder = new ImageDecoder({
        data: ab,
        type: 'image/gif',
      });
      await imageDecoder.tracks.ready;
      const track = imageDecoder.tracks.selectedTrack;
      if (track) {
        for (let i = 0; i < track.frameCount; i++) {
          const f = await imageDecoder.decode({
            frameIndex: i,
          });
          cache.res.frames.push(f.image);
        }
        cache.state = State.LOADED;
        cache.res.success = true;
        cache.res.width = cache.res.frames[0].codedWidth;
        cache.res.height = cache.res.frames[0].codedHeight;
        cache.count++;
        cache.list.splice(0).forEach(item => {
          cache.count++;
          item(cache.res);
        });
        imageDecoder.close();
        return cache.res;
      }
      imageDecoder.close();
    }
  }
  // 不支持则降级为静态图
  const blob = new Blob([ab]);
  const img = new Image();
  img.src = URL.createObjectURL(blob);
  cache.count++;
  return new Promise<LoadImgRes>((resolve) => {
    img.onload = () => {
      cache.state = State.LOADED;
      cache.res.success = true;
      cache.res.source = img;
      cache.res.width = img.width;
      cache.res.height = img.height;
      resolve(cache.res);
      cache.list.splice(0).forEach(item => {
        cache.count++;
        item(cache.res);
      });
    };
    img.onerror = () => {
      cache.state = State.LOADED;
      resolve(cache.res);
      cache.list.splice(0).forEach(item => {
        cache.count++;
        item(cache.res);
      });
    };
  });
}
