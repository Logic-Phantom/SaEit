import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { assignIds, buildGraph, DEFAULT_TRANSFER_SEC, TRANSFER_WAIT_SEC } from '../src/build-graph.ts';
import { mmssToSec, parseCsv } from '../src/csv.ts';
import { fitDistanceModel } from '../src/estimate.ts';
import { aliasesFromRaw, chosungOf, normalizeName } from '../src/normalize-station.ts';
import { loadLinearDistance } from '../src/sources/krna-distance.ts';
import { loadSeoulMetroRuntime } from '../src/sources/seoul-metro-runtime.ts';
import { loadMetroTransfers } from '../src/sources/transfers.ts';
import type { RawDataset } from '../src/types.ts';
import { validateGraph } from '../src/validate.ts';

const tmp = mkdtempSync(join(tmpdir(), 'saeit-'));
/** 원본처럼 CP949로 저장(TextDecoder('euc-kr')가 읽는 형식). 테스트 문자열은 ASCII·한글만 쓰므로 UTF-8 BOM으로 대신한다. */
function csvFile(name: string, text: string): string {
  const p = join(tmp, name);
  writeFileSync(p, `﻿${text}`, 'utf8');
  return p;
}

test('역명 정규화: 공백·역 접미사·부역명·같은 역 매핑', () => {
  assert.equal(normalizeName(' 강남 역 '), '강남');
  assert.equal(normalizeName('미아사거리 '), '미아사거리');
  assert.equal(normalizeName('신내역'), '신내');
  assert.equal(normalizeName('서울역'), '서울역');
  assert.equal(normalizeName('흑석(중앙대입구)'), '흑석');
  assert.equal(normalizeName('이수'), '총신대입구');
  assert.deepEqual(aliasesFromRaw('흑석(중앙대입구)'), ['중앙대입구']);
  assert.deepEqual(aliasesFromRaw('이수'), ['이수']);
  assert.deepEqual(aliasesFromRaw('시청.용인대'), []);
});

test('초성', () => {
  assert.equal(chosungOf('강남'), 'ㄱㄴ');
  assert.equal(chosungOf('총신대입구(이수)'), 'ㅊㅅㄷㅇㄱㅇㅅ');
});

test('CSV·시간 파싱', () => {
  assert.deepEqual(parseCsv('a,"b,c"\r\n\r\n1,2\n'), [['a', 'b,c'], ['1', '2']]);
  assert.equal(mmssToSec('02:13'), 133);
  assert.throws(() => mmssToSec('2분'));
});

test('역 ID는 기존 값을 유지하고 새 역만 추가', () => {
  const ids = assignIds(['강남', '역삼', '선릉'], { 역삼: 'S0007' });
  assert.equal(ids['역삼'], 'S0007');
  assert.equal(ids['강남'], 'S0008');
  assert.equal(ids['선릉'], 'S0009');
});

test('서울교통공사 어댑터: 호선 시작·지선 분기·순환 닫힘', () => {
  const p = csvFile('oa.csv', [
    '연번,호선,역명,소요시간,역간거리(km),호선별누계(km)',
    '1,2,시청,00:00,0,0', '2,2,을지로입구,01:30,0.7,0.7', '3,2,성수,01:00,0.8,1.5', '4,2,충정로,01:30,0.8,2.3', '5,2,시청,01:30,1.1,3.4',
    '6,2,용답,03:00,2.3,5.7', '7,2,신답,01:30,1,6.7',
    '8,4,당고개,00:00,0,0', '9,4,상계,01:30,1.2,1.2',
  ].join('\n'));
  const d = loadSeoulMetroRuntime(p);
  const pairs = d.sections.map((s) => `${s.lineId}:${s.from}>${s.to}:${s.sec}`);
  assert.deepEqual(pairs, ['L2:시청>을지로입구:90', 'L2:을지로입구>성수:60', 'L2:성수>충정로:90', 'L2:충정로>시청:90', 'L2:성수>용답:180', 'L2:용답>신답:90', 'L4:당고개>상계:90']);
});

test('환승 어댑터: 그래프 밖 노선·같은 호선은 건너뜀', () => {
  const p = csvFile('tr.csv', ['연번,호선,환승역명,환승노선,환승거리,환승소요시간', '1,1,서울역,4호선,159,02:13', '2,1,서울역,GTX-A,172,02:23', '3,2,성수,2호선,23,00:19', '4,7,이수,4호선,171,02:23'].join('\n'));
  const { transfers, skipped } = loadMetroTransfers(p);
  assert.deepEqual(transfers, [{ station: '서울역', fromLine: 'L1', toLine: 'L4', sec: 133 }, { station: '총신대입구', fromLine: 'L7', toLine: 'L4', sec: 143 }]);
  assert.deepEqual(skipped, ['GTX-A']);
});

test('거리 어댑터: 역간거리는 다음 역까지, 마지막 빈 값', () => {
  const p = csvFile('d.csv', ['철도운영기관명,선명,역명,역간거리', 'x,9호선,개화,3.6', 'x,9호선,김포공항,0.8', 'x,9호선,흑석(중앙대입구),'].join('\n'));
  const line = { id: 'L9', name: '9호선', short: '9', operator: 'x', color: '#000' };
  const { sections, aliases } = loadLinearDistance(p, line);
  assert.deepEqual(sections.map((s) => [s.from, s.to, s.km, s.sec, s.estimated]), [['개화', '김포공항', 3.6, null, true], ['김포공항', '흑석', 0.8, null, true]]);
  assert.deepEqual(aliases, { 흑석: ['중앙대입구'] });
});

test('거리 모델: 직선 관계를 복원', () => {
  const s = Array.from({ length: 12 }, (_, i) => ({ lineId: 'A', from: `${i}`, to: `${i + 1}`, km: 0.5 + i * 0.2, sec: Math.round(20 + 60 * (0.5 + i * 0.2)), estimated: false }));
  const m = fitDistanceModel(s)!;
  assert.ok(Math.abs(m.a - 20) < 1 && Math.abs(m.b - 60) < 1);
  assert.equal(fitDistanceModel(s.slice(0, 5)), null);
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

test('그래프: 추정 구간은 같은 노선 평균, 환승 = 보행 + 대기(반대 방향도 같은 값), 검증 통과', () => {
  const { graph } = buildGraph(raw, {}, '2026-10-30');
  assert.equal(graph.stations.length, 4);
  assert.equal(graph.nodes.length, 5); // 나는 A·B 두 노드
  const est = graph.edges.find((e) => e.kind === 'ride' && e.estimated);
  assert.equal(est?.sec, 100);
  const tr = graph.edges.filter((e) => e.kind === 'transfer');
  assert.deepEqual(tr.map((e) => [e.sec, e.estimated]), [[90 + TRANSFER_WAIT_SEC, false], [90 + TRANSFER_WAIT_SEC, false]]);
  const v = validateGraph(graph);
  assert.deepEqual(v.errors, []);
  assert.equal(v.components, 1);
});

test('그래프: 환승 데이터 없으면 기본값·추정', () => {
  const { graph } = buildGraph({ ...raw, transfers: [] }, {}, 'x');
  assert.ok(graph.edges.filter((e) => e.kind === 'transfer').every((e) => e.sec === DEFAULT_TRANSFER_SEC && e.estimated));
});

test('검증: 끊긴 그래프는 오류', () => {
  const { graph } = buildGraph({ ...raw, sections: [...raw.sections, { lineId: 'A', from: '섬1', to: '섬2', sec: 60, estimated: false }] }, {}, 'x');
  assert.ok(validateGraph(graph).errors.some((e) => e.startsWith('연결 요소')));
});
