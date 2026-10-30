import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assess, checkRow, readUserValues, render, type Row } from '../src/accuracy.ts';

const row = (mapMin: string, mapTr: string, engMin = 20, estimated = false, engTr = 0): Row =>
  ({ from: 'A', to: 'B', note: '', mapMin, mapTr, engMin, engTr, estimated, path: '', direct: '' });

test('입력 검증: 미입력·한 칸만·숫자 아님·범위 밖', () => {
  assert.deepEqual(checkRow(row('', '')), { state: 'empty' });
  assert.equal(checkRow(row('25', '')).state, 'invalid');
  assert.equal(checkRow(row('', '1')).state, 'invalid');
  assert.equal(checkRow(row('약 25', '0')).state, 'invalid');
  assert.equal(checkRow(row('-3', '0')).state, 'invalid');
  assert.equal(checkRow(row('0', '0')).state, 'invalid');
  assert.equal(checkRow(row('999', '0')).state, 'invalid');
  assert.equal(checkRow(row('25', '1.5')).state, 'invalid');
  assert.deepEqual(checkRow(row('25', '1', 20)), { state: 'ok', min: 25, tr: 1, absErr: 5 });
  assert.deepEqual(checkRow(row('15', '0', 20)), { state: 'ok', min: 15, tr: 0, absErr: 5 }); // 절대값
});

test('판정: 20개 모두 올바르게 입력돼야 통과/미통과, 아니면 입력 대기', () => {
  const empty = Array.from({ length: 20 }, () => row('', ''));
  assert.equal(assess(empty).verdict, '입력 대기');
  assert.equal(assess(empty).mae, null);

  const partial = [...Array.from({ length: 19 }, () => row('20', '0')), row('', '')];
  const p = assess(partial);
  assert.equal(p.verdict, '입력 대기'); // 오차 0이어도 표본 부족이면 판정하지 않음
  assert.equal(p.valid, 19);
  assert.equal(p.empty, 1);

  const pass = Array.from({ length: 20 }, () => row('24', '0', 20));
  assert.equal(assess(pass).verdict, '통과'); // MAE 4
  const fail = Array.from({ length: 20 }, () => row('26', '1', 20));
  const f = assess(fail);
  assert.equal(f.verdict, '미통과'); // MAE 6
  assert.equal(f.transferMismatch, 20);

  const withInvalid = [...Array.from({ length: 19 }, () => row('20', '0')), row('abc', '0')];
  const w = assess(withInvalid);
  assert.equal(w.verdict, '입력 대기');
  assert.deepEqual(w.invalid, [{ row: 20, reason: '지도 앱(분) 숫자 아님: abc' }]);
});

test('추정 경로를 뺀 MAE를 따로 계산', () => {
  const rows = [row('30', '0', 20, true), row('22', '0', 20, false)];
  const a = assess(rows);
  assert.equal(a.mae, 6);
  assert.equal(a.maeMeasuredOnly, 2);
});

test('사용자 입력 보존: 정렬 표기(---:)가 있는 표도 읽고, 다시 쓴 표에서 그대로 읽힌다', () => {
  const md = '| # | 출발역 | 도착역 | 지도 앱(분) | 지도 앱 환승 | 엔진(분) |\n|---|---|---|---:|---:|---:|\n| 1 | 강남 | 홍대입구 | 31 | 0 | 29 |';
  assert.deepEqual([...readUserValues(md)], [['강남|홍대입구', ['31', '0']]]);
  const r = { ...row('31', '0'), from: '강남', to: '홍대입구' };
  assert.deepEqual(readUserValues(render([r], 'x')).get('강남|홍대입구'), ['31', '0']);
});

test('실제 그래프 회귀: 20개 경로 도달, 엔진 시간 ≤ 같은 노선 직통, 지선·순환 연결', async () => {
  const { readFileSync } = await import('node:fs');
  const { computeRows, ROUTES } = await import('../src/accuracy.ts');
  const { prepareGraph, shortestFromStation, bestArrival } = await import('../../app/src/engine/index.ts');
  const graph = JSON.parse(readFileSync(new URL('../../app/src/data/graph.v1.json', import.meta.url), 'utf8'));
  const rows = computeRows(graph, new Map());
  assert.equal(rows.length, ROUTES.length);
  for (const r of rows) {
    for (const d of r.direct.split(', ').filter(Boolean)) {
      const m = /(\d+)분/.exec(d)!;
      assert.ok(r.engMin <= Number(m[1]), `${r.from}→${r.to}: 엔진 ${r.engMin}분이 직통 ${d}보다 길다`);
    }
  }
  // 다중 노선 출발역: 출발 노선 사이 환승 비용 없이 시작(멀티 소스) — 종로3가(1·3·5) 출발은 각 노선 노드가 0초
  const g = prepareGraph(graph);
  const idx = new Map<string, number>(graph.stations.map((s: { name: string }, i: number) => [s.name, i] as [string, number]));
  const t = shortestFromStation(g, idx.get('종로3가')!);
  for (const n of g.stationNodes[idx.get('종로3가')!]) assert.equal(t.dist[n], 0);
  // 지선·순환: 성수지선(신설동), 신정지선(까치산), 마천지선(마천), 2호선 순환(충정로→시청)이 이어져 있다
  for (const [a, b] of [['성수', '신설동'], ['신도림', '까치산'], ['강동', '마천'], ['충정로', '시청'], ['개화', '중앙보훈병원'], ['연천', '신창']]) {
    assert.ok(bestArrival(g, shortestFromStation(g, idx.get(a)!), idx.get(b)!) != null, `${a}→${b} 도달 불가`);
  }
});
