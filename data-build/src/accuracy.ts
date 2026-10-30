// docs/ACCURACY.md 생성: 기준 경로 20개의 엔진 값(분·환승·경로)을 채운다. 사용자가 입력한 지도 앱 값은 보존한다.
// 사용: npm run data:accuracy   (그래프 빌드 후)
// 지도 앱 값 두 칸을 채우고 다시 실행하면 오차와 평균 절대 오차·게이트 판정을 계산한다.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareGraph, routeTo, shortestFromStation, type Graph } from '../../app/src/engine/index.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const GRAPH = join(ROOT, 'app', 'src', 'data', 'graph.v1.json');
const OUT = join(ROOT, 'docs', 'ACCURACY.md');
export const MAX_MEAN_ERROR_MIN = 5;

/** 게이트 대상 노선(1~9호선·신분당·수인분당·경의중앙·공항철도)과 코레일 1호선을 고루 섞은 기준 경로 */
export const ROUTES: [string, string, string][] = [
  ['강남', '홍대입구', '2호선 단일'],
  ['잠실', '서울역', '2→1/4 환승'],
  ['사당', '왕십리', '2·4·5호선 선택'],
  ['신도림', '건대입구', '2호선 장거리'],
  ['노원', '사당', '4호선'],
  ['여의도', '고속터미널', '9호선'],
  ['김포공항', '종로3가', '5호선'],
  ['인천공항1터미널', '서울역', '공항철도'],
  ['판교', '강남', '신분당선'],
  ['수원', '서울역', '1호선 코레일(경부선)'],
  ['수서', '선릉', '수인분당선'],
  ['디지털미디어시티', '공덕', '경의중앙/6호선/공항철도'],
  ['청량리', '용산', '경의중앙선'],
  ['연신내', '압구정', '3호선'],
  ['장암', '가산디지털단지', '7호선 전 구간'],
  ['인천', '신도림', '1호선 코레일(경인선)'],
  ['상봉', '잠실', '7→8 환승'],
  ['응암', '이태원', '6호선'],
  ['개화', '종합운동장', '9호선 장거리'],
  ['마천', '홍대입구', '5→2 환승, 지선'],
];

interface Row { from: string; to: string; note: string; mapMin: string; mapTr: string; engMin: number; engTr: number; estimated: boolean; path: string }

/** 기존 표에서 사용자가 넣은 지도 앱 값 읽기 (출발|도착 → [분, 환승]) */
function readUserValues(md: string): Map<string, [string, string]> {
  const out = new Map<string, [string, string]>();
  for (const line of md.split('\n')) {
    const c = line.split('|').map((x) => x.trim());
    if (c.length < 8 || !/^\d+$/.test(c[1])) continue;
    out.set(`${c[2]}|${c[3]}`, [c[4], c[5]]);
  }
  return out;
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
    const [mapMin, mapTr] = user.get(`${from}|${to}`) ?? ['', ''];
    return { from, to, note, mapMin, mapTr, engMin: Math.round(route.sec / 60), engTr: route.transfers, estimated: route.estimated, path };
  });
}

function render(rows: Row[], builtAt: string): string {
  const filled = rows.filter((r) => r.mapMin !== '' && !Number.isNaN(Number(r.mapMin)));
  const errs = filled.map((r) => Math.abs(r.engMin - Number(r.mapMin)));
  const mae = errs.length ? errs.reduce((a, b) => a + b, 0) / errs.length : null;
  const verdict = mae == null ? '지도 앱 값 입력 대기' : mae <= MAX_MEAN_ERROR_MIN ? `통과 (평균 절대 오차 ${mae.toFixed(1)}분 ≤ ${MAX_MEAN_ERROR_MIN}분, ${filled.length}/20 경로)` : `미달 (평균 절대 오차 ${mae.toFixed(1)}분 > ${MAX_MEAN_ERROR_MIN}분, ${filled.length}/20 경로)`;
  return [
    '# 정확도 검증 (Phase 0 게이트)',
    '',
    '> `npm run data:accuracy`가 엔진 값을 채운다. **지도 앱 두 칸만 사용자가 입력**하고 다시 실행하면 오차와 판정이 계산된다(Claude는 지도 앱을 조회하지 않는다).',
    `> 그래프 빌드: ${builtAt}. 통과 기준: 평균 절대 오차 ≤ ${MAX_MEAN_ERROR_MIN}분.`,
    '',
    '## 지도 앱 값 넣는 법',
    '- 평일 오후 2시 출발, "지하철만", 첫 번째 추천 경로.',
    '- **첫 탑승부터 마지막 하차까지**(환승 도보·대기 포함, 출발역까지 걷는 시간과 도착 후 걷는 시간은 제외)의 분, 그리고 환승 횟수.',
    '- 엔진 값은 표준 운행시간 + 환승(보행 + 대기 3분 가정)이다. `*` 표시 경로는 거리·평균값 추정 구간 포함(시간표 수집 전, 급행 미반영).',
    '',
    '| # | 출발역 | 도착역 | 지도 앱(분) | 지도 앱 환승 | 엔진(분) | 엔진 환승 | 오차(분) | 엔진 경로 | 메모 |',
    '|---|---|---|---|---|---|---|---|---|---|',
    ...rows.map((r, i) => {
      const err = r.mapMin !== '' && !Number.isNaN(Number(r.mapMin)) ? String(r.engMin - Number(r.mapMin)) : '';
      return `| ${i + 1} | ${r.from} | ${r.to} | ${r.mapMin} | ${r.mapTr} | ${r.engMin}${r.estimated ? '*' : ''} | ${r.engTr} | ${err} | ${r.path} | ${r.note} |`;
    }),
    '',
    '`*` = 추정 구간(거리 기반 시간 또는 기본 환승값) 포함',
    '',
    `**판정: ${verdict}**`,
    '',
  ].join('\n');
}

function main(): void {
  const graph = JSON.parse(readFileSync(GRAPH, 'utf8')) as Graph;
  const user = existsSync(OUT) ? readUserValues(readFileSync(OUT, 'utf8')) : new Map();
  const rows = computeRows(graph, user);
  writeFileSync(OUT, render(rows, graph.builtAt));
  console.log(`${rows.length}개 경로 → ${OUT}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
