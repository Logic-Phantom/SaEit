import { describe, expect, it } from 'vitest';
import { evaluate, fairnessScore, prepareGraph, routeTo, shortestFromStation, type Graph } from '../src/engine';
import graphJson from '../src/data/graph.v1.json';

/**
 * 손계산용 그래프
 *   A선: 가 —60— 나 —60— 다
 *   B선:         나 —60— 라 —60— 마
 *   나 환승 A↔B 120초
 *   C선(끊김): 섬1 —60— 섬2
 */
function tiny(withIsland = false): Graph {
  const stations = ['가', '나', '다', '라', '마', '섬1', '섬2'].map((name, i) => ({ id: `S${String(i + 1).padStart(4, '0')}`, name, aliases: [], lines: [], chosung: '' }));
  const nodes = [
    { stationIdx: 0, lineIdx: 0 }, // 0 가A
    { stationIdx: 1, lineIdx: 0 }, // 1 나A
    { stationIdx: 2, lineIdx: 0 }, // 2 다A
    { stationIdx: 1, lineIdx: 1 }, // 3 나B
    { stationIdx: 3, lineIdx: 1 }, // 4 라B
    { stationIdx: 4, lineIdx: 1 }, // 5 마B
    ...(withIsland ? [{ stationIdx: 5, lineIdx: 2 }, { stationIdx: 6, lineIdx: 2 }] : []),
  ];
  const both = (a: number, b: number, sec: number, kind: 'ride' | 'transfer' = 'ride', estimated = false) => [
    { from: a, to: b, sec, kind, estimated },
    { from: b, to: a, sec, kind, estimated },
  ];
  const edges = [...both(0, 1, 60), ...both(1, 2, 60), ...both(3, 4, 60), ...both(4, 5, 60, 'ride', true), ...both(1, 3, 120, 'transfer', true), ...(withIsland ? both(6, 7, 60) : [])];
  return {
    version: 1, builtAt: 'test', demo: true, sources: [],
    stations: withIsland ? stations : stations.slice(0, 5),
    lines: ['A', 'B', 'C'].map((id) => ({ id, name: id, short: id, operator: 't', color: '#000' })),
    nodes, edges,
  };
}

const opts = { candidates: 'all' as const, preferFewerTransfers: false, limit: 5 };

describe('다익스트라', () => {
  it('환승 비용을 포함한 최단 시간', () => {
    const g = prepareGraph(tiny());
    const t = shortestFromStation(g, 0);
    expect(t.dist[5]).toBe(60 + 120 + 60 + 60); // 가→나(A)→환승→라→마
    expect(t.transfers[5]).toBe(1);
    expect(t.estimated[5]).toBe(1);
    expect(t.estimated[2]).toBe(0);
  });
});

describe('후보 평가', () => {
  it('최대 소요시간이 가장 짧은 역이 1순위', () => {
    const g = prepareGraph(tiny());
    const { results } = evaluate(g, [0, 4], opts); // 가, 마
    expect(results[0].stationIdx).toBe(1); // 나: 가 60, 마 120
    expect(results[0].maxSec).toBe(120);
    expect(results[0].per.map((p) => p.transfers)).toEqual([0, 0]);
    expect(results[0].fairness).toBe(50);
  });

  it('같은 역 출발자 다수, 출발역 자체 0분 허용', () => {
    const g = prepareGraph(tiny());
    const { results } = evaluate(g, [1, 1, 1], opts);
    expect(results[0].stationIdx).toBe(1);
    expect(results[0].maxSec).toBe(0);
    expect(results[0].fairness).toBe(100);
  });

  it('최대 시간이 같으면 편차가 작은 역 → 환승 우선 옵션이면 환승 적은 역', () => {
    const g = prepareGraph(tiny());
    // 다(2)·라(4) 출발: 나 = 60/180(환승1)... 직접 확인
    const base = evaluate(g, [2, 4], { ...opts, limit: 10 }).results;
    const sorted = [...base].sort((a, b) => a.maxSec - b.maxSec);
    expect(base[0].maxSec).toBe(sorted[0].maxSec);
    const pref = evaluate(g, [2, 4], { ...opts, preferFewerTransfers: true, limit: 10 }).results;
    expect(pref[0].maxSec).toBe(base[0].maxSec);
    for (let i = 1; i < pref.length; i++) {
      if (pref[i].maxSec === pref[i - 1].maxSec) expect(pref[i].totalTransfers).toBeGreaterThanOrEqual(pref[i - 1].totalTransfers);
    }
  });

  it('이어지지 않은 역은 후보에서 제외하고 개수를 알려 준다', () => {
    const g = prepareGraph(tiny(true));
    const r = evaluate(g, [0, 4], opts);
    expect(r.excludedUnreachable).toBe(2);
    expect(r.results.every((c) => c.stationIdx < 5)).toBe(true);
  });

  it('6명까지 허용, 1명·7명은 거부', () => {
    const g = prepareGraph(tiny());
    expect(() => evaluate(g, [0], opts)).toThrow();
    expect(() => evaluate(g, [0, 1, 2, 3, 4, 0, 1], opts)).toThrow();
    expect(evaluate(g, [0, 1, 2, 3, 4, 0], opts).results.length).toBeGreaterThan(0);
  });

  it('hubs 모드는 환승역만 후보', () => {
    const g = prepareGraph(tiny());
    const r = evaluate(g, [0, 4], { ...opts, candidates: 'hubs' });
    expect(r.results.map((c) => c.stationIdx)).toEqual([1]);
  });
});

describe('경로 복원', () => {
  it('노선별 구간과 환승으로 묶는다', () => {
    const g = prepareGraph(tiny());
    const route = routeTo(g, shortestFromStation(g, 0), 3)!; // 가 → 라
    expect(route.steps.map((s) => s.kind)).toEqual(['ride', 'transfer', 'ride']);
    expect(route.steps[0]).toMatchObject({ kind: 'ride', lineIdx: 0, fromStation: 0, toStation: 1, stops: 1, sec: 60 });
    expect(route.steps[2]).toMatchObject({ kind: 'ride', lineIdx: 1, fromStation: 1, toStation: 3, stops: 1 });
    expect(route.sec).toBe(240);
  });

  it('출발역 = 도착역이면 단계 없음', () => {
    const g = prepareGraph(tiny());
    expect(routeTo(g, shortestFromStation(g, 2), 2)!.steps).toEqual([]);
  });
});

describe('공평 점수', () => {
  it('min/max 비율', () => {
    expect(fairnessScore(0, 0)).toBe(100);
    expect(fairnessScore(600, 1200)).toBe(50);
  });
});

describe('번들 그래프(데모)', () => {
  it('6명 × 전체 역 계산이 빠르다', () => {
    const g = prepareGraph(graphJson as Graph);
    const starts = [0, 10, 20, 30, 40, 50];
    const t0 = performance.now();
    const r = evaluate(g, starts, { candidates: 'all', preferFewerTransfers: false, limit: 5 });
    const ms = performance.now() - t0;
    expect(r.results.length).toBe(5);
    expect(r.excludedUnreachable).toBe(0);
    expect(ms).toBeLessThan(200);
  });
});
