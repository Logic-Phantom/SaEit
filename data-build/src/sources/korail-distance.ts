// 국가철도공단_코레일 역간거리 (data.go.kr 15081858, 이용허락범위 제한 없음) — 수도권 코레일 노선, 거리(km)만.
// 원본 형식(2026-10-30 확인): 헤더 철도운영기관명, 선명, 역명, 역간거리(km). '선명'별 행이 노선 순서이고 값은 **다음 역까지** 거리.
// 그런데 노선마다 형식이 달라 규칙 없이 이으면 잘못된 인접 관계가 생긴다(D-025):
//  1. 1호선은 '경인선·광명선·서동탄선·경부선' 묶음마다 연천부터 전체를 반복 → 같은 구간은 한 번만 쓴다.
//  2. 서울교통공사 구간(서울역~청량리)은 생략돼 '회기 → 남영'처럼 이어진다 → GAP_FIX로 끊고 실제 연결을 넣는다.
//  3. 묶음의 마지막 역에 값이 있으면, 바로 앞 역이 분기역일 때 '분기역 → 마지막 역' 거리다(광명 4.7, 서동탄 2.2, 광운대 4.9).
//     분기역 자신의 값은 본선 다음 역까지다. 분기역에서 본선 쪽이 둘 이상이면(구로: 구일·가산디지털단지) 거리를 비운다.
//  4. 값이 빈 행은 그 묶음의 끝(다음 행은 다른 지선의 시작).
//  5. 동명이역은 노선을 붙인 이름으로 구분(DISTINCT_STATION).
import type { RawLine, RawSection } from '../types.ts';
import { columns, readCsv } from '../csv.ts';
import { aliasesFromRaw, normalizeName } from '../normalize-station.ts';

export const KORAIL_LINES: RawLine[] = [
  { id: 'SB', name: '수인분당선', short: '수인분당', operator: '코레일', color: '#D9A400' },
  { id: 'GJ', name: '경의중앙선', short: '경의중앙', operator: '코레일', color: '#5FAE96' },
  { id: 'GC', name: '경춘선', short: '경춘', operator: '코레일', color: '#2E8C7E' },
  { id: 'GG', name: '경강선', short: '경강', operator: '코레일', color: '#3E6FD8' },
  { id: 'SH', name: '서해선', short: '서해', operator: '코레일', color: '#7AA33A' },
];

/** 원본 '선명' → 그래프 노선 ID. 없는 선명(동해·대경선 = 부산·대구권)은 쓰지 않는다. */
export const GROUP_LINE: Record<string, string> = {
  '1호선(경인선)': 'L1', '1호선(광명선)': 'L1', '1호선(서동탄선)': 'L1', '1호선(경부선)': 'L1',
  '3호선': 'L3', '4호선': 'L4',
  수인분당: 'SB', 경의중앙: 'GJ', 경춘: 'GC', 경강: 'GG', 서해선: 'SH',
};

/** 생략·지선 때문에 잘못 이어지는 쌍 제거와 실제 연결 추가. km는 근거가 있는 경우만(원본 행 값), 없으면 null → 추정 */
export const GAP_FIX: { lineId: string; remove?: [string, string]; add?: { from: string; to: string; km: number | null; why: string }[] }[] = [
  { lineId: 'L1', remove: ['회기', '남영'], add: [
    { from: '회기', to: '청량리', km: 1.4, why: '원본 회기 행 값(다음 역 = 서울교통공사 구간 시작 청량리)' },
    { from: '서울역', to: '남영', km: null, why: '원본에 없음(서울역은 서울교통공사 구간 끝)' },
  ] },
  { lineId: 'L3', add: [{ from: '삼송', to: '지축', km: 1.7, why: '원본 삼송 행 값(다음 역 = 서울교통공사 구간 시작 지축)' }] },
  { lineId: 'L4', add: [{ from: '남태령', to: '선바위', km: null, why: '원본에 없음(남태령은 서울교통공사 구간 끝)' }] },
  { lineId: 'GJ', remove: ['지평', '신촌(경의중앙선)'], add: [
    { from: '가좌', to: '신촌(경의중앙선)', km: null, why: '경의선 서울역 지선 분기(가좌). 원본 가좌 값은 본선 홍대입구까지' },
    { from: '신촌(경의중앙선)', to: '서울역', km: 3.1, why: '원본 신촌 행 값' },
  ] },
];

export function loadKorailDistance(path: string): { sections: RawSection[]; aliases: Record<string, string[]> } {
  const [header, ...rows] = readCsv(path);
  const [cGroup, cName, cKm] = columns(header, ['선명', '역명', '역간거리(km)']);
  const aliases: Record<string, string[]> = {};

  // 묶음별 (역, 값) 목록
  const groups = new Map<string, { name: string; km: number | null }[]>();
  for (const r of rows) {
    const lineId = GROUP_LINE[r[cGroup].trim()];
    if (!lineId) continue;
    const name = normalizeName(r[cName], lineId);
    const extra = aliasesFromRaw(r[cName]);
    if (extra.length) aliases[name] = [...(aliases[name] ?? []), ...extra];
    const v = r[cKm].trim();
    const list = groups.get(r[cGroup].trim()) ?? [];
    list.push({ name, km: v === '' ? null : Number(v) });
    groups.set(r[cGroup].trim(), list);
  }

  // 연속 행 쌍(값이 빈 행 다음은 끊김). 거리는 아래에서 정한다.
  type Pair = { lineId: string; from: string; to: string; km: number | null };
  const raw: (Pair & { fromKm: number; lastKm: number | null })[] = [];
  for (const [group, list] of groups) {
    const lineId = GROUP_LINE[group];
    for (let i = 0; i + 1 < list.length; i++) {
      if (list[i].km == null) continue;
      const isLast = i + 1 === list.length - 1;
      raw.push({ lineId, from: list[i].name, to: list[i + 1].name, km: null, fromKm: list[i].km!, lastKm: isLast ? list[i + 1].km : null });
    }
  }
  const succ = new Map<string, Set<string>>();
  for (const p of raw) succ.set(`${p.lineId}|${p.from}`, (succ.get(`${p.lineId}|${p.from}`) ?? new Set()).add(p.to));
  const isBranch = (lineId: string, st: string) => (succ.get(`${lineId}|${st}`)?.size ?? 0) >= 2;
  // 분기역 → 지선 마지막 역: 마지막 행 값(규칙 3)
  const tail = new Set(raw.filter((p) => p.lastKm != null && isBranch(p.lineId, p.from)).map((p) => `${p.lineId}|${p.from}|${p.to}`));
  const pairs: Pair[] = raw.map((p) => {
    const k = `${p.lineId}|${p.from}|${p.to}`;
    if (tail.has(k)) return { ...p, km: p.lastKm };
    if (!isBranch(p.lineId, p.from)) return { ...p, km: p.fromKm };
    // 분기역의 본선 쪽: 지선(tail) 말고 남은 다음 역이 하나뿐이면 그 역 값, 아니면 비움
    const rest = [...succ.get(`${p.lineId}|${p.from}`)!].filter((to) => !tail.has(`${p.lineId}|${p.from}|${to}`));
    return { ...p, km: rest.length === 1 ? p.fromKm : null };
  });

  // 중복 제거(같은 노선·같은 쌍은 한 번, 거리 있는 값 우선)
  const byKey = new Map<string, Pair>();
  for (const p of pairs) {
    const k = `${p.lineId}|${p.from}|${p.to}`;
    const old = byKey.get(k);
    if (!old || (old.km == null && p.km != null)) byKey.set(k, { lineId: p.lineId, from: p.from, to: p.to, km: p.km });
  }
  const present = new Set(pairs.map((x) => x.lineId));
  for (const fix of GAP_FIX) {
    if (!present.has(fix.lineId)) continue; // 원본에 그 노선이 없으면(형식 변경 등) 보정하지 않는다
    if (fix.remove) byKey.delete(`${fix.lineId}|${fix.remove[0]}|${fix.remove[1]}`);
    for (const a of fix.add ?? []) byKey.set(`${fix.lineId}|${a.from}|${a.to}`, { lineId: fix.lineId, from: a.from, to: a.to, km: a.km });
  }

  const sections: RawSection[] = [...byKey.values()].map((p) => ({ lineId: p.lineId, from: p.from, to: p.to, sec: null, ...(p.km != null ? { km: p.km } : {}), estimated: true }));
  return { sections, aliases };
}
