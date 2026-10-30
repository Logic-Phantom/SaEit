// docs/COVERAGE.md 생성: 노선별 역 수, 시간 데이터 보유율(실측 비율), 추정 구간 수, 그래프 크기, 미포함 노선.
import type { DistanceModel } from './estimate.ts';
import type { Graph } from './types.ts';

/** 프롬프트 §8 Phase 0 게이트 대상 노선. 그래프에 없으면 보유율 0%로 본다. */
export const GATE_LINES = ['1호선', '2호선', '3호선', '4호선', '5호선', '6호선', '7호선', '8호선', '9호선', '신분당선', '수인분당선', '경의중앙선', '공항철도'];

export function coverageMarkdown(g: Graph, bytes: number, model: DistanceModel | null = null, skippedTransferLines: string[] = []): string {
  const stats = g.lines.map((line, li) => {
    const stations = new Set(g.nodes.filter((n) => n.lineIdx === li).map((n) => n.stationIdx));
    const rides = g.edges.filter((e) => e.kind === 'ride' && g.nodes[e.from].lineIdx === li);
    const measured = rides.filter((e) => !e.estimated).length;
    return { name: line.name, operator: line.operator, stations: stations.size, sections: rides.length / 2, pct: rides.length ? Math.round((measured / rides.length) * 100) : 0, est: (rides.length - measured) / 2 };
  });
  const transfers = g.edges.filter((e) => e.kind === 'transfer');
  const gate = GATE_LINES.map((name) => {
    const s = stats.find((x) => x.name === name);
    return { name, pct: s?.pct ?? 0, note: s ? '' : '그래프에 없음' };
  });
  const failing = gate.filter((x) => x.pct < 80);
  return [
    '# 데이터 커버리지 (자동 생성)',
    '',
    '> `npm run data:build`가 만든 파일이다. 손으로 고치지 않는다.',
    '',
    `- 그래프 버전: v${g.version} · 빌드: ${g.builtAt}${g.demo ? ' · **데모 데이터(시간 전부 추정)**' : ''}`,
    `- 역 ${g.stations.length}개 · 노드 ${g.nodes.length}개 · 간선 ${g.edges.length}개 (환승 ${transfers.length}개, 그중 기본값 ${transfers.filter((e) => e.estimated).length}개)`,
    `- graph JSON 크기: ${(bytes / 1024).toFixed(1)} KB (gzip 전, 목표 ≤ 250 KB)`,
    model ? `- 거리 기반 추정 모델: 소요시간(초) = ${model.a.toFixed(1)} + ${model.b.toFixed(1)} × 거리(km) — 실측 ${model.n}구간으로 적합, 실측 대비 평균 절대 오차 ${model.mae.toFixed(1)}초` : '- 거리 기반 추정 모델: 없음',
    `- 소스: ${g.sources.map((s) => `${s.name} (${s.baseDate})`).join(', ')}`,
    skippedTransferLines.length ? `- 환승 데이터 중 그래프에 없는 노선(건너뜀): ${skippedTransferLines.join(', ')}` : '',
    '',
    '## 노선별',
    '',
    '| 노선 | 운영 | 역 수 | 구간 수 | 시간 데이터 보유율 | 추정 구간 |',
    '|---|---|---|---|---|---|',
    ...stats.map((s) => `| ${s.name} | ${s.operator} | ${s.stations} | ${s.sections} | ${s.pct}% | ${s.est} |`),
    '',
    '## Phase 0 게이트 (주요 노선 시간 데이터 보유율 ≥ 80%)',
    '',
    '| 노선 | 보유율 | 판정 |',
    '|---|---|---|',
    ...gate.map((x) => `| ${x.name} | ${x.pct}% | ${x.pct >= 80 ? '통과' : `미달${x.note ? ` (${x.note})` : ''}`} |`),
    '',
    failing.length ? `**판정: 미달 ${failing.length}개 노선** — ${failing.map((x) => x.name).join(', ')}` : '**판정: 통과**',
    '',
  ].filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n');
}
