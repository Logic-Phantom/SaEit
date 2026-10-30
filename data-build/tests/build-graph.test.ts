import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assignIds, buildGraph } from '../src/build-graph.ts';
import { aliasesOf, chosungOf, normalizeName } from '../src/normalize-station.ts';
import type { RawDataset } from '../src/types.ts';
import { validateGraph } from '../src/validate.ts';

test('역명 정규화: 공백·역 접미사', () => {
  assert.equal(normalizeName(' 강남 역 '), '강남');
  assert.equal(normalizeName('서울역'), '서울역');
  assert.equal(normalizeName('총신대입구(이수)역'), '총신대입구(이수)');
  assert.deepEqual(aliasesOf('총신대입구(이수)'), ['총신대입구', '이수']);
});

test('초성', () => {
  assert.equal(chosungOf('강남'), 'ㄱㄴ');
  assert.equal(chosungOf('총신대입구(이수)'), 'ㅊㅅㄷㅇㄱㅇㅅ');
});

test('역 ID는 기존 값을 유지하고 새 역만 추가', () => {
  const ids = assignIds(['강남', '역삼', '선릉'], { 역삼: 'S0007' });
  assert.equal(ids['역삼'], 'S0007');
  assert.equal(ids['강남'], 'S0008');
  assert.equal(ids['선릉'], 'S0009');
});

const raw: RawDataset = {
  demo: true,
  sources: [],
  lines: [
    { id: 'A', name: 'A선', short: 'A', operator: 't', color: '#000' },
    { id: 'B', name: 'B선', short: 'B', operator: 't', color: '#111' },
  ],
  sections: [
    { lineId: 'A', from: '가', to: '나', sec: 100, estimated: false },
    { lineId: 'A', from: '나', to: '다', sec: null, estimated: true },
    { lineId: 'B', from: '나', to: '라', sec: 60, estimated: false },
  ],
  transfers: [{ station: '나', fromLine: 'A', toLine: 'B', sec: 90 }],
};

test('그래프: 추정 구간은 같은 노선 평균, 환승 간선 양방향, 검증 통과', () => {
  const { graph } = buildGraph(raw, {}, '2026-10-30');
  assert.equal(graph.stations.length, 4);
  assert.equal(graph.nodes.length, 5); // 나는 A·B 두 노드
  const est = graph.edges.find((e) => e.kind === 'ride' && e.estimated);
  assert.equal(est?.sec, 100);
  const tr = graph.edges.filter((e) => e.kind === 'transfer');
  assert.equal(tr.length, 2);
  assert.deepEqual(tr.map((e) => [e.sec, e.estimated]).sort(), [[300, true], [90, false]].sort());
  const v = validateGraph(graph);
  assert.deepEqual(v.errors, []);
  assert.equal(v.components, 1);
});

test('검증: 끊긴 그래프는 오류', () => {
  const { graph } = buildGraph({ ...raw, sections: [...raw.sections, { lineId: 'A', from: '섬1', to: '섬2', sec: 60, estimated: false }] }, {}, 'x');
  assert.ok(validateGraph(graph).errors.some((e) => e.startsWith('연결 요소')));
});
