// raw → 정규화 → 그래프 → 검증 → app/src/data/graph.v1.json + docs/COVERAGE.md
// 사용: npm run data:build  (기본 입력은 데모 노선 목록. Phase 0 이후 실데이터 어댑터로 교체)
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fillEstimates } from './estimate.ts';
import { aliasesOf, chosungOf, normalizeName } from './normalize-station.ts';
import { coverageMarkdown } from './report.ts';
import { loadDemoLines } from './sources/demo-lines.ts';
import type { Edge, Graph, RawDataset } from './types.ts';
import { validateGraph } from './validate.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const IDS_PATH = join(ROOT, 'data-build', 'station-ids.json');
const OUT = join(ROOT, 'app', 'src', 'data', 'graph.v1.json');
const COVERAGE = join(ROOT, 'docs', 'COVERAGE.md');
const DEFAULT_TRANSFER_SEC = 300;
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

export function buildGraph(raw: RawDataset, registry: Record<string, string>, builtAt: string): { graph: Graph; registry: Record<string, string> } {
  const sections = fillEstimates(
    raw.sections.map((s) => ({ ...s, from: normalizeName(s.from), to: normalizeName(s.to) })),
    DEFAULT_RIDE_SEC,
  );
  const names = Array.from(new Set(sections.flatMap((s) => [s.from, s.to])));
  const ids = assignIds(names, registry);

  const lines = raw.lines.map((l) => ({ ...l }));
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

  const transferSec = new Map(raw.transfers.map((t) => [`${normalizeName(t.station)}|${t.fromLine}|${t.toLine}`, t.sec]));
  const linesAt = new Map<string, string[]>();
  for (const [k] of nodeKey) {
    const [st, line] = k.split('|');
    linesAt.set(st, [...(linesAt.get(st) ?? []), line]);
  }
  for (const [st, ls] of linesAt) {
    for (const a of ls) for (const b of ls) {
      if (a === b) continue;
      const known = transferSec.get(`${st}|${a}|${b}`);
      push({ from: nodeOf(st, a), to: nodeOf(st, b), sec: known ?? DEFAULT_TRANSFER_SEC, kind: 'transfer', estimated: known == null });
    }
  }

  const graph: Graph = {
    version: 1,
    builtAt,
    demo: raw.demo,
    sources: raw.sources,
    lines,
    stations: stationNames.map((n) => ({
      id: ids[n],
      name: n,
      aliases: aliasesOf(n),
      lines: (linesAt.get(n) ?? []).slice().sort((a, b) => lineIdx.get(a)! - lineIdx.get(b)!),
      chosung: chosungOf(n),
    })),
    nodes,
    edges,
  };
  return { graph, registry: ids };
}

function main(): void {
  const raw = loadDemoLines(join(ROOT, 'data-build', 'fixtures', 'demo-lines.json'));
  const registry = existsSync(IDS_PATH) ? (JSON.parse(readFileSync(IDS_PATH, 'utf8')) as Record<string, string>) : {};
  const { graph, registry: ids } = buildGraph(raw, registry, new Date().toISOString().slice(0, 10));
  const result = validateGraph(graph);
  for (const w of result.warnings) console.warn(`경고: ${w}`);
  if (result.errors.length) {
    for (const e of result.errors) console.error(`오류: ${e}`);
    process.exit(1);
  }
  const json = JSON.stringify(graph);
  writeFileSync(OUT, `${json}\n`);
  writeFileSync(IDS_PATH, `${JSON.stringify(ids, null, 1)}\n`);
  writeFileSync(COVERAGE, coverageMarkdown(graph, Buffer.byteLength(json)));
  console.log(`역 ${graph.stations.length} · 노드 ${graph.nodes.length} · 간선 ${graph.edges.length} · ${(Buffer.byteLength(json) / 1024).toFixed(1)} KB → ${OUT}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
