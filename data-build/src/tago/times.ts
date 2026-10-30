// 시간표 → 인접 역 사이 소요시간.
// 열차 번호가 없으므로: 방향(U/D)과 종점(endSubwayStationId — 이름은 약 5% 행에서 비어 있음)이 같은 열차를 A역 출발 → B역 출발로 짝짓는다(A 다음 가장 이른 B, 30분 이내).
// A→B가 그 열차의 진행 방향인지는 노선 그래프에서 '종점까지 남은 역 수'로 판단한다(B가 종점에 더 가까우면 A → B).
// 출발-출발 차이라 B역 정차 시간이 포함된다. 낮 시간(07~22시) 평일 열차의 **중앙값**을 쓴다(급행 섞임에 강하게).
import { hmsToSec, type TagoSchedule } from './api.ts';

export const DAY_FROM = 7 * 3600;
export const DAY_TO = 22 * 3600;
export const MATCH_WINDOW_SEC = 30 * 60;
export const MIN_SAMPLES = 5;

export interface PairTime { sec: number; samples: number }

/** 노선 안에서 각 역까지 몇 정거장인지(BFS) */
export function hopsFrom(adj: Map<string, string[]>, start: string): Map<string, number> {
  const d = new Map([[start, 0]]);
  const q = [start];
  while (q.length) {
    const v = q.shift()!;
    for (const w of adj.get(v) ?? []) if (!d.has(w)) { d.set(w, d.get(v)! + 1); q.push(w); }
  }
  return d;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

/**
 * @param a A역 시간표(한 방향), @param b B역 시간표(같은 방향)
 * @param towardB 시간표 행 → 그 행의 종점으로 가는 열차가 A → B 순서로 지나가는지(그래프에서 판단). 모르는 종점은 undefined.
 */
export function pairTime(a: TagoSchedule[], b: TagoSchedule[], towardB: (row: TagoSchedule) => boolean | undefined): PairTime | null {
  const bByEnd = new Map<string, number[]>();
  for (const x of b) {
    const t = hmsToSec(x.depTime) ?? hmsToSec(x.arrTime);
    if (t == null) continue;
    bByEnd.set(x.endSubwayStationId, [...(bByEnd.get(x.endSubwayStationId) ?? []), t]);
  }
  for (const list of bByEnd.values()) list.sort((p, q) => p - q);
  const diffs: number[] = [];
  for (const x of a) {
    if (towardB(x) !== true) continue;
    const t = hmsToSec(x.depTime);
    if (t == null || t < DAY_FROM || t > DAY_TO) continue;
    const list = bByEnd.get(x.endSubwayStationId);
    const next = list?.find((tb) => tb > t);
    if (next != null && next - t <= MATCH_WINDOW_SEC) diffs.push(next - t);
  }
  if (diffs.length < MIN_SAMPLES) return null;
  return { sec: median(diffs), samples: diffs.length };
}
