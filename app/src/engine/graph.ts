import type { Graph, PreparedGraph } from './types.ts';

export function prepareGraph(raw: Graph): PreparedGraph {
  const adj: PreparedGraph['adj'] = raw.nodes.map(() => []);
  for (const e of raw.edges) adj[e.from].push({ to: e.to, sec: e.sec, transfer: e.kind === 'transfer', estimated: e.estimated });
  const stationNodes: number[][] = raw.stations.map(() => []);
  raw.nodes.forEach((n, i) => stationNodes[n.stationIdx].push(i));
  const stationById = new Map(raw.stations.map((s, i) => [s.id, i]));
  return { raw, adj, stationNodes, stationById };
}
