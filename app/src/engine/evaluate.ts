import { bestArrival, shortestFromStation, type ShortestTree } from './dijkstra.ts';
import { compareCandidates, summarize } from './fairness.ts';
import type { CandidateResult, Evaluation, EvaluateOptions, ParticipantResult, PreparedGraph } from './types.ts';

export const MIN_PARTICIPANTS = 2;
export const MAX_PARTICIPANTS = 6;

export function candidateStations(g: PreparedGraph, mode: EvaluateOptions['candidates']): number[] {
  const all = g.raw.stations.map((_, i) => i);
  // 승하차 인원 데이터가 확보되기 전까지 '모이기 좋은 역' = 2개 이상 노선이 지나는 환승역(D-006)
  return mode === 'all' ? all : all.filter((i) => g.stationNodes[i].length >= 2);
}

export function evaluate(g: PreparedGraph, starts: number[], options: EvaluateOptions): Evaluation & { trees: ShortestTree[] } {
  if (starts.length < MIN_PARTICIPANTS || starts.length > MAX_PARTICIPANTS) throw new RangeError('participants');
  // 같은 역 출발자는 트리를 한 번만 계산
  const cache = new Map<number, ShortestTree>();
  const trees = starts.map((s) => {
    let t = cache.get(s);
    if (!t) cache.set(s, (t = shortestFromStation(g, s)));
    return t;
  });

  const results: CandidateResult[] = [];
  let excludedUnreachable = 0;
  for (const c of candidateStations(g, options.candidates)) {
    const per: ParticipantResult[] = [];
    let ok = true;
    for (const tree of trees) {
      const v = bestArrival(g, tree, c);
      if (v == null) { ok = false; break; }
      per.push({ sec: tree.dist[v], transfers: tree.transfers[v], estimated: tree.estimated[v] === 1 });
    }
    if (!ok) { excludedUnreachable++; continue; }
    results.push(summarize(c, per));
  }
  results.sort((a, b) => compareCandidates(a, b, options.preferFewerTransfers));
  return { results: results.slice(0, options.limit), excludedUnreachable, trees };
}
