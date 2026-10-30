// TAGO 지하철 시간표 수집 → data-build/raw/tago/ (응답 JSON 그대로, 서비스 키는 저장하지 않음)
// 사용: 1) 공공데이터포털에서 '국토교통부_(TAGO)_지하철정보' 활용신청
//       2) 저장소 루트 .env 에 TAGO_SERVICE_KEY=<일반 인증키(Decoding)>   (.env는 git 제외)
//       3) npm run data:build  →  npm run data:tago  →  npm run data:build (시간표 반영)
// 대상: 그래프에서 시간이 추정인 노선(9호선·공항철도·코레일·신분당선·에버라인)의 모든 역, 평일(01) 상·하행.
// 이미 받은 파일은 다시 받지 않는다(캐시). 결과 코드가 '00'이 아니면 즉시 멈춘다(한도 초과 등).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeName, splitName } from '../normalize-station.ts';
import type { Graph } from '../types.ts';
import { itemsOf, NON_CAPITAL_ID, resultOf, ROUTE_NAME_PATTERNS, TAGO_BASE, type TagoEnvelope, type TagoSchedule, type TagoStation } from './api.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const TAGO_DIR = join(ROOT, 'data-build', 'raw', 'tago');
const GRAPH = join(ROOT, 'app', 'src', 'data', 'graph.v1.json');
const DELAY_MS = 250;

export interface TagoIndex {
  fetchedAt: string;
  dailyTypeCode: '01';
  /** `노선ID|역명` → TAGO 역 ID */
  stations: Record<string, string>;
  routeNamesSeen: string[];
  unmatched: string[];
  ambiguous: string[];
}

function serviceKey(): string | null {
  if (process.env.TAGO_SERVICE_KEY) return process.env.TAGO_SERVICE_KEY;
  const env = join(ROOT, '.env');
  if (!existsSync(env)) return null;
  const m = /^TAGO_SERVICE_KEY\s*=\s*(.+)$/m.exec(readFileSync(env, 'utf8'));
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : null;
}

async function call<T>(key: string, op: string, params: Record<string, string>): Promise<TagoEnvelope<T>> {
  const q = new URLSearchParams({ serviceKey: key, _type: 'json', ...params });
  const res = await fetch(`${TAGO_BASE}/${op}?${q}`);
  const text = await res.text();
  let env: TagoEnvelope<T>;
  try {
    env = JSON.parse(text) as TagoEnvelope<T>;
  } catch {
    // 인증 실패 등은 XML/텍스트로 온다 — 키가 들어간 URL은 출력하지 않는다
    throw new Error(`${op} 응답이 JSON이 아님 (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }
  const r = resultOf(env);
  if (!r.ok) throw new Error(`${op} 결과 코드 ${r.code} ${r.msg}`);
  await new Promise((ok) => setTimeout(ok, DELAY_MS));
  return env;
}

async function main(): Promise<void> {
  const key = serviceKey();
  if (!key) {
    console.log('TAGO_SERVICE_KEY가 없어요. 공공데이터포털에서 "국토교통부_(TAGO)_지하철정보"(15098554)를 활용신청하고 .env에 넣어 주세요.');
    return;
  }
  const g = JSON.parse(readFileSync(GRAPH, 'utf8')) as Graph;
  const lineIds = new Set(Object.keys(ROUTE_NAME_PATTERNS));
  const targets: { lineId: string; name: string }[] = [];
  g.lines.forEach((l, li) => {
    if (!lineIds.has(l.id)) return;
    const names = new Set(g.nodes.filter((n) => n.lineIdx === li).map((n) => g.stations[n.stationIdx].name));
    for (const name of names) targets.push({ lineId: l.id, name });
  });
  mkdirSync(join(TAGO_DIR, 'stations'), { recursive: true });
  mkdirSync(join(TAGO_DIR, 'schedules'), { recursive: true });

  // 1) 역 ID 찾기 (역명 검색은 이름당 한 번)
  const index: TagoIndex = { fetchedAt: new Date().toISOString(), dailyTypeCode: '01', stations: {}, routeNamesSeen: [], unmatched: [], ambiguous: [] };
  const seen = new Set<string>();
  const searched = new Map<string, TagoStation[]>();
  for (const t of targets) {
    const base = splitName(t.name.replace(/\(.+\)$/, '')).name;
    if (!searched.has(base)) {
      const file = join(TAGO_DIR, 'stations', `${base}.json`);
      let env: TagoEnvelope<TagoStation>;
      if (existsSync(file)) env = JSON.parse(readFileSync(file, 'utf8'));
      else {
        env = await call<TagoStation>(key, 'GetKwrdFndSubwaySttnList', { subwayStationName: base, numOfRows: '100', pageNo: '1' });
        writeFileSync(file, JSON.stringify(env));
      }
      searched.set(base, itemsOf(env));
    }
    const items = searched.get(base)!;
    for (const it of items) seen.add(it.subwayRouteName);
    // 이름 일치: 대표명 또는 괄호 안 옛 이름(예: '불암산(당고개)' ↔ 우리 '당고개')
    const sameName = (raw: string) => normalizeName(raw, t.lineId) === t.name || splitName(raw).sub === t.name;
    const hits = items.filter((it) => ROUTE_NAME_PATTERNS[t.lineId].test(it.subwayRouteName) && !NON_CAPITAL_ID.test(it.subwayStationId) && sameName(it.subwayStationName));
    if (hits.length === 1) index.stations[`${t.lineId}|${t.name}`] = hits[0].subwayStationId;
    else (hits.length ? index.ambiguous : index.unmatched).push(`${t.lineId}|${t.name}`);
  }
  index.routeNamesSeen = [...seen].sort();
  writeFileSync(join(TAGO_DIR, 'index.json'), `${JSON.stringify(index, null, 1)}\n`);
  console.log(`역 ID: ${Object.keys(index.stations).length}/${targets.length} (못 찾음 ${index.unmatched.length}, 여러 개 ${index.ambiguous.length})`);
  console.log(`TAGO 노선 이름: ${index.routeNamesSeen.join(', ')}`);

  // 2) 시간표 (역 × 상·하행, 평일)
  let n = 0;
  for (const id of new Set(Object.values(index.stations))) {
    for (const dir of ['U', 'D'] as const) {
      const file = join(TAGO_DIR, 'schedules', `${id}_${dir}_01.json`);
      if (existsSync(file)) continue;
      const all: TagoSchedule[] = [];
      for (let page = 1; ; page++) {
        const env = await call<TagoSchedule>(key, 'GetSubwaySttnAcctoSchdulList', { subwayStationId: id, dailyTypeCode: '01', upDownTypeCode: dir, numOfRows: '500', pageNo: String(page) });
        all.push(...itemsOf(env));
        if (all.length >= resultOf(env).total || itemsOf(env).length === 0) break;
      }
      writeFileSync(file, JSON.stringify(all));
      n++;
    }
  }
  console.log(`시간표 ${n}개 새로 받음 → ${TAGO_DIR}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
