// 역 검색: 초성만 입력하면 초성 일치, 그 외엔 이름·별칭 부분 일치. 정확 > 접두 > 포함 순, 같은 순위는 이름순.
import type { Station } from '../../engine';

const CHOSUNG_ONLY = /^[ㄱ-ㅎ]+$/;

export function searchStations(stations: Station[], query: string, limit = 30): number[] {
  const q = query.replace(/\s+/g, '').replace(/역$/, '');
  if (!q) return [];
  const chosung = CHOSUNG_ONLY.test(q);
  const scored: { i: number; rank: number }[] = [];
  stations.forEach((st, i) => {
    const hay = chosung ? [st.chosung] : [st.name, ...st.aliases];
    let rank = Infinity;
    for (const h of hay) {
      if (h === q) rank = Math.min(rank, 0);
      else if (h.startsWith(q)) rank = Math.min(rank, 1);
      else if (h.includes(q)) rank = Math.min(rank, 2);
    }
    if (rank < Infinity) scored.push({ i, rank });
  });
  scored.sort((a, b) => a.rank - b.rank || stations[a.i].name.localeCompare(stations[b.i].name, 'ko'));
  return scored.slice(0, limit).map((x) => x.i);
}
