// 공공데이터 파일이 없는 노선(신분당선 등)의 역 순서 수동 목록 → 시간·거리 없는 구간(estimated).
// 시간은 시간표(TAGO) 수집 후 tago-times.ts가 채운다.
import { readFileSync } from 'node:fs';
import type { RawLine, RawSection } from '../types.ts';
import { normalizeName } from '../normalize-station.ts';

interface ManualFile { lines: (RawLine & { stations: string[]; checked: string; extendsLine?: boolean })[] }

export function loadManualLines(path: string): { lines: RawLine[]; sections: RawSection[] } {
  const file = JSON.parse(readFileSync(path, 'utf8')) as ManualFile;
  const sections: RawSection[] = [];
  for (const l of file.lines) {
    const names = l.stations.map((s) => normalizeName(s, l.id));
    for (let i = 0; i + 1 < names.length; i++) sections.push({ lineId: l.id, from: names[i], to: names[i + 1], sec: null, estimated: true });
  }
  // 연장 구간(extendsLine)은 기존 노선에 구간만 더한다
  const lines = file.lines.filter((l) => !l.extendsLine).map(({ id, name, short, operator, color }) => ({ id, name, short, operator, color }));
  return { lines, sections };
}
