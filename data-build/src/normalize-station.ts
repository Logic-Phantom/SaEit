// 역명 정규화와 초성 추출. 원본마다 표기가 달라(괄호 부역명, '역' 접미사, 공백) 같은 역을 한 이름으로 묶는다.
// 규칙(초안, Phase 0 실데이터로 보강):
//  1. 앞뒤·중간 공백 제거
//  2. 끝의 '역' 제거(단, '역' 한 글자이거나 '서울역'처럼 이름 자체에 포함된 경우는 유지 → EXCEPT_SUFFIX)
//  3. 괄호 부역명은 표시명에 유지하고, 괄호 앞·안의 이름을 별칭(aliases)으로 등록 → '총신대입구(이수)'는 '총신대입구', '이수'로도 검색
//  4. 동명이역(다른 도시·다른 역이 같은 이름)은 원본의 운영사·노선으로 구분해야 하므로 Phase 0에서 수동 매핑 표를 둔다

const EXCEPT_SUFFIX = new Set(['서울역']);

export function normalizeName(raw: string): string {
  let s = raw.replace(/\s+/g, '');
  if (s.length > 1 && s.endsWith('역') && !EXCEPT_SUFFIX.has(s) && !s.endsWith(')역')) s = s.slice(0, -1);
  if (s.endsWith(')역')) s = s.slice(0, -1);
  return s;
}

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
