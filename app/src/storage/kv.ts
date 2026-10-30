// 키-값 저장소 어댑터. 토스: SDK Storage(기기 로컬, 앱 삭제 시 삭제), 브라우저: localStorage.
// 둘 다 실패할 수 있으므로(사생활 모드·권한) 읽기 실패는 null, 쓰기 실패는 조용히 무시한다.
import { isInToss } from '../platform/toss';

export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export const tossStore: KeyValueStore = {
  async get(key) {
    const { Storage } = await import('@apps-in-toss/web-framework');
    return Storage.getItem(key);
  },
  async set(key, value) {
    const { Storage } = await import('@apps-in-toss/web-framework');
    await Storage.setItem(key, value);
  },
  async remove(key) {
    const { Storage } = await import('@apps-in-toss/web-framework');
    await Storage.removeItem(key);
  },
};

export const webStore: KeyValueStore = {
  async get(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  async set(key, value) {
    try { localStorage.setItem(key, value); } catch { /* 저장 불가 환경 */ }
  },
  async remove(key) {
    try { localStorage.removeItem(key); } catch { /* 저장 불가 환경 */ }
  },
};

export function memoryStore(): KeyValueStore {
  const m = new Map<string, string>();
  return {
    async get(k) { return m.get(k) ?? null; },
    async set(k, v) { m.set(k, v); },
    async remove(k) { m.delete(k); },
  };
}

function safe(store: KeyValueStore): KeyValueStore {
  return {
    async get(k) { try { return await store.get(k); } catch { return null; } },
    async set(k, v) { try { await store.set(k, v); } catch { /* 무시 */ } },
    async remove(k) { try { await store.remove(k); } catch { /* 무시 */ } },
  };
}

export const store: KeyValueStore = safe(isInToss() ? tossStore : webStore);
