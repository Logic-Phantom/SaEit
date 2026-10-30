// 서울교통공사_역간거리 및 소요시간 (서울 열린데이터광장 OA-12034, 공공누리 1유형)
// 헤더: 연번, 호선, 역명, 소요시간(mm:ss, 앞 역에서 이 역까지), 역간거리(km), 호선별누계(km)
// 각 호선은 '00:00' 행에서 시작해 순서대로 이어진다. 지선은 본선 뒤에 이어 붙어 있어서, 지선 첫 역은
// 바로 앞 행이 아니라 분기역에서 출발한다 → BRANCH_FROM (원본 행 순서와 누계로 확인, 2026-10-30).
//  - 2호선 '시청'(두 번째)은 순환 닫힘(충정로 → 시청)이라 그대로 앞 행과 잇는다.
//  - 6호선 응암순환(응암 → … → 구산 → 응암)은 실제로 한 방향 운행이지만 MVP는 양방향으로 둔다(D-024).
import type { RawDataset, RawLine, RawSection } from '../types.ts';
import { columns, mmssToSec, readCsv } from '../csv.ts';
import { aliasesFromRaw, normalizeName } from '../normalize-station.ts';

export const METRO_LINES: RawLine[] = [
  { id: 'L1', name: '1호선', short: '1', operator: '서울교통공사', color: '#2F4FA8' },
  { id: 'L2', name: '2호선', short: '2', operator: '서울교통공사', color: '#2FA84F' },
  { id: 'L3', name: '3호선', short: '3', operator: '서울교통공사', color: '#F08A24' },
  { id: 'L4', name: '4호선', short: '4', operator: '서울교통공사', color: '#3FA9E0' },
  { id: 'L5', name: '5호선', short: '5', operator: '서울교통공사', color: '#8A5CD6' },
  { id: 'L6', name: '6호선', short: '6', operator: '서울교통공사', color: '#B5742F' },
  { id: 'L7', name: '7호선', short: '7', operator: '서울교통공사', color: '#6E7D2E' },
  { id: 'L8', name: '8호선', short: '8', operator: '서울교통공사', color: '#D9437A' },
];

/** `호선|지선 첫 역` → 분기역 */
const BRANCH_FROM: Record<string, string> = {
  '2|용답': '성수', // 성수지선
  '2|도림천': '신도림', // 신정지선
  '5|둔촌동': '강동', // 마천지선
};

export function loadSeoulMetroRuntime(path: string): RawDataset {
  const [header, ...rows] = readCsv(path);
  const [cLine, cName, cTime, cKm] = columns(header, ['호선', '역명', '소요시간', '역간거리(km)']);
  const sections: RawSection[] = [];
  const aliases: Record<string, string[]> = {};
  let prev: { line: string; name: string } | null = null;
  for (const r of rows) {
    const line = r[cLine].trim();
    const rawName = r[cName];
    const name = normalizeName(rawName);
    const extra = aliasesFromRaw(rawName);
    if (extra.length) aliases[name] = [...(aliases[name] ?? []), ...extra];
    const sec = mmssToSec(r[cTime]);
    if (!prev || prev.line !== line || sec === 0) {
      prev = { line, name }; // 호선 시작
      continue;
    }
    const from = BRANCH_FROM[`${line}|${name}`] ?? prev.name;
    sections.push({ lineId: `L${line}`, from, to: name, sec, km: Number(r[cKm]), estimated: false });
    prev = { line, name };
  }
  return {
    demo: false,
    lines: METRO_LINES,
    sections,
    transfers: [],
    aliases,
    sources: [{
      id: 'OA-12034',
      name: '서울교통공사_역간거리 및 소요시간',
      baseDate: '2024-08-10',
      license: '공공누리 제1유형',
      attribution: '출처: 서울교통공사, 공공누리 제1유형',
    }],
  };
}
