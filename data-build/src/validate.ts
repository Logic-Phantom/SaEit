// 그래프 검증: 연결 요소 1개, 0초 이하·비정상 긴 간선, 중복 간선, 환승 누락. 문제 목록을 돌려주고 build-graph가 실패 처리한다.
import type { Graph } from './types.ts';

const MAX_RIDE_SEC = 20 * 60; // 인접역 20분 초과는 데이터 오류로 본다(급행·장거리 구간이 생기면 노선별로 조정)

export interface ValidationResult { errors: string[]; warnings: string[]; components: number; }

export function validateGraph(g: Graph): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const seen = new Set<string>();
  for (const e of g.edges) {
    const key = `${e.from}>${e.to}`;
    if (seen.has(key)) errors.push(`중복 간선 ${key}`);
    seen.add(key);
    if (!(e.sec > 0)) errors.push(`0초 이하 간선 ${key} (${e.sec})`);
    if (e.kind === 'ride' && e.sec > MAX_RIDE_SEC) warnings.push(`긴 주행 간선 ${key} (${e.sec}초)`);
  }

  // 같은 역 여러 노선인데 환승 간선이 빠진 경우
  const byStation = new Map<number, number[]>();
  g.nodes.forEach((n, i) => byStation.set(n.stationIdx, [...(byStation.get(n.stationIdx) ?? []), i]));
  for (const [st, nodes] of byStation) {
    if (nodes.length < 2) continue;
    for (const a of nodes) for (const b of nodes) if (a !== b && !seen.has(`${a}>${b}`)) errors.push(`환승 누락 ${g.stations[st].name} ${a}>${b}`);
  }

  // 연결 요소 수(무방향으로 BFS)
  const adj: number[][] = g.nodes.map(() => []);
  for (const e of g.edges) {
    adj[e.from].push(e.to);
    adj[e.to].push(e.from);
  }
  const comp = new Array<number>(g.nodes.length).fill(-1);
  let components = 0;
  for (let s = 0; s < g.nodes.length; s++) {
    if (comp[s] >= 0) continue;
    const q = [s];
    comp[s] = components;
    while (q.length) {
      const v = q.pop()!;
      for (const w of adj[v]) if (comp[w] < 0) { comp[w] = components; q.push(w); }
    }
    components++;
  }
  if (components !== 1) errors.push(`연결 요소 ${components}개 (1개여야 함)`);

  return { errors, warnings, components };
}
