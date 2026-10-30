import { readFileSync } from 'node:fs';
import { prepareGraph, routeTo, shortestFromStation, type Graph } from '../app/src/engine/index.ts';
const raw = JSON.parse(readFileSync('../app/src/data/graph.v1.json', 'utf8')) as Graph;
const g = prepareGraph(raw);
const idx = new Map(raw.stations.map((s, i) => [s.name, i]));
const L = (i: number) => raw.lines[i].short;
const S = (i: number) => raw.stations[i].name;
// 특정 노선만 타는 경로 시간(직통 비교용): 해당 노선 노드 사이 다익스트라(환승 금지)
function lineOnly(from: string, to: string, lineId: string) {
  const li = raw.lines.findIndex((l) => l.id === lineId);
  const node = (st: string) => raw.nodes.findIndex((n) => n.stationIdx === idx.get(st) && n.lineIdx === li);
  const a = node(from), b = node(to);
  if (a < 0 || b < 0) return 'no node';
  const dist = new Map([[a, 0]]); const q = [a]; const est = new Map([[a, false]]);
  while (q.length) { q.sort((x, y) => dist.get(x)! - dist.get(y)!); const v = q.shift()!;
    for (const e of g.adj[v]) { if (e.transfer) continue; const nd = dist.get(v)! + e.sec; if (nd < (dist.get(e.to) ?? Infinity)) { dist.set(e.to, nd); est.set(e.to, est.get(v)! || e.estimated); q.push(e.to); } } }
  const d = dist.get(b); return d == null ? 'unreachable' : `${(d / 60).toFixed(1)}분${est.get(b) ? '(추정 포함)' : ''}`;
}
const cases: [number, string, string, string[]][] = [
  [7, '김포공항', '종로3가', ['L5']], [10, '수원', '서울역', ['L1']], [13, '청량리', '용산', ['L1', 'GJ']], [17, '상봉', '잠실', ['L7']], [19, '개화', '종합운동장', ['L9']],
];
for (const [no, a, b, direct] of cases) {
  const r = routeTo(g, shortestFromStation(g, idx.get(a)!), idx.get(b)!)!;
  const steps = r.steps.map((s) => s.kind === 'ride' ? `${L(s.lineIdx)}[${S(s.fromStation)}→${S(s.toStation)} ${s.stops}역 ${(s.sec / 60).toFixed(1)}분${s.estimated ? '*' : ''}]` : `환승(${S(s.station)} ${L(s.fromLine)}→${L(s.toLine)} ${(s.sec / 60).toFixed(1)}분${s.estimated ? '*' : ''})`).join(' ');
  console.log(`#${no} ${a}→${b}: 엔진 ${(r.sec / 60).toFixed(1)}분 환승${r.transfers}  ${steps}`);
  for (const d of direct) console.log(`     ${d} 직통만: ${lineOnly(a, b, d)}`);
  console.log(`     ${a} 노선: ${raw.stations[idx.get(a)!].lines.join(',')} / ${b} 노선: ${raw.stations[idx.get(b)!].lines.join(',')}`);
}
