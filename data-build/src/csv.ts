// 공공데이터 CSV 읽기: 원본은 대부분 CP949(EUC-KR). BOM 있는 UTF-8이면 그대로 읽는다.
import { readFileSync } from 'node:fs';

export function readCsv(path: string): string[][] {
  const buf = readFileSync(path);
  const text = buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf ? buf.subarray(3).toString('utf8') : new TextDecoder('euc-kr').decode(buf);
  return parseCsv(text);
}

/** RFC 4180 수준의 작은 파서(따옴표 안 쉼표·줄바꿈 처리). 빈 줄은 버린다. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c !== '')) rows.push(row);
  return rows;
}

/** 헤더 이름으로 열 찾기. 없으면 throw(원본 형식이 바뀌면 조용히 틀리지 않도록). */
export function columns(header: string[], names: string[]): number[] {
  return names.map((n) => {
    const i = header.findIndex((h) => h.trim() === n);
    if (i < 0) throw new Error(`CSV 열 없음: ${n} (헤더: ${header.join(', ')})`);
    return i;
  });
}

/** "02:13" → 133초 */
export function mmssToSec(s: string): number {
  const m = /^(\d+):(\d{2})$/.exec(s.trim());
  if (!m) throw new Error(`시간 형식 오류: ${s}`);
  return Number(m[1]) * 60 + Number(m[2]);
}
