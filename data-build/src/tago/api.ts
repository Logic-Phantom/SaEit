// 국토교통부_(TAGO)_지하철정보 (data.go.kr 15098554, 이용허락범위 제한 없음) 응답 형식.
// 필드는 포털 상세 페이지에 들어 있는 Swagger 2.0 정의로 확인(2026-10-30):
//   GetKwrdFndSubwaySttnList(subwayStationName) → item { subwayRouteName, subwayStationId, subwayStationName }
//   GetSubwaySttnAcctoSchdulList(subwayStationId, dailyTypeCode 01|02|03, upDownTypeCode U|D)
//     → item { subwayRouteId, subwayStationId, subwayStationNm, endSubwayStationId, endSubwayStationNm,
//              dailyTypeCode, upDownTypeCode, depTime(HHMISS), arrTime(HHMISS) }
// 열차 번호 필드는 없다 → 같은 종점으로 가는 열차를 인접 역끼리 짝지어 시간 차를 구한다(times.ts).
// 실제 응답 예시는 서비스 키로 처음 호출한 뒤 data-build/raw/tago/ 에서 확인하고 이 주석을 갱신한다.

export const TAGO_BASE = 'https://apis.data.go.kr/1613000/SubwayInfo';

export interface TagoStation { subwayRouteName: string; subwayStationId: string; subwayStationName: string }
export interface TagoSchedule {
  subwayRouteId: string;
  subwayStationId: string;
  subwayStationNm: string;
  endSubwayStationId: string;
  endSubwayStationNm: string;
  dailyTypeCode: string;
  upDownTypeCode: string;
  depTime: string;
  arrTime: string;
}

export interface TagoEnvelope<T> {
  response?: {
    header?: { resultCode?: string; resultMsg?: string };
    body?: { items?: { item?: T | T[] } | ''; totalCount?: string | number; numOfRows?: string | number; pageNo?: string | number };
  };
}

/** items.item 이 한 건이면 객체, 없으면 '' 로 오는 data.go.kr 관례를 배열로 맞춘다. */
export function itemsOf<T>(env: TagoEnvelope<T>): T[] {
  const items = env.response?.body?.items;
  if (!items || typeof items === 'string') return [];
  const it = items.item;
  if (it == null) return [];
  return Array.isArray(it) ? it : [it];
}

export function resultOf(env: TagoEnvelope<unknown>): { ok: boolean; code: string; msg: string; total: number } {
  const code = String(env.response?.header?.resultCode ?? '');
  return { ok: code === '00', code, msg: String(env.response?.header?.resultMsg ?? ''), total: Number(env.response?.body?.totalCount ?? 0) };
}

/** 'HHMISS' → 초. 새벽(00~03시) 열차는 전날 운행의 연장으로 24시간을 더한다. 빈 값·'0'은 null. */
export function hmsToSec(v: string | number | undefined): number | null {
  const s = String(v ?? '').trim();
  if (!/^\d{6}$/.test(s)) return null;
  let h = Number(s.slice(0, 2));
  const m = Number(s.slice(2, 4));
  const sec = Number(s.slice(4, 6));
  if (h < 3) h += 24;
  return h * 3600 + m * 60 + sec;
}

/** 노선 ID → TAGO subwayRouteName. 실제 이름 목록(2026-10-30 수집): 1호선~9호선, 공항, 수인분당, 경의중앙, 경춘, 경강, 서해선, 신분당, 에버라인 …
 *  '1호선'은 부산·대전 1호선도 같은 이름이고 '인천1호선'도 있으므로 완전 일치로 비교한다. */
export const ROUTE_NAME_PATTERNS: Record<string, RegExp> = {
  L1: /^1호선$/,
  L3: /^3호선$/,
  L4: /^4호선$/,
  L9: /^9호선$/,
  AREX: /^공항$/,
  SB: /^수인분당$/,
  GJ: /^경의중앙$/,
  GC: /^경춘$/,
  GG: /^경강$/,
  SH: /^서해선$/,
  SBD: /^신분당$/,
  EL: /^에버라인$/,
};

/** 수도권이 아닌 운영기관의 역 ID 접두어(같은 노선 이름 구분용). 확인: 부산 MTRBS·대전 MTRDJ·부산김해 MTRBG */
export const NON_CAPITAL_ID = /^MTR(BS|DJ|DG|GJ|BG)/;
