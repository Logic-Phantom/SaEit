// 국가철도공단_<노선>_역간거리 (data.go.kr, 이용허락범위 제한 없음) — 시간 없이 거리(km)만 있다.
// 확인한 형식(2026-10-30): 헤더 철도운영기관명, 선명, 역명, 역간거리[, 후행역간거리]. 행은 노선 순서이고
// '역간거리'는 그 역에서 **다음 역까지**(마지막 역은 빈 값). 공항철도 파일의 '후행역간거리'가 바로 앞 행의 역간거리와 같아 확인됨.
// 분기가 없는 단일 노선 파일(9호선·공항철도)만 이 어댑터를 쓴다. 코레일 통합 파일은 분기·구간 생략 표기가 섞여 있어 별도 해석이 필요(D-025).
import type { RawLine, RawSection } from '../types.ts';
import { readCsv } from '../csv.ts';
import { aliasesFromRaw, normalizeName } from '../normalize-station.ts';

export function loadLinearDistance(path: string, line: RawLine): { sections: RawSection[]; aliases: Record<string, string[]> } {
  const [header, ...rows] = readCsv(path);
  const cName = header.findIndex((h) => h.trim() === '역명');
  const cKm = header.findIndex((h) => /^역간거리/.test(h.trim()));
  if (cName < 0 || cKm < 0) throw new Error(`역명/역간거리 열 없음: ${header.join(', ')}`);
  const aliases: Record<string, string[]> = {};
  const names = rows.map((r) => {
    const n = normalizeName(r[cName]);
    const extra = aliasesFromRaw(r[cName]);
    if (extra.length) aliases[n] = [...(aliases[n] ?? []), ...extra];
    return n;
  });
  const sections: RawSection[] = [];
  for (let i = 0; i + 1 < rows.length; i++) {
    const km = Number(rows[i][cKm]);
    if (!(km > 0)) throw new Error(`${line.name} ${names[i]} 역간거리 값 이상: '${rows[i][cKm]}'`);
    sections.push({ lineId: line.id, from: names[i], to: names[i + 1], sec: null, km, estimated: true });
  }
  return { sections, aliases };
}
