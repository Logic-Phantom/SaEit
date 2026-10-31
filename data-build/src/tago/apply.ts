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
import { hopsFrom, minTravelSec, pairTime } from './times.ts';

/** `노선ID|출발|도착` → 시간(초)·표본 수 */
export type PairTimes = Record<string, { sec: number; samples: number }>;
export interface DerivedTago {
  fetchedAt: string;
  dailyTypeCode: string;
  method: string;
  pairs: PairTimes;
  /** 공식 운행시간 구간에 더할 정차 시간(측정값). 원본 시간표가 없는 곳에서도 같은 값을 쓰도록 저장 */
  officialDwell?: DwellMeasure | null;
}

export const pairKey = (lineId: string, from: string, to: string) => `${lineId}|${from}|${to}`;

export function deriveTagoPairs(sections: RawSection[], tagoDir: string): { derived: DerivedTago; tried: number } | null {
  const indexPath = join(tagoDir, 'index.json');
  if (!existsSync(indexPath)) return null;
  const index = JSON.parse(readFileSync(indexPath, 'utf8')) as TagoIndex;
  const cache = new Map<string, TagoSchedule[] | null>();
  const schedule = (lineId: string, name: string, dir: 'U' | 'D'): TagoSchedule[] | null => {
    const id = index.stations[`${lineId}|${name}`];
    if (!id) return null;
    const file = join(tagoDir, 'schedules', `${id}_${dir}_01.json`);
    if (!cache.has(file)) cache.set(file, existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as TagoSchedule[]) : null);
    return cache.get(file)!;
  };

  // 종점 ID → 우리 역 이름(종점 이름이 빈 행용). 같은 노선 안의 ID만 쓴다
  const idToName = new Map<string, string>();
  for (const [k, id] of Object.entries(index.stations)) idToName.set(`${k.split('|')[0]}|${id}`, k.slice(k.indexOf('|') + 1));
  // 노선별 인접 목록(종점까지 남은 역 수로 방향 판단)
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
    /** 이 종점으로 가는 열차가 A → B 순서로 지나가는지. 종점을 그래프에서 못 찾으면 undefined */
    const towardB = (r: TagoSchedule): boolean | undefined => {
      const byName = r.endSubwayStationNm ? normalizeName(r.endSubwayStationNm, s.lineId) : undefined;
      const end = byName && lineAdj.has(byName) ? byName : idToName.get(`${s.lineId}|${r.endSubwayStationId}`);
      if (!end || !lineAdj.has(end)) return undefined;
      const h = hops(s.lineId, end);
      const ha = h.get(s.from);
      const hb = h.get(s.to);
      return ha != null && hb != null && ha !== hb ? hb < ha : undefined;
    };
    const minSec = minTravelSec(s.km);
    const groups: { sec: number; samples: number }[] = [];
    let any = false;
    for (const dir of ['U', 'D'] as const) {
      const a = schedule(s.lineId, s.from, dir);
      const b = schedule(s.lineId, s.to, dir);
      if (!a || !b) continue;
      any = true;
      // 방향 판단(D-041): 같은 종점 열차 묶음마다 종점 위치로 방향을 정하고, 방향 코드 안에서 표본 수 가중 다수 방향과 같은 묶음만 쓴다.
      //  - 1호선 상행 코드의 '제물포' 묶음처럼 종점이 실제 진행과 안 맞는 묶음을 버린다.
      //  - 신림선처럼 한 코드에 양방향이 섞이면 소수 방향 묶음을 버린다(남은 묶음만으로도 값은 같다).
      //  - 종점을 하나도 못 찾을 때만 두 방향 중 짧은 쪽(배차의 절반보다 긴 구간에서는 틀릴 수 있어 마지막 수단).
      const ends = new Set([...a, ...b].map((r) => r.endSubwayStationId));
      const byEnd = [...ends].map((e) => {
        const aE = a.filter((r) => r.endSubwayStationId === e);
        const bE = b.filter((r) => r.endSubwayStationId === e);
        const rep = aE[0] ?? bE[0];
        return { aE, bE, toward: towardB(rep), n: aE.length + bE.length };
      });
      const vote = byEnd.reduce((t, g) => t + (g.toward == null ? 0 : (g.toward ? g.n : -g.n)), 0);
      if (vote !== 0) {
        for (const g of byEnd) {
          if (g.toward == null || g.toward !== vote > 0) continue;
          const r = g.toward ? pairTime(g.aE, g.bE, () => true, minSec) : pairTime(g.bE, g.aE, () => true, minSec);
          if (r) groups.push(r);
        }
      } else {
        for (const g of byEnd) {
          const cands = [pairTime(g.aE, g.bE, () => true, minSec), pairTime(g.bE, g.aE, () => true, minSec)].filter((r): r is NonNullable<typeof r> => r != null);
          if (cands.length) groups.push(cands.reduce((x, y) => (y.sec < x.sec ? y : x)));
        }
      }
    }
    if (any) tried++;
    if (!groups.length) continue;
    const samples = groups.reduce((t, g) => t + g.samples, 0);
    pairs[pairKey(s.lineId, s.from, s.to)] = { sec: Math.round(groups.reduce((t, g) => t + g.sec * g.samples, 0) / samples), samples };
  }
  return {
    derived: { fetchedAt: index.fetchedAt, dailyTypeCode: index.dailyTypeCode, method: '같은 방향 코드·같은 종점 열차 묶음별 A역 출발→B역 출발 차의 중앙값(종점 위치로 방향 판단·코드 내 다수 방향 묶음만), 평일 07~22시, 묶음 표본 수 가중 평균(D-035, D-041)', pairs },
    tried,
  };
}

/** 정차 시간 측정 결과(D-043): 시간표 산출(출발→출발) − 공식 운행시간(출발→도착). 노선별 + 전체 */
export interface DwellStat { sec: number; samples: number; p10: number; p90: number }
export interface DwellMeasure extends DwellStat { byLine: Record<string, DwellStat>; /** 흩어짐이 커서 전체 값으로 대체한 노선(기록용) */ unstable?: Record<string, DwellStat>; method: string }

/** 노선별 값을 쓰려면 겹치는 구간이 이만큼은 있어야 한다. 모자라면 전체 중앙값 */
export const DWELL_MIN_LINE_SAMPLES = 10;
/** 노선별 값의 흩어짐(p90 − p10)이 이보다 크면 그 노선 시간표 산출이 불안정하다고 보고 전체 중앙값을 쓴다.
 *  2026-10-31: 2호선은 순환선이라 방향 판단이 흔들리고 값이 30·59·88초로 뭉쳐 p10 15·p90 88(폭 73초) — 다른 노선은 폭 10~30초 */
export const DWELL_MAX_LINE_SPREAD = 45;

const stat = (xs: number[]): DwellStat => {
  const d = [...xs].sort((a, b) => a - b);
  const q = (f: number) => d[Math.min(d.length - 1, Math.floor(f * d.length))];
  return { sec: q(0.5), samples: d.length, p10: q(0.1), p90: q(0.9) };
};

/**
 * 공식 운행시간 구간(OA-12034)에 빠진 정차 시간을 데이터로 잰다.
 * 같은 구간을 시간표로도 산출해(공식값 구간을 '추정'으로 표시해 deriveTagoPairs에 넣음) 차이의 **중앙값**을 정차 시간으로 쓴다.
 * 회차역 대기 같은 큰 값에 흔들리지 않도록 평균이 아니라 중앙값. 전체 겹치는 구간이 20개 미만이면 null.
 */
export function measureDwell(official: RawSection[], all: RawSection[], tagoDir: string): DwellMeasure | null {
  const officialKeys = new Set(official.map((s) => pairKey(s.lineId, s.from, s.to)));
  const probe = all.map((s) => ({ ...s, estimated: officialKeys.has(pairKey(s.lineId, s.from, s.to)) }));
  const d = deriveTagoPairs(probe, tagoDir);
  if (!d) return null;
  const byLineDiffs = new Map<string, number[]>();
  for (const s of official) {
    const p = d.derived.pairs[pairKey(s.lineId, s.from, s.to)];
    if (!p || s.sec == null) continue;
    byLineDiffs.set(s.lineId, [...(byLineDiffs.get(s.lineId) ?? []), p.sec - s.sec]);
  }
  const allDiffs = [...byLineDiffs.values()].flat();
  if (allDiffs.length < 20) return null;
  const byLine: Record<string, DwellStat> = {};
  const unstable: Record<string, DwellStat> = {};
  for (const [line, xs] of [...byLineDiffs].sort()) {
    if (xs.length < DWELL_MIN_LINE_SAMPLES) continue;
    const st = stat(xs);
    if (st.p90 - st.p10 > DWELL_MAX_LINE_SPREAD) unstable[line] = st;
    else byLine[line] = st;
  }
  return { ...stat(allDiffs), byLine, unstable, method: `같은 구간 시간표 산출값 − 공식 운행시간의 중앙값. 노선별 표본 ${DWELL_MIN_LINE_SAMPLES}개 이상·흩어짐 ${DWELL_MAX_LINE_SPREAD}초 이하면 노선 값, 아니면 전체 값(D-043)` };
}

/** 노선에 더할 정차 시간 */
export function dwellFor(m: DwellMeasure | null | undefined, lineId: string): number {
  if (!m) return 0;
  return m.byLine?.[lineId]?.sec ?? m.sec;
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
