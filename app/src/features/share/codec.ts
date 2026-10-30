// 공유 링크 = 쿼리 문자열. 받은 링크는 신뢰하지 않는다: 버전·역ID 화이트리스트·인원·닉네임 규칙을 모두 통과해야 한다.
// 형식: v=1&s=S0012,S0450&n=민지,&m=all&t=1   (n·m·t 선택)
import { MAX_PARTICIPANTS, MIN_PARTICIPANTS } from '../../engine';

export interface SharePayload {
  v: 1;
  s: string[];
  n?: string[];
  /** 후보 범위: 생략 = 모이기 좋은 역, 'all' = 모든 역 */
  m?: 'all';
  /** 환승 적은 순 우선 */
  t?: boolean;
}

export const NICKNAME_MAX = 8;
const ID_RE = /^S\d{4}$/;
const NICK_RE = /^[가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9 ._-]+$/;

/** 닉네임 규칙: 8자 이하, 한글·영문·숫자·공백·. _ - 만, URL·전화번호 형태 거부. 빈 문자열은 '없음'으로 허용. */
export function nicknameError(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if ([...s].length > NICKNAME_MAX) return `닉네임은 ${NICKNAME_MAX}자까지 쓸 수 있어요.`;
  if (!NICK_RE.test(s)) return '닉네임에는 한글·영문·숫자만 쓸 수 있어요.';
  if (/(https?|www\.|\.com|\.kr)/i.test(s)) return '닉네임에 링크는 넣을 수 없어요.';
  if ((s.match(/\d/g) ?? []).length >= 7) return '닉네임에 전화번호는 넣을 수 없어요.';
  return null;
}

export function encodePayload(p: SharePayload): string {
  const q = new URLSearchParams();
  q.set('v', '1');
  q.set('s', p.s.join(','));
  if (p.n?.some((x) => x.trim())) q.set('n', p.n.map((x) => x.trim()).join(','));
  if (p.m === 'all') q.set('m', 'all');
  if (p.t) q.set('t', '1');
  return q.toString();
}

export function decodePayload(query: string | URLSearchParams, validIds: { has(id: string): boolean }): SharePayload | null {
  const q = typeof query === 'string' ? new URLSearchParams(query.replace(/^\?/, '')) : query;
  if (q.get('v') !== '1') return null;
  const s = (q.get('s') ?? '').split(',').filter(Boolean);
  if (s.length < MIN_PARTICIPANTS || s.length > MAX_PARTICIPANTS) return null;
  if (!s.every((id) => ID_RE.test(id) && validIds.has(id))) return null;
  const out: SharePayload = { v: 1, s };
  const nRaw = q.get('n');
  if (nRaw != null) {
    const n = nRaw.split(',');
    if (n.length !== s.length) return null;
    if (n.some((x) => nicknameError(x) != null)) return null;
    out.n = n.map((x) => x.trim());
  }
  const m = q.get('m');
  if (m != null && m !== 'all') return null;
  if (m === 'all') out.m = 'all';
  const t = q.get('t');
  if (t != null && t !== '1') return null;
  if (t === '1') out.t = true;
  return out;
}

/** 붙여넣은 텍스트에서 결과 쿼리 부분을 찾는다: intoss://saeit/result?…, https://…#/result?…, 또는 쿼리만. */
export function extractQuery(text: string): string | null {
  const t = text.trim();
  const m = /result\?([^\s#]+)/.exec(t) ?? /^\??(v=1&[^\s#]+)$/.exec(t);
  return m ? m[1] : null;
}
