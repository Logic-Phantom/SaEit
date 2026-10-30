// 데모 어댑터: fixtures/demo-lines.json(역 순서만 있는 목록) → RawDataset.
// 실제 소스 어댑터(seoul-sections.ts 등)는 Phase 0에서 원본 파일의 컬럼을 확인한 뒤 같은 RawDataset을 내놓도록 추가한다.
import { readFileSync } from 'node:fs';
import type { RawDataset, RawSection } from '../types.ts';

interface DemoFile {
  defaultRideSec: number;
  lines: { id: string; name: string; short: string; operator: string; color: string; loop?: boolean; branches: string[][] }[];
}

export function loadDemoLines(path: string): RawDataset {
  const file = JSON.parse(readFileSync(path, 'utf8')) as DemoFile;
  const sections: RawSection[] = [];
  for (const line of file.lines) {
    for (const branch of line.branches) {
      for (let i = 0; i + 1 < branch.length; i++) sections.push({ lineId: line.id, from: branch[i], to: branch[i + 1], sec: null, estimated: true });
      if (line.loop) sections.push({ lineId: line.id, from: branch[branch.length - 1], to: branch[0], sec: null, estimated: true });
    }
  }
  return {
    demo: true,
    lines: file.lines.map(({ id, name, short, operator, color }) => ({ id, name, short, operator, color })),
    sections,
    transfers: [], // 환승 데이터 없음 → build-graph가 기본값(defaultTransferSec, estimated)으로 채운다
    sources: [
      {
        id: 'demo',
        name: '사잇 데모 노선 목록 (역 순서만, 시간 균일 추정)',
        baseDate: '2026-10-30',
        license: '데모 데이터 — 출시 전 공공데이터로 교체',
        attribution: '데모 데이터: 실제 소요시간이 아니에요.',
      },
    ],
  };
}
