// 출발역의 모든 노선 노드에서 0초로 시작하는 다익스트라. 같은 시간이면 환승이 적은 경로를 고른다.
import type { PreparedGraph } from './types';

export interface ShortestTree {
  dist: Float64Array;
  transfers: Int32Array;
  estimated: Uint8Array;
  prev: Int32Array;
}

/** (시간, 환승 수) 사전순 비교용 최소 힙 */
class Heap {
  private items: [number, number, number][] = []; // [sec, transfers, node]
  get size() { return this.items.length; }
  push(x: [number, number, number]) {
    const a = this.items;
    a.push(x);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!less(a[i], a[p])) break;
      [a[i], a[p]] = [a[p], a[i]];
      i = p;
    }
  }
  pop(): [number, number, number] {
    const a = this.items;
    const top = a[0];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && less(a[l], a[m])) m = l;
        if (r < a.length && less(a[r], a[m])) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]];
        i = m;
      }
    }
    return top;
  }
}

function less(a: [number, number, number], b: [number, number, number]): boolean {
  return a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);
}

export function shortestFromStation(g: PreparedGraph, stationIdx: number): ShortestTree {
  const n = g.adj.length;
  const dist = new Float64Array(n).fill(Infinity);
  const transfers = new Int32Array(n).fill(0x7fffffff);
  const estimated = new Uint8Array(n);
  const prev = new Int32Array(n).fill(-1);
  const heap = new Heap();
  for (const s of g.stationNodes[stationIdx]) {
    dist[s] = 0;
    transfers[s] = 0;
    heap.push([0, 0, s]);
  }
  while (heap.size) {
    const [d, t, v] = heap.pop();
    if (d > dist[v] || (d === dist[v] && t > transfers[v])) continue;
    for (const e of g.adj[v]) {
      const nd = d + e.sec;
      const nt = t + (e.transfer ? 1 : 0);
      if (nd < dist[e.to] || (nd === dist[e.to] && nt < transfers[e.to])) {
        dist[e.to] = nd;
        transfers[e.to] = nt;
        estimated[e.to] = estimated[v] | (e.estimated ? 1 : 0);
        prev[e.to] = v;
        heap.push([nd, nt, e.to]);
      }
    }
  }
  return { dist, transfers, estimated, prev };
}

/** 역에 도착하는 가장 좋은 노드(시간 → 환승 순). 도달 불가면 null. */
export function bestArrival(g: PreparedGraph, tree: ShortestTree, stationIdx: number): number | null {
  let best: number | null = null;
  for (const v of g.stationNodes[stationIdx]) {
    if (!Number.isFinite(tree.dist[v])) continue;
    if (best == null || tree.dist[v] < tree.dist[best] || (tree.dist[v] === tree.dist[best] && tree.transfers[v] < tree.transfers[best])) best = v;
  }
  return best;
}
