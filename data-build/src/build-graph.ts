// raw → 정규화 → 그래프 → 검증 → app/src/data/graph.v1.json + docs/COVERAGE.md
// 사용: npm run data:build            (data-build/raw/ 공공데이터 원본)
//       npm run data:build -- --demo  (fixtures/demo-lines.json 데모 목록)
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fillEstimates, fitDistanceModel, type DistanceModel } from './estimate.ts';
import { aliasesOf, chosungOf, normalizeName } from './normalize-station.ts';
import { coverageMarkdown } from './report.ts';
import { loadDemoLines } from './sources/demo-lines.ts';
import { KORAIL_LINES, loadKorailDistance } from './sources/korail-distance.ts';
import { loadLinearDistance } from './sources/krna-distance.ts';
import { loadManualLines } from './sources/manual-lines.ts';
import { loadSeoulMetroRuntime } from './sources/seoul-metro-runtime.ts';
import { loadMetroTransfers } from './sources/transfers.ts';
import { applyPairs, deriveTagoPairs, type DerivedTago } from './tago/apply.ts';
import type { Edge, Graph, RawDataset } from './types.ts';
import { validateGraph } from './validate.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const RAW = join(ROOT, 'data-build', 'raw');
const IDS_PATH = join(ROOT, 'data-build', 'station-ids.json');
const OUT = join(ROOT, 'app', 'src', 'data', 'graph.v1.json');
const COVERAGE = join(ROOT, 'docs', 'COVERAGE.md');
const TAGO_DERIVED = join(ROOT, 'data-build', 'derived', 'tago-pair-times.json');
/** 환승 데이터가 없을 때 쓰는 전체 환승 시간(보행 + 대기) */
export const DEFAULT_TRANSFER_SEC = 300;
/** 환승 평균 대기 가정: 배차 6분의 절반. Phase 6에서 노선·시간대별 배차/2로 바꾼다(D-023) */
export const TRANSFER_WAIT_SEC = 180;
const DEFAULT_RIDE_SEC = 120;

/** 역 ID는 한 번 정하면 바꾸지 않는다(공유 링크 호환). 새 역만 뒤에 번호를 붙인다. */
export function assignIds(names: string[], registry: Record<string, string>): Record<string, string> {
  const next = { ...registry };
  let max = Object.values(next).reduce((m, id) => Math.max(m, Number(id.slice(1))), 0);
  for (const n of [...names].sort((a, b) => a.localeCompare(b, 'ko'))) {
    if (!next[n]) next[n] = `S${String(++max).padStart(4, '0')}`;
  }
  return next;
}

export interface BuildResult { graph: Graph; registry: Record<string, string>; model: DistanceModel | null; }

export function buildGraph(raw: RawDataset, registry: Record<string, string>, builtAt: string): BuildResult {
  const normalized = raw.sections.map((s) => ({ ...s, from: normalizeName(s.from), to: normalizeName(s.to) }));
  const model = fitDistanceModel(normalized);
  const sections = fillEstimates(normalized, DEFAULT_RIDE_SEC, model);
  const names = Array.from(new Set(sections.flatMap((s) => [s.from, s.to])));
  const ids = assignIds(names, registry);

  const lines = raw.lines.filter((l) => sections.some((s) => s.lineId === l.id)).map((l) => ({ ...l }));
  const lineIdx = new Map(lines.map((l, i) => [l.id, i]));
  const stationNames = [...names].sort((a, b) => ids[a].localeCompare(ids[b]));
  const stationIdx = new Map(stationNames.map((n, i) => [n, i]));

  const nodeKey = new Map<string, number>();
  const nodes: Graph['nodes'] = [];
  const nodeOf = (station: string, lineId: string): number => {
    const k = `${station}|${lineId}`;
    let i = nodeKey.get(k);
    if (i == null) {
      i = nodes.length;
      nodes.push({ stationIdx: stationIdx.get(station)!, lineIdx: lineIdx.get(lineId)! });
      nodeKey.set(k, i);
    }
    return i;
  };

  const edges: Edge[] = [];
  const edgeSeen = new Set<string>();
  const push = (e: Edge) => {
    const k = `${e.from}>${e.to}`;
    if (edgeSeen.has(k)) return;
    edgeSeen.add(k);
    edges.push(e);
  };
  for (const s of sections) {
    const a = nodeOf(s.from, s.lineId);
    const b = nodeOf(s.to, s.lineId);
    push({ from: a, to: b, sec: s.sec!, kind: 'ride', estimated: s.estimated });
    push({ from: b, to: a, sec: s.sec!, kind: 'ride', estimated: s.estimated });
  }

  // 환승: 원본 방향(A→B) 값을 쓰고, 반대 방향 값이 없으면 같은 값을 쓴다. 대기 가정을 더한다.
  const walk = new Map<string, number>();
  for (const t of raw.transfers) walk.set(`${normalizeName(t.station)}|${t.fromLine}|${t.toLine}`, t.sec);
  const linesAt = new Map<string, string[]>();
  for (const [k] of nodeKey) {
    const [st, line] = k.split('|');
    linesAt.set(st, [...(linesAt.get(st) ?? []), line]);
  }
  for (const [st, ls] of linesAt) {
    for (const a of ls) for (const b of ls) {
      if (a === b) continue;
      const known = walk.get(`${st}|${a}|${b}`) ?? walk.get(`${st}|${b}|${a}`);
      push({ from: nodeOf(st, a), to: nodeOf(st, b), sec: known != null ? known + TRANSFER_WAIT_SEC : DEFAULT_TRANSFER_SEC, kind: 'transfer', estimated: known == null });
    }
  }

  const graph: Graph = {
    version: 1,
    builtAt,
    demo: raw.demo,
    ...(raw.note ? { note: raw.note } : {}),
    sources: raw.sources,
    lines,
    stations: stationNames.map((n) => ({
      id: ids[n],
      name: n,
      aliases: Array.from(new Set([...(raw.aliases?.[n] ?? []), ...aliasesOf(n)])),
      lines: (linesAt.get(n) ?? []).slice().sort((a, b) => lineIdx.get(a)! - lineIdx.get(b)!),
      chosung: chosungOf(n),
    })),
    nodes,
    edges,
  };
  return { graph, registry: ids, model };
}

function findRaw(prefix: string): string {
  const f = readdirSync(RAW).find((n) => n.startsWith(prefix) && n.endsWith('.csv'));
  if (!f) throw new Error(`data-build/raw/ 에 ${prefix}* 파일이 없어요. npm run data:fetch 또는 docs/DATA_SOURCES.md 참고`);
  return join(RAW, f);
}

/** 실데이터(수도권): 서울교통공사 1~8호선(시간 실측) + 국가철도공단 거리(9호선·공항철도·코레일·에버라인) + 신분당선 역 순서 + 환승 보행시간 */
export function loadRealDataset(): RawDataset & { skippedTransferLines: string[] } {
  const metro = loadSeoulMetroRuntime(findRaw('OA-12034'));
  const l9 = { id: 'L9', name: '9호선', short: '9', operator: '서울시메트로9호선', color: '#C9A227' };
  const arex = { id: 'AREX', name: '공항철도', short: '공항', operator: '공항철도', color: '#3D7FB8' };
  const ever = { id: 'EL', name: '에버라인', short: '에버', operator: '용인경량전철', color: '#5BA55B' };
  const nine = loadLinearDistance(findRaw('15041298'), l9);
  const air = loadLinearDistance(findRaw('15041310'), arex);
  const everline = loadLinearDistance(findRaw('15081850'), ever);
  const korail = loadKorailDistance(findRaw('15081858'));
  const manual = loadManualLines(join(ROOT, 'data-build', 'fixtures', 'manual-lines.json'));
  const tr = loadMetroTransfers(findRaw('15044419'));
  // 시간표(TAGO)를 받아 두었으면 시간 없는 구간을 채운다(D-032). 이름 정규화가 끝난 구간에 적용
  const allSections = [...metro.sections, ...nine.sections, ...air.sections, ...korail.sections, ...everline.sections, ...manual.sections]
    .map((x) => ({ ...x, from: normalizeName(x.from), to: normalizeName(x.to) }));
  // 원본 시간표(raw/tago, git 제외)가 있으면 다시 뽑아 derived/에 저장, 없으면 저장된 결과를 쓴다(D-037)
  let derived: DerivedTago | null = null;
  const fresh = deriveTagoPairs(allSections, join(RAW, 'tago'));
  if (fresh) {
    derived = fresh.derived;
    mkdirSync(dirname(TAGO_DERIVED), { recursive: true });
    writeFileSync(TAGO_DERIVED, `${JSON.stringify(derived, null, 1)}\n`);
    console.log(`시간표에서 구간 시간 산출: ${Object.keys(derived.pairs).length}/${fresh.tried} → ${TAGO_DERIVED}`);
  } else if (existsSync(TAGO_DERIVED)) {
    derived = JSON.parse(readFileSync(TAGO_DERIVED, 'utf8')) as DerivedTago;
  }
  const applied = derived ? applyPairs(allSections, derived.pairs) : { sections: allSections, filled: 0 };
  const tago = { sections: applied.sections, filled: applied.filled, fetchedAt: derived?.fetchedAt ?? null };
  if (derived) console.log(`시간표 반영: ${tago.filled}개 구간 (수집 ${derived.fetchedAt})`);
  const aliases: Record<string, string[]> = { ...metro.aliases };
  for (const extra of [nine.aliases, air.aliases, everline.aliases, korail.aliases]) for (const [k, v] of Object.entries(extra)) aliases[k] = [...(aliases[k] ?? []), ...v];
  const krna = (id: string, name: string, baseDate: string) => ({ id, name, baseDate, license: '이용허락범위 제한 없음', attribution: '출처: 국가철도공단 (공공데이터포털) — 시간은 거리 기반 추정' });
  return {
    demo: false,
    lines: [...metro.lines, l9, arex, ...KORAIL_LINES, ...manual.lines, ever],
    sections: tago.sections,
    transfers: tr.transfers,
    aliases,
    skippedTransferLines: tr.skipped,
    note: tago.filled
      ? '서울교통공사 구간은 공식 운행시간, 나머지 노선은 국토교통부 평일 시간표로 계산했어요. 인천 1·2호선·GTX-A는 아직 지원하지 않아요.'
      : '9호선·공항철도·코레일 구간·신분당선·에버라인 시간은 거리 또는 평균값으로 추정했어요. 우이신설·신림·김포골드·인천 1·2호선·의정부·GTX-A는 아직 지원하지 않아요.',
    sources: [
      ...metro.sources,
      { id: '15044419', name: '서울교통공사_환승역거리 소요시간 정보', baseDate: '2026-08-31', license: '이용허락범위 제한 없음', attribution: '출처: 서울교통공사 (공공데이터포털)' },
      krna('15041298', '국가철도공단_수도권9호선_역간거리', '2026-06-30'),
      krna('15041310', '국가철도공단_공항철도_역간거리', '2026-06-30'),
      krna('15081858', '국가철도공단_코레일 역간거리', '2025-12-31'),
      krna('15081850', '국가철도공단_에버라인 역간거리', '2025-12-31'),
      ...(tago.filled ? [{ id: '15098554', name: '국토교통부_(TAGO)_지하철정보 시간표(평일)', baseDate: tago.fetchedAt!.slice(0, 10), license: '이용허락범위 제한 없음', attribution: '출처: 국토교통부 TAGO (공공데이터포털) — 시간표로 역간 시간 산출' }] : []),
      { id: 'manual', name: '신분당선·우이신설·신림·김포골드·의정부경전철·8호선 별내선·4호선 진접선 역 순서(운영사 공개 노선 정보, 수동 입력)', baseDate: '2026-10-30', license: '사실 정보(역 이름·순서)', attribution: tago.filled ? '이 노선들의 역 순서는 수동 입력, 시간은 국토교통부 시간표로 계산했어요.' : '신분당선 시간은 평균값으로 추정했어요.' },
    ],
  };
}

function main(): void {
  const demo = process.argv.includes('--demo');
  const raw = demo ? loadDemoLines(join(ROOT, 'data-build', 'fixtures', 'demo-lines.json')) : loadRealDataset();
  const registry = existsSync(IDS_PATH) ? (JSON.parse(readFileSync(IDS_PATH, 'utf8')) as Record<string, string>) : {};
  const { graph, registry: ids, model } = buildGraph(raw, registry, new Date().toISOString().slice(0, 10));
  const result = validateGraph(graph);
  for (const w of result.warnings) console.warn(`경고: ${w}`);
  if (result.errors.length) {
    for (const e of result.errors) console.error(`오류: ${e}`);
    process.exit(1);
  }
  const json = JSON.stringify(graph);
  writeFileSync(OUT, `${json}\n`);
  writeFileSync(IDS_PATH, `${JSON.stringify(ids, null, 1)}\n`);
  const skipped = 'skippedTransferLines' in raw ? (raw as { skippedTransferLines: string[] }).skippedTransferLines : [];
  writeFileSync(COVERAGE, coverageMarkdown(graph, Buffer.byteLength(json), model, skipped));
  console.log(`역 ${graph.stations.length} · 노드 ${graph.nodes.length} · 간선 ${graph.edges.length} · ${(Buffer.byteLength(json) / 1024).toFixed(1)} KB → ${OUT}`);
  if (model) console.log(`거리 모델: sec = ${model.a.toFixed(1)} + ${model.b.toFixed(1)}·km (실측 ${model.n}구간, 평균 오차 ${model.mae.toFixed(1)}초)`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
