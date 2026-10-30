import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { normalizeName } from '../src/normalize-station.ts';
import { loadKorailDistance } from '../src/sources/korail-distance.ts';
import { hmsToSec, itemsOf, type TagoSchedule } from '../src/tago/api.ts';
import { applyTagoTimes } from '../src/tago/apply.ts';
import { pairTime } from '../src/tago/times.ts';

const tmp = mkdtempSync(join(tmpdir(), 'saeit-k-'));
const csv = (name: string, rows: string[]) => {
  const p = join(tmp, name);
  writeFileSync(p, `﻿${['철도운영기관명,선명,역명,역간거리(km)', ...rows].join('\n')}`, 'utf8');
  return p;
};

test('동명이역: 노선을 주면 구분된 이름, 다시 정규화해도 유지', () => {
  assert.equal(normalizeName('양평', 'GJ'), '양평(경의중앙선)');
  assert.equal(normalizeName('양평', 'L5'), '양평');
  assert.equal(normalizeName('양평(경의중앙선)'), '양평(경의중앙선)');
});

test('코레일 거리: 반복 묶음 중복 제거, 생략 구간 보정, 분기·지선 끝 규칙', () => {
  const p = csv('k.csv', [
    // 경인선: … 회기 → (서울교통공사 구간 생략) 남영 → 용산 … 구로 → 구일
    '코레일,1호선(경인선),회기,1.4', '코레일,1호선(경인선),남영,1.7', '코레일,1호선(경인선),용산,1.5',
    '코레일,1호선(경인선),구로,1.1', '코레일,1호선(경인선),구일,',
    // 광명선: 같은 앞부분 반복 + 구로 → 가산 → 금천구청 → 광명(마지막 값 = 금천구청에서 광명까지)
    '코레일,1호선(광명선),회기,1.4', '코레일,1호선(광명선),남영,1.7', '코레일,1호선(광명선),용산,1.5',
    '코레일,1호선(광명선),구로,1.1', '코레일,1호선(광명선),가산디지털단지,2', '코레일,1호선(광명선),금천구청,1.9', '코레일,1호선(광명선),광명,4.7',
    // 경부선: 금천구청 → 석수(본선)
    '코레일,1호선(경부선),가산디지털단지,2', '코레일,1호선(경부선),금천구청,1.9', '코레일,1호선(경부선),석수,',
    // 부산권 노선은 제외
    '코레일,동해,부전,2.3', '코레일,동해,교대,',
  ]);
  const { sections } = loadKorailDistance(p);
  const km = new Map(sections.map((s) => [`${s.from}>${s.to}`, s.km ?? null]));
  assert.equal(km.has('회기>남영'), false);
  assert.equal(km.get('회기>청량리'), 1.4);
  assert.equal(km.get('서울역>남영'), null);
  assert.equal(km.get('남영>용산'), 1.7);
  assert.equal(km.get('구로>구일'), null); // 구로는 분기역이고 본선 쪽 다음 역이 둘 → 비움
  assert.equal(km.get('구로>가산디지털단지'), null);
  assert.equal(km.get('금천구청>광명'), 4.7); // 지선 끝 규칙
  assert.equal(km.get('금천구청>석수'), 1.9);
  assert.equal(sections.filter((s) => s.from === '용산' && s.to === '구로').length, 1); // 반복 묶음 중복 제거
  assert.ok(sections.every((s) => s.lineId === 'L1' && s.estimated));
});

test('TAGO 응답 도우미', () => {
  assert.equal(hmsToSec('053000'), 5.5 * 3600);
  assert.equal(hmsToSec('003000'), 24.5 * 3600);
  assert.equal(hmsToSec(''), null);
  assert.equal(hmsToSec('0'), null);
  assert.deepEqual(itemsOf({ response: { body: { items: { item: { a: 1 } } } } }), [{ a: 1 }]);
  assert.deepEqual(itemsOf({ response: { body: { items: '' } } }), []);
});

const row = (st: string, end: string, dep: string, dir = 'D'): TagoSchedule => ({
  subwayRouteId: 'R', subwayStationId: st, subwayStationNm: st, endSubwayStationId: end, endSubwayStationNm: end,
  dailyTypeCode: '01', upDownTypeCode: dir, depTime: dep, arrTime: dep,
});
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}${String(min % 60).padStart(2, '0')}00`;

test('시간표 짝짓기: 같은 종점 열차의 출발 차 중앙값, 반대 방향·새벽 제외', () => {
  // 가 → 나 → 다(종점). 08:00부터 10분 간격 6대, 가→나 2분, 한 대는 3분(지연)
  const a = [0, 10, 20, 30, 40, 50].map((m) => row('가', '다', hhmm(480 + m)));
  const b = [2, 12, 22, 33, 42, 52].map((m) => row('나', '다', hhmm(480 + m)));
  a.push(row('가', '다', hhmm(300))); // 05:00 — 낮 시간 밖
  const toward = (r: TagoSchedule) => (r.endSubwayStationNm === '다' ? true : r.endSubwayStationNm === '가' ? false : undefined);
  assert.deepEqual(pairTime(a, b, toward), { sec: 120, samples: 6 });
  assert.equal(pairTime(a.slice(0, 3), b, toward), null); // 표본 5개 미만
  assert.equal(pairTime(a, b, () => false), null);
});

test('시간표 반영: 추정 구간만 채우고 실측 구간은 그대로', () => {
  const dir = join(tmp, 'tago');
  mkdirSync(join(dir, 'schedules'), { recursive: true });
  writeFileSync(join(dir, 'index.json'), JSON.stringify({ fetchedAt: '2026-10-30T00:00:00Z', dailyTypeCode: '01', stations: { 'X|가': 'T1', 'X|나': 'T2', 'X|다': 'T3' }, routeNamesSeen: [], unmatched: [], ambiguous: [] }));
  const mins = [0, 10, 20, 30, 40, 50];
  writeFileSync(join(dir, 'schedules', 'T1_D_01.json'), JSON.stringify(mins.map((m) => row('가', '다', hhmm(480 + m)))));
  writeFileSync(join(dir, 'schedules', 'T2_D_01.json'), JSON.stringify(mins.map((m) => row('나', '다', hhmm(483 + m)))));
  writeFileSync(join(dir, 'schedules', 'T3_D_01.json'), JSON.stringify(mins.map((m) => row('다', '다', hhmm(485 + m)))));
  for (const t of ['T1', 'T2', 'T3']) writeFileSync(join(dir, 'schedules', `${t}_U_01.json`), '[]');
  const r = applyTagoTimes([
    { lineId: 'X', from: '가', to: '나', sec: null, estimated: true },
    { lineId: 'X', from: '나', to: '다', sec: 99, estimated: false },
  ], dir);
  assert.equal(r.filled, 1);
  assert.deepEqual(r.sections.map((s) => [s.sec, s.estimated]), [[180, false], [99, false]]);
});

test('TAGO 노선 이름 매칭: 완전 일치, 수도권 밖 ID 제외', async () => {
  const { ROUTE_NAME_PATTERNS, NON_CAPITAL_ID } = await import('../src/tago/api.ts');
  assert.equal(ROUTE_NAME_PATTERNS.L1.test('1호선'), true);
  assert.equal(ROUTE_NAME_PATTERNS.L1.test('인천1호선'), false);
  assert.equal(ROUTE_NAME_PATTERNS.SB.test('신분당'), false);
  assert.equal(ROUTE_NAME_PATTERNS.SBD.test('신분당'), true);
  assert.equal(NON_CAPITAL_ID.test('MTRDJ10011'), true);
  assert.equal(NON_CAPITAL_ID.test('MTRS11151'), false);
});
