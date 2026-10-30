// TAGO 시간표 → 인접 역 사이 시간 → 그래프 구간에 반영. 두 단계로 나눈다:
//  1) deriveTagoPairs: raw/tago/(git 제외, 수십 MB)의 시간표에서 구간별 시간을 뽑는다
//  2) applyPairs: 뽑은 결과(data-build/derived/tago-pair-times.json, git 포함·작음)를 추정 구간에 넣는다
// 그래서 서비스 키·원본 시간표가 없는 곳(CI, 다른 PC)에서도 같은 그래프를 다시 만들 수 있다(D-037).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeName } from '../normalize-station.ts';
import type { RawSection } from '../types.ts';
import type { TagoSchedule } from './api.ts';
import type { TagoIndex } from './fetch.ts';
import { hopsFrom, pairTime } from './times.ts';

/** `노선ID|출발|도착` → 시간(초)·표본 수 */
export type PairTimes = Record<string, { sec: number; samples: number }>;
export interface DerivedTago { fetchedAt: string; dailyTypeCode: string; method: string; pairs: PairTimes }

export const pairKey = (lineId: string, from: string, to: string) => `${lineId}|${from}|${to}`;

export function deriveTagoPairs(sections: RawSection[], tagoDir: string): { derived: DerivedTago; tried: number } | null {
  const indexPath = join(tagoDir, 'index.json');
  if (!existsSync(indexPath)) return null;
  const index = JSON.parse(readFileSync(indexPath, 'utf8')) as TagoIndex;
  // 종점 ID → 우리 역 이름(이름이 비어 있는 행용). 같은 노선 안의 ID만 쓴다
  const idToName = new Map<string, string>();
  for (const [k, id] of Object.entries(index.stations)) idToName.set(`${k.split('|')[0]}|${id}`, k.slice(k.indexOf('|') + 1));
  const cache = new Map<string, TagoSchedule[] | null>();
  const schedule = (lineId: string, name: string, dir: 'U' | 'D'): TagoSchedule[] | null => {
    const id = index.stations[`${lineId}|${name}`];
    if (!id) return null;
    const file = join(tagoDir, 'schedules', `${id}_${dir}_01.json`);
    if (!cache.has(file)) cache.set(file, existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as TagoSchedule[]) : null);
    return cache.get(file)!;
  };

  // 노선별 인접 목록(방향 판단용)
  const adj = new Map<string, Map<string, string[]>>();
  for (const s of sections) {
    const m = adj.get(s.lineId) ?? new Map<string, string[]>();
    m.set(s.from, [...(m.get(s.from) ?? []), s.to]);
    m.set(s.to, [...(m.get(s.to) ?? []), s.from]);
    adj.set(s.lineId, m);
  }
  const hopsCache = new Map<string, Map<string, number>>();
  const hops = (lineId: string, end: string) => {
    const k = `${lineId}|${end}`;
    if (!hopsCache.has(k)) hopsCache.set(k, hopsFrom(adj.get(lineId)!, end));
    return hopsCache.get(k)!;
  };

  const pairs: PairTimes = {};
  let tried = 0;
  for (const s of sections) {
    if (!s.estimated) continue;
    const lineAdj = adj.get(s.lineId)!;
    const secs: number[] = [];
    let samples = 0;
    let any = false;
    for (const dir of ['U', 'D'] as const) {
      const a = schedule(s.lineId, s.from, dir);
      const b = schedule(s.lineId, s.to, dir);
      if (!a || !b) continue;
      any = true;
      const towardB = (row: TagoSchedule) => {
        const end = row.endSubwayStationNm ? normalizeName(row.endSubwayStationNm, s.lineId) : idToName.get(`${s.lineId}|${row.endSubwayStationId}`);
        if (!end || !lineAdj.has(end)) return undefined;
        const h = hops(s.lineId, end);
        const ha = h.get(s.from);
        const hb = h.get(s.to);
        return ha != null && hb != null ? hb < ha : undefined;
      };
      // 한 방향 코드(U/D)는 이 구간에서 한쪽으로만 달린다. 어느 쪽인지는 종점 기준 다수결로 정한다(D-039).
      // 행마다 종점으로 판단하면, 종점이 방향과 맞지 않는 행(예: 상행인데 종점 '제물포')이 반대로 짝지어져 큰 값이 나온다.
      let votes = 0;
      for (const r of [...a, ...b]) { const v = towardB(r); if (v != null) votes += v ? 1 : -1; }
      if (votes === 0) continue;
      const r = votes > 0 ? pairTime(a, b, () => true) : pairTime(b, a, () => true);
      if (r) { secs.push(r.sec); samples += r.samples; }
    }
    if (any) tried++;
    if (secs.length) pairs[pairKey(s.lineId, s.from, s.to)] = { sec: Math.round(secs.reduce((x, y) => x + y, 0) / secs.length), samples };
  }
  return {
    derived: { fetchedAt: index.fetchedAt, dailyTypeCode: index.dailyTypeCode, method: '같은 방향·같은 종점 열차의 A역 출발→B역 출발 차, 평일 07~22시 중앙값(D-035)', pairs },
    tried,
  };
}

export function applyPairs(sections: RawSection[], pairs: PairTimes): { sections: RawSection[]; filled: number } {
  let filled = 0;
  const out = sections.map((s) => {
    if (!s.estimated) return s;
    const p = pairs[pairKey(s.lineId, s.from, s.to)];
    if (!p) return s;
    filled++;
    return { ...s, sec: p.sec, estimated: false };
  });
  return { sections: out, filled };
}

/** 원본 시간표에서 바로 반영(테스트·로컬 확인용) */
export function applyTagoTimes(sections: RawSection[], tagoDir: string): { sections: RawSection[]; filled: number; tried: number; fetchedAt: string | null } {
  const d = deriveTagoPairs(sections, tagoDir);
  if (!d) return { sections, filled: 0, tried: 0, fetchedAt: null };
  const r = applyPairs(sections, d.derived.pairs);
  return { ...r, tried: d.tried, fetchedAt: d.derived.fetchedAt };
}
