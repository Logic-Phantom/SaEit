// 결과 화면 공통: URL 쿼리 → 검증된 payload → 계산. 잘못된 쿼리는 null(호출 측에서 조용히 홈으로).
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { graph, validStationIds } from '../../data/graph';
import { evaluate, routeTo, type CandidateResult, type RoutePath, type ShortestTree } from '../../engine';
import { decodePayload, encodePayload, type SharePayload } from '../share/codec';

export const RESULT_LIMIT = 5;

export interface ResultState {
  payload: SharePayload;
  query: string;
  starts: number[];
  results: CandidateResult[];
  excludedUnreachable: number;
  trees: ShortestTree[];
  /** ?c= 로 고른 후보(없으면 1순위) */
  selected: CandidateResult | null;
  route: (participant: number, candidate: CandidateResult) => RoutePath | null;
}

export function useResult(): ResultState | null {
  const [params] = useSearchParams();
  const raw = params.toString();
  const c = params.get('c');
  return useMemo(() => {
    const payload = decodePayload(params, validStationIds);
    if (!payload) return null;
    const starts = payload.s.map((id) => graph.stationById.get(id)!);
    const ev = evaluate(graph, starts, { candidates: payload.m === 'all' ? 'all' : 'hubs', preferFewerTransfers: !!payload.t, limit: RESULT_LIMIT });
    const selectedIdx = c ? graph.stationById.get(c) : undefined;
    const selected = (selectedIdx != null ? ev.results.find((r) => r.stationIdx === selectedIdx) : ev.results[0]) ?? null;
    return {
      payload,
      query: encodePayload(payload),
      starts,
      results: ev.results,
      excludedUnreachable: ev.excludedUnreachable,
      trees: ev.trees,
      selected,
      route: (p, cand) => routeTo(graph, ev.trees[p], cand.stationIdx),
    };
  }, [raw]);
}

export function withCandidate(query: string, stationIdx: number, extra = ''): string {
  return `${query}&c=${graph.raw.stations[stationIdx].id}${extra}`;
}
