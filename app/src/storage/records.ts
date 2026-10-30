// 로컬 기록: 최근 이용 기록(최대 20개)과 최근 검색 역(최대 8개). 서버로 보내지 않는다.
import type { KeyValueStore } from './kv';

export interface HistoryEntry {
  /** 공유 쿼리(encodePayload 결과). 같은 쿼리는 하나만 남긴다. */
  query: string;
  topStationId: string;
  count: number;
  at: number;
}

const HISTORY_KEY = 'saeit.history.v1';
const RECENT_KEY = 'saeit.recentStations.v1';
export const HISTORY_MAX = 20;
export const RECENT_MAX = 8;

async function readJson<T>(s: KeyValueStore, key: string, fallback: T, valid: (x: unknown) => boolean): Promise<T> {
  const raw = await s.get(key);
  if (!raw) return fallback;
  try {
    const v = JSON.parse(raw) as unknown;
    return valid(v) ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}

const isHistory = (x: unknown) => Array.isArray(x) && x.every((e) => e && typeof e.query === 'string' && typeof e.topStationId === 'string' && typeof e.at === 'number');
const isStrings = (x: unknown) => Array.isArray(x) && x.every((e) => typeof e === 'string');

export async function loadHistory(s: KeyValueStore): Promise<HistoryEntry[]> {
  return readJson(s, HISTORY_KEY, [], isHistory);
}

export async function addHistory(s: KeyValueStore, entry: HistoryEntry): Promise<HistoryEntry[]> {
  const list = (await loadHistory(s)).filter((e) => e.query !== entry.query);
  const next = [entry, ...list].slice(0, HISTORY_MAX);
  await s.set(HISTORY_KEY, JSON.stringify(next));
  return next;
}

export async function clearHistory(s: KeyValueStore): Promise<void> {
  await s.remove(HISTORY_KEY);
}

export async function loadRecentStations(s: KeyValueStore): Promise<string[]> {
  return readJson(s, RECENT_KEY, [], isStrings);
}

export async function addRecentStation(s: KeyValueStore, id: string): Promise<string[]> {
  const next = [id, ...(await loadRecentStations(s)).filter((x) => x !== id)].slice(0, RECENT_MAX);
  await s.set(RECENT_KEY, JSON.stringify(next));
  return next;
}
