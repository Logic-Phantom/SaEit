// 진입 스킴 URL(Environment.initialURL) → 앱 안 화면. 공유 결과 링크와 콘솔 '주요 기능' 링크를 처리한다.
import { validStationIds } from '../../data/graph';
import { decodePayload, encodePayload, extractQuery } from './codec';

/** 콘솔 '주요 기능'에 등록할 수 있는 진입 경로(intoss://saeit/<경로>). 쿼리 없는 화면만 허용 */
export const ENTRY_PATHS = new Set(['input', 'join', 'history', 'settings']);

/** 결과 링크는 검증을 통과해야 하고, 그 밖은 허용 목록만. 실패하면 null(홈 그대로) */
export function entryTarget(url: string): string | null {
  const q = extractQuery(url);
  if (q) {
    const p = decodePayload(q, validStationIds);
    return p ? `/result?${encodePayload(p)}` : null;
  }
  const m = /^intoss(?:-private)?:\/\/[^/?#]+\/([a-z]+)\/?(?:[?#].*)?$/.exec(url.trim());
  return m && ENTRY_PATHS.has(m[1]) ? `/${m[1]}` : null;
}
