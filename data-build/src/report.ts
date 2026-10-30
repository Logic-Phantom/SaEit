// docs/COVERAGE.md 생성: 노선별 역 수, 시간 데이터 보유율(실측 비율), 추정 구간 수, 그래프 크기.
import type { Graph } from './types.ts';

export function coverageMarkdown(g: Graph, bytes: number): string {
  const rows = g.lines.map((line, li) => {
    const stations = new Set(g.nodes.filter((n) => n.lineIdx === li).map((n) => n.stationIdx));
    const rides = g.edges.filter((e) => e.kind === 'ride' && g.nodes[e.from].lineIdx === li);
    const measured = rides.filter((e) => !e.estimated).length;
    const pct = rides.length ? Math.round((measured / rides.length) * 100) : 0;
    return `| ${line.name} | ${line.operator} | ${stations.size} | ${rides.length / 2} | ${pct}% | ${(rides.length - measured) / 2} |`;
  });
  const transfers = g.edges.filter((e) => e.kind === 'transfer');
  return [
    '# 데이터 커버리지 (자동 생성)',
    '',
    '> `npm run data:build`가 만든 파일이다. 손으로 고치지 않는다.',
    '',
    `- 그래프 버전: v${g.version} · 빌드: ${g.builtAt}${g.demo ? ' · **데모 데이터(시간 전부 추정)**' : ''}`,
    `- 역 ${g.stations.length}개 · 노드 ${g.nodes.length}개 · 간선 ${g.edges.length}개 (환승 ${transfers.length}개, 추정 ${transfers.filter((e) => e.estimated).length}개)`,
    `- graph JSON 크기: ${(bytes / 1024).toFixed(1)} KB (gzip 전, 목표 ≤ 250 KB)`,
    `- 소스: ${g.sources.map((s) => `${s.name} (${s.baseDate})`).join(', ')}`,
    '',
    '| 노선 | 운영 | 역 수 | 구간 수 | 시간 데이터 보유율 | 추정 구간 |',
    '|---|---|---|---|---|---|',
    ...rows,
    '',
  ].join('\n');
}
