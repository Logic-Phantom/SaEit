import type { CandidateResult, ParticipantResult } from './types.ts';

export function summarize(stationIdx: number, per: ParticipantResult[]): CandidateResult {
  const secs = per.map((p) => p.sec);
  const maxSec = Math.max(...secs);
  const minSec = Math.min(...secs);
  const sumSec = secs.reduce((a, b) => a + b, 0);
  const avgSec = sumSec / secs.length;
  const stdevSec = Math.sqrt(secs.reduce((a, s) => a + (s - avgSec) ** 2, 0) / secs.length);
  return {
    stationIdx,
    per,
    maxSec,
    minSec,
    avgSec,
    stdevSec,
    sumSec,
    totalTransfers: per.reduce((a, p) => a + p.transfers, 0),
    fairness: fairnessScore(minSec, maxSec),
    estimated: per.some((p) => p.estimated),
  };
}

/** 100 × min/max. 모두 0초(같은 역)면 100. */
export function fairnessScore(minSec: number, maxSec: number): number {
  if (maxSec <= 0) return 100;
  return Math.round((100 * minSec) / maxSec);
}

/** 정렬 키: ① 최대 시간 → ② 편차 → ③ 환승 합 → ④ 시간 합 (환승 우선이면 ②③ 순서를 바꾼다). 마지막은 역 순서로 고정. */
export function compareCandidates(a: CandidateResult, b: CandidateResult, preferFewerTransfers: boolean): number {
  const keys = preferFewerTransfers
    ? [a.maxSec - b.maxSec, a.totalTransfers - b.totalTransfers, a.stdevSec - b.stdevSec, a.sumSec - b.sumSec]
    : [a.maxSec - b.maxSec, a.stdevSec - b.stdevSec, a.totalTransfers - b.totalTransfers, a.sumSec - b.sumSec];
  for (const k of keys) if (Math.abs(k) > 1e-9) return k;
  return a.stationIdx - b.stationIdx;
}
