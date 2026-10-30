// 역명 정규화와 초성 추출. 원본마다 표기가 달라(괄호 부역명, '역' 접미사, 공백) 같은 역을 한 이름으로 묶는다.
// 규칙 (Phase 0, 2026-10-30 원본 확인 후):
//  1. 공백 제거 ('미아사거리 ' → '미아사거리')
//  2. 끝의 '역' 제거 ('신내역' → '신내'). 단 '서울역'은 이름 자체라 유지
//  3. 괄호 부역명은 대표명에서 떼어 별칭으로 ('흑석(중앙대입구)' → '흑석', 별칭 '중앙대입구')
//  4. 같은 역인데 노선마다 이름이 다른 경우는 SAME_STATION 수동 매핑 (7호선 '이수' = 4호선 '총신대입구')
//  5. 동명이역(다른 장소가 같은 이름, 예: 5호선 양평 ↔ 경의중앙선 양평, 2호선 신촌 ↔ 경의중앙선 신촌)은
//     지금 포함한 노선 범위에는 없다. 코레일 노선을 넣을 때 DISTINCT_STATION 표로 구분해야 한다.

const KEEP_SUFFIX = new Set(['서울역']);

/** 다른 이름 → 대표 이름. 대표 이름은 별칭으로 원래 이름을 갖는다. */
export const SAME_STATION: Record<string, string> = {
  이수: '총신대입구',
};

/** 동명이역: `노선ID|이름` → 구분된 표시명. 표시명은 괄호를 그대로 둔다. */
export const DISTINCT_STATION: Record<string, string> = {
  'GJ|양평': '양평(경의중앙선)', // 5호선 양평(영등포구)과 다른 역(양평군)
  'GJ|신촌': '신촌(경의중앙선)', // 2호선 신촌과 다른 역
};
const DISTINCT_NAMES = new Set(Object.values(DISTINCT_STATION));

export function splitName(raw: string): { name: string; sub: string | null } {
  let s = raw.replace(/\s+/g, '');
  if (DISTINCT_NAMES.has(s)) return { name: s, sub: null };
  let sub: string | null = null;
  const m = /^(.+?)\((.+)\)(역)?$/.exec(s);
  if (m) {
    s = m[1];
    sub = m[2];
  }
  if (s.length > 1 && s.endsWith('역') && !KEEP_SUFFIX.has(s)) s = s.slice(0, -1);
  return { name: s, sub };
}

/** 표시·매칭용 대표 이름. lineId를 주면 동명이역 표를 적용한다. */
export function normalizeName(raw: string, lineId?: string): string {
  const { name } = splitName(raw);
  if (lineId && DISTINCT_STATION[`${lineId}|${name}`]) return DISTINCT_STATION[`${lineId}|${name}`];
  return SAME_STATION[name] ?? name;
}

/** 원본 이름에서 나오는 별칭(부역명, 매핑 전 이름) */
export function aliasesFromRaw(raw: string): string[] {
  const { name, sub } = splitName(raw);
  const out: string[] = [];
  if (sub) out.push(...sub.split(/[.·]/).filter(Boolean));
  if (SAME_STATION[name]) out.push(name);
  return out;
}

/** 데모 목록 호환: '총신대입구(이수)' 같은 표시명의 별칭 */
export function aliasesOf(name: string): string[] {
  const m = /^(.+?)\((.+)\)$/.exec(name);
  if (!m) return [];
  return [m[1], m[2]];
}

const CHOSUNG = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

/** 한글 음절은 초성으로, 그 외 글자는 그대로. 괄호는 제거해 '총신대입구(이수)' → 'ㅊㅅㄷㅇㄱㅇㅅ'. */
export function chosungOf(text: string): string {
  let out = '';
  for (const ch of text) {
    const code = ch.charCodeAt(0) - 0xac00;
    if (code >= 0 && code < 11172) out += CHOSUNG[Math.floor(code / 588)];
    else if (ch !== '(' && ch !== ')') out += ch;
  }
  return out;
}
