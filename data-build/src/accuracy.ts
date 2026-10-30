// docs/ACCURACY.md 생성: 기준 경로 20개의 엔진 값(분·환승·경로·같은 노선 직통 대안)을 채운다. 사용자가 입력한 지도 앱 값은 보존한다.
// 사용: npm run data:accuracy   (그래프 빌드 후)
// 지도 앱 두 칸(분, 환승)을 채우고 다시 실행하면 입력 검증 → 절대 오차·MAE·판정을 계산한다.
// 판정은 '입력 대기' / '통과' / '미통과' 셋뿐이고, 20개 모두 올바르게 입력되기 전에는 통과·미통과를 내지 않는다.
// 지도 앱 값은 사람이 직접 확인한 실측만 넣는다(다른 자료의 후보값을 옮겨 넣지 않는다).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareGraph, routeTo, shortestFromStation, type Graph, type PreparedGraph } from '../../app/src/engine/index.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const GRAPH = join(ROOT, 'app', 'src', 'data', 'graph.v1.json');
const OUT = join(ROOT, 'docs', 'ACCURACY.md');
export const MAX_MEAN_ERROR_MIN = 5;
/** 이보다 큰 지도 앱 값은 입력 실수로 본다 */
export const MAX_PLAUSIBLE_MIN = 300;
export const MAX_PLAUSIBLE_TRANSFERS = 6;

/** 게이트 대상 노선(1~9호선·신분당·수인분당·경의중앙·공항철도)과 코레일 1호선을 고루 섞은 기준 경로. 메모는 엔진 경로와 맞춘다 */
export const ROUTES: [string, string, string][] = [
  ['강남', '홍대입구', '2호선 단일'],
  ['잠실', '서울역', '2→4 환승'],
  ['사당', '왕십리', '2·4·5호선·경의중앙 선택'],
  ['신도림', '건대입구', '2호선 장거리'],
  ['노원', '사당', '4호선'],
  ['여의도', '고속터미널', '9호선(급행 미반영)'],
  ['김포공항', '종로3가', '5호선 직통 vs 공항철도+5호선'],
  ['인천공항1터미널', '서울역', '공항철도(직통열차 미반영)'],
  ['판교', '강남', '신분당선'],
  ['수원', '서울역', '1호선 직통 vs 금정 4호선 환승(금정 환승 시간 기본값)'],
  ['수서', '선릉', '수인분당선'],
  ['디지털미디어시티', '공덕', '경의중앙/6호선/공항철도'],
  ['청량리', '용산', '1호선 vs 경의중앙선'],
  ['연신내', '압구정', '3호선'],
  ['장암', '가산디지털단지', '7호선 전 구간'],
  ['인천', '신도림', '1호선 코레일(경인선, 급행 미반영)'],
  ['상봉', '잠실', '7→2 환승(건대입구)'],
  ['응암', '이태원', '6호선'],
  ['개화', '종합운동장', '9호선 직통 vs 5·2호선 환승(급행 미반영)'],
  ['마천', '홍대입구', '5→2 환승, 지선'],
];

export interface Row {
  from: string; to: string; note: string;
  mapMin: string; mapTr: string;
  engMin: number; engTr: number; estimated: boolean; path: string;
  /** 출발·도착이 같은 노선에 있으면 그 노선만 타는(환승 없는) 시간 */
  direct: string;
}

/** 기존 표에서 사용자가 넣은 지도 앱 값 읽기 (출발|도착 → [분, 환승]). 정렬 표기(`---:`)가 있어도 된다 */
export function readUserValues(md: string): Map<string, [string, string]> {
  const out = new Map<string, [string, string]>();
  for (const line of md.split('\n')) {
    const c = line.split('|').map((x) => x.trim());
    if (c.length < 8 || !/^\d+$/.test(c[1])) continue;
    out.set(`${c[2]}|${c[3]}`, [c[4], c[5]]);
  }
  return out;
}

/** 한 노선만 타는 최단 시간(환승 간선 제외). 노선 노드가 없거나 이어지지 않으면 null */
function lineOnlySec(g: PreparedGraph, a: number, b: number, lineIdx: number): { sec: number; estimated: boolean } | null {
  const nodes = g.raw.nodes;
  const start = g.stationNodes[a].find((n) => nodes[n].lineIdx === lineIdx);
  const goal = g.stationNodes[b].find((n) => nodes[n].lineIdx === lineIdx);
  if (start == null || goal == null) return null;
  const dist = new Map([[start, 0]]);
  const est = new Map([[start, false]]);
  const open = [start];
  while (open.length) {
    open.sort((x, y) => dist.get(x)! - dist.get(y)!);
    const v = open.shift()!;
    if (v === goal) break;
    for (const e of g.adj[v]) {
      if (e.transfer) continue;
      const d = dist.get(v)! + e.sec;
      if (d < (dist.get(e.to) ?? Infinity)) { dist.set(e.to, d); est.set(e.to, est.get(v)! || e.estimated); open.push(e.to); }
    }
  }
  return dist.has(goal) ? { sec: dist.get(goal)!, estimated: est.get(goal)! } : null;
}

export function computeRows(graph: Graph, user: Map<string, [string, string]>): Row[] {
  const g = prepareGraph(graph);
  const idx = new Map(graph.stations.map((s, i) => [s.name, i]));
  return ROUTES.map(([from, to, note]) => {
    const a = idx.get(from);
    const b = idx.get(to);
    if (a == null || b == null) throw new Error(`그래프에 없는 역: ${a == null ? from : to}`);
    const route = routeTo(g, shortestFromStation(g, a), b);
    if (!route) throw new Error(`도달 불가: ${from} → ${to}`);
    const path = route.steps
      .map((s) => (s.kind === 'ride' ? `${graph.lines[s.lineIdx].short}(${graph.stations[s.toStation].name})` : '환승'))
      .join(' → ');
    // 같은 노선 직통 대안: 엔진이 환승 경로를 골랐을 때 직통과 같은 비용 기준으로 비교했는지 보이기 위함
    const shared = graph.stations[a].lines.filter((l) => graph.stations[b].lines.includes(l));
    const direct = route.transfers === 0 ? '' : shared
      .map((lid) => { const li = graph.lines.findIndex((l) => l.id === lid); const r = lineOnlySec(g, a, b, li); return r ? `${graph.lines[li].short} ${Math.round(r.sec / 60)}분${r.estimated ? '*' : ''}` : null; })
      .filter(Boolean).join(', ');
    const [mapMin, mapTr] = user.get(`${from}|${to}`) ?? ['', ''];
    return { from, to, note, mapMin, mapTr, engMin: Math.round(route.sec / 60), engTr: route.transfers, estimated: route.estimated, path, direct };
  });
}

export type RowCheck = { state: 'empty' } | { state: 'invalid'; reason: string } | { state: 'ok'; min: number; tr: number; absErr: number };

/** 지도 앱 입력 검증: 둘 다 비면 미입력, 하나만 있거나 숫자가 아니거나 범위를 벗어나면 무효 */
export function checkRow(r: Pick<Row, 'mapMin' | 'mapTr' | 'engMin'>): RowCheck {
  const m = r.mapMin.trim();
  const t = r.mapTr.trim();
  if (m === '' && t === '') return { state: 'empty' };
  if (m === '') return { state: 'invalid', reason: '지도 앱(분) 비어 있음' };
  if (t === '') return { state: 'invalid', reason: '지도 앱 환승 비어 있음' };
  if (!/^\d+(\.\d+)?$/.test(m)) return { state: 'invalid', reason: `지도 앱(분) 숫자 아님: ${m}` };
  if (!/^\d+$/.test(t)) return { state: 'invalid', reason: `지도 앱 환승 정수 아님: ${t}` };
  const min = Number(m);
  const tr = Number(t);
  if (min <= 0 || min > MAX_PLAUSIBLE_MIN) return { state: 'invalid', reason: `지도 앱(분) 범위 밖: ${m}` };
  if (tr > MAX_PLAUSIBLE_TRANSFERS) return { state: 'invalid', reason: `지도 앱 환승 범위 밖: ${t}` };
  return { state: 'ok', min, tr, absErr: Math.abs(r.engMin - min) };
}

export interface Assessment {
  verdict: '입력 대기' | '통과' | '미통과';
  valid: number; empty: number; invalid: { row: number; reason: string }[];
  mae: number | null; maeMeasuredOnly: number | null; transferMismatch: number;
}

export function assess(rows: Row[]): Assessment {
  const checks = rows.map(checkRow);
  const ok = checks.map((c, i) => ({ c, r: rows[i] })).filter((x): x is { c: Extract<RowCheck, { state: 'ok' }>; r: Row } => x.c.state === 'ok');
  const invalid = checks.flatMap((c, i) => (c.state === 'invalid' ? [{ row: i + 1, reason: c.reason }] : []));
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const mae = mean(ok.map((x) => x.c.absErr));
  const maeMeasuredOnly = mean(ok.filter((x) => !x.r.estimated).map((x) => x.c.absErr));
  const complete = ok.length === rows.length;
  const verdict = !complete ? '입력 대기' : mae! <= MAX_MEAN_ERROR_MIN ? '통과' : '미통과';
  return { verdict, valid: ok.length, empty: checks.filter((c) => c.state === 'empty').length, invalid, mae, maeMeasuredOnly, transferMismatch: ok.filter((x) => x.c.tr !== x.r.engTr).length };
}

export function render(rows: Row[], builtAt: string): string {
  const a = assess(rows);
  const checks = rows.map(checkRow);
  const f = (x: number | null) => (x == null ? '—' : `${x.toFixed(1)}분`);
  return [
    '# 정확도 검증 (Phase 0 게이트)',
    '',
    '> `npm run data:accuracy`가 엔진 값을 채운다. **지도 앱 두 칸(분, 환승)만 사람이 직접 확인해 입력**하고 다시 실행하면 검증·오차·판정이 계산된다.',
    '> Claude는 지도 앱을 조회하지 않으며, 다른 자료의 후보값을 지도 앱 칸에 넣지 않는다.',
    `> 그래프 빌드: ${builtAt}. 통과 기준: 20개 경로 모두 입력 + 평균 절대 오차(MAE) ≤ ${MAX_MEAN_ERROR_MIN}분.`,
    '',
    '## 지도 앱 값 넣는 법',
    '- 네이버지도·카카오맵 중 하나로 20개를 모두 같은 앱에서 측정한다.',
    '- 평일 오후 2시 출발, "지하철만", 첫 번째 추천 경로. 출발 시각을 지정할 수 없으면 메모 칸에 실제 조회 조건을 적는다.',
    '- **첫 탑승부터 마지막 하차까지**(환승 도보·대기 포함, 출발역까지 걷는 시간과 도착 후 걷는 시간은 제외)의 분, 그리고 환승 횟수.',
    '- 엔진 값은 서울교통공사 공식 운행시간·국토교통부 평일 시간표로 만든 역간 시간 + 환승(보행 + 대기 3분 가정, 환승 1회마다 1번)이다. 출발·도착 도보는 넣지 않는다. 급행·직통열차, 휴일, 시간대 차이는 반영하지 않는다. `*` 표시는 거리 기반 추정 구간이나 기본 환승값(5분)을 포함한다.',
    '- "같은 노선 직통" 칸은 엔진이 환승 경로를 골랐을 때 같은 비용 기준으로 계산한 환승 없는 대안이다.',
    '',
    '| # | 출발역 | 도착역 | 지도 앱(분) | 지도 앱 환승 | 엔진(분) | 엔진 환승 | 오차(분) | 엔진 경로 | 같은 노선 직통 | 메모 |',
    '|---|---|---|---:|---:|---:|---:|---:|---|---|---|',
    ...rows.map((r, i) => {
      const c = checks[i];
      const err = c.state === 'ok' ? String(c.absErr) : c.state === 'invalid' ? '입력 오류' : '';
      return `| ${i + 1} | ${r.from} | ${r.to} | ${r.mapMin} | ${r.mapTr} | ${r.engMin}${r.estimated ? '*' : ''} | ${r.engTr} | ${err} | ${r.path} | ${r.direct} | ${r.note} |`;
    }),
    '',
    '`*` = 추정 구간(거리 기반 시간 또는 기본 환승값) 포함 · 오차 = |엔진 − 지도 앱|',
    '',
    '## 결과',
    '',
    `- 판정: **${a.verdict}**${a.verdict === '입력 대기' ? ` — 올바르게 입력된 경로 ${a.valid}/${rows.length}, 미입력 ${a.empty}, 입력 오류 ${a.invalid.length}` : ''}`,
    `- 평균 절대 오차(MAE): ${f(a.mae)} (표본 ${a.valid}개)${a.verdict === '입력 대기' && a.valid ? ' — 일부 표본이라 판정에 쓰지 않음' : ''}`,
    `- 추정 구간 없는 경로만의 MAE: ${f(a.maeMeasuredOnly)}`,
    `- 환승 횟수 불일치: ${a.valid ? `${a.transferMismatch}/${a.valid}` : '—'}`,
    ...a.invalid.map((x) => `- 입력 오류 #${x.row}: ${x.reason}`),
    '',
  ].join('\n');
}

function main(): void {
  const graph = JSON.parse(readFileSync(GRAPH, 'utf8')) as Graph;
  const user = existsSync(OUT) ? readUserValues(readFileSync(OUT, 'utf8')) : new Map();
  const rows = computeRows(graph, user);
  writeFileSync(OUT, render(rows, graph.builtAt));
  const a = assess(rows);
  console.log(`${rows.length}개 경로 → ${OUT} · 판정 ${a.verdict} (입력 ${a.valid}/${rows.length}, MAE ${a.mae == null ? '—' : a.mae.toFixed(1)})`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
