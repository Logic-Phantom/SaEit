// 서울교통공사_환승역거리 소요시간 정보 (data.go.kr 15044419, 이용허락범위 제한 없음)
// 헤더: 연번, 호선(숫자), 환승역명, 환승노선('4호선', '공항철도', '경의중앙선' …), 환승거리(m), 환승소요시간(mm:ss, 보행 1.2m/s 기준)
// 그래프에 없는 노선으로의 환승과 같은 호선 안 환승(성수·신도림·강동 지선 갈아타기)은 건너뛴다.
import type { RawTransfer } from '../types.ts';
import { columns, mmssToSec, readCsv } from '../csv.ts';
import { normalizeName } from '../normalize-station.ts';

const LINE_NAME_TO_ID: Record<string, string> = {
  '1호선': 'L1', '2호선': 'L2', '3호선': 'L3', '4호선': 'L4', '5호선': 'L5', '6호선': 'L6', '7호선': 'L7', '8호선': 'L8',
  '9호선': 'L9', 공항철도: 'AREX',
  경의중앙선: 'GJ', 수인분당선: 'SB', 경춘선: 'GC', 서해선: 'SH', 신분당선: 'SBD',
  경원선: 'L1', // 석계(6호선) ↔ 경원선 = 코레일 1호선 구간
};

export function loadMetroTransfers(path: string): { transfers: RawTransfer[]; skipped: string[] } {
  const [header, ...rows] = readCsv(path);
  const [cLine, cStation, cTo, cTime] = columns(header, ['호선', '환승역명', '환승노선', '환승소요시간']);
  const transfers: RawTransfer[] = [];
  const skipped = new Set<string>();
  for (const r of rows) {
    const fromLine = `L${r[cLine].trim()}`;
    const toLine = LINE_NAME_TO_ID[r[cTo].trim()];
    if (!toLine) { skipped.add(r[cTo].trim()); continue; }
    if (toLine === fromLine) continue;
    transfers.push({ station: normalizeName(r[cStation]), fromLine, toLine, sec: mmssToSec(r[cTime]) });
  }
  return { transfers, skipped: [...skipped].sort() };
}
