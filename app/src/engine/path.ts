// 최단 트리에서 한 사람의 경로를 복원해 '노선별 주행 구간 + 환승' 단계로 묶는다.
import { bestArrival, type ShortestTree } from './dijkstra.ts';
import type { PathStep, PreparedGraph, RoutePath } from './types.ts';

export function routeTo(g: PreparedGraph, tree: ShortestTree, targetStation: number): RoutePath | null {
  const end = bestArrival(g, tree, targetStation);
  if (end == null) return null;
  const chain: number[] = [];
  for (let v = end; v !== -1; v = tree.prev[v]) chain.push(v);
  chain.reverse();

  const steps: PathStep[] = [];
  const nodes = g.raw.nodes;
  for (let i = 0; i + 1 < chain.length; i++) {
    const a = chain[i];
    const b = chain[i + 1];
    const edge = g.adj[a].find((e) => e.to === b)!;
    if (edge.transfer) {
      steps.push({ kind: 'transfer', station: nodes[a].stationIdx, fromLine: nodes[a].lineIdx, toLine: nodes[b].lineIdx, sec: edge.sec, estimated: edge.estimated });
      continue;
    }
    const last = steps[steps.length - 1];
    if (last?.kind === 'ride' && last.lineIdx === nodes[a].lineIdx) {
      last.toStation = nodes[b].stationIdx;
      last.stops += 1;
      last.sec += edge.sec;
      last.estimated ||= edge.estimated;
    } else {
      steps.push({ kind: 'ride', lineIdx: nodes[a].lineIdx, fromStation: nodes[a].stationIdx, toStation: nodes[b].stationIdx, stops: 1, sec: edge.sec, estimated: edge.estimated });
    }
  }
  return { sec: tree.dist[end], transfers: tree.transfers[end], estimated: tree.estimated[end] === 1, steps };
}
