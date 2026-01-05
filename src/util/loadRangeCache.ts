const META_DB_NAME = 'VideoEditorDB';
const META_DB_VERSION = 1;
const STORE_NAME = 'VideoRange';

async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(META_DB_NAME, META_DB_VERSION);
    // 首次创建或版本升级时触发
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      // 创建对象仓库，keyPath 定义了存储对象的唯一索引
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(`IndexedDB Error: ${request.error}`);
    };
  });
}

function wrapIDBRequest(request: IDBRequest): Promise<{ id: string, arrayBuffer: ArrayBuffer }> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function wrapIDBTransaction(transaction: IDBTransaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve(undefined);
    transaction.onerror = () => reject(transaction.error);
  });
}

async function readRange(id: string, db?: IDBDatabase) {
  if (!db) {
    db = await openDB();
  }
  // 开启只读事务 (readonly)
  const transaction = db.transaction(STORE_NAME, 'readonly');
  const store = transaction.objectStore(STORE_NAME);
  return wrapIDBRequest(store.get(id));
}

async function writeRange(data: any, db?: IDBDatabase) {
  if (!db) {
    db = await openDB();
  }
  // 开启读写事务 (readwrite)
  const transaction = db.transaction(STORE_NAME, 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  await wrapIDBRequest(store.put(data));
  await wrapIDBTransaction(transaction);
}

async function readKeyCursor(db?: IDBDatabase) {
  if (!db) {
    db = await openDB();
  }
  const transaction = db.transaction(STORE_NAME, 'readonly');
  const store = transaction.objectStore(STORE_NAME);
  const request = store.openKeyCursor();
  const keys: IDBValidKey[] = [];
  return new Promise((resolve, reject) => {
    request.onsuccess = (e) => {
      const cursor = request.result;
      if (cursor) {
        keys.push(cursor.key);
        cursor.continue();
      }
      else {
        resolve(keys);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

async function loadAndStore(url: string, start: number, end: number, db: IDBDatabase, options?: RequestInit) {
  const id = url + ':' + start + '-' + end;
  const cache = await readRange(id, db);
  if (cache) {
    return { status: 206, arrayBuffer: cache.arrayBuffer };
  }
  // console.log('miss', id);
  const response = await fetch(url, {
    ...options,
    cache: 'force-cache',
    headers: {
      'Cache-Control': 'max-age=31536000',
      Range: `bytes=${start}-${end}`,
    },
  });
  if (response.status === 206) {
    const arrayBuffer = await response.arrayBuffer();
    await writeRange({ id, arrayBuffer });
    return { status: 206, arrayBuffer };
  }
  return { status: response.status };
}

// 每4m数据存为一份，不足视为一份（一般是结尾）
const PER_SIZE = 1024 * 1024 * 4;

export async function loadRange(url: string, start: number, end: number, fileSize: number, options?: RequestInit & { indexedDB: boolean }) {
  if (!options?.indexedDB) {
    const response = await fetch(url, {
      ...options,
      cache: 'force-cache',
      headers: {
        'Cache-Control': 'max-age=31536000',
        Range: `bytes=${start}-${end}`,
      },
    });
    if (response.status === 206) {
      const arrayBuffer = await response.arrayBuffer();
      return { status: 206, arrayBuffer };
    }
    return { status: response.status };
  }
  const chunks: [number, number][] = [];
  let head = PER_SIZE * Math.floor(start / PER_SIZE);
  const begin = head;
  while (head <= end) {
    const tail = Math.min(fileSize - 1, head + PER_SIZE - 1);
    chunks.push([head, tail]);
    head = tail + 1;
  }
  const db = await openDB();
  const list = await Promise.all(chunks.map(item => loadAndStore(url, item[0], item[1], db, options)));
  const res = new Uint8Array(chunks.length * PER_SIZE * 8);
  for (let i = 0, len = list.length; i < len; i++) {
    const item = list[i];
    if (item.status !== 206) {
      return { status: item.status };
    }
    const temp = new Uint8Array(item.arrayBuffer!);
    res.set(temp, i * PER_SIZE);
  }
  return { status: 206, arrayBuffer: res.buffer.slice(start - begin, end - begin + 1) };
}
