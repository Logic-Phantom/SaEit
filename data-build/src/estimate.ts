// 시간 없는 구간 추정. 같은 노선에 실측 구간이 있으면 그 평균, 없으면 기본값. 추정 구간은 항상 estimated=true.
// Phase 0: 거리(km)가 있는 소스는 노선별 평균속도(실측 구간의 km/분)로 바꾼다.
import type { RawSection } from './types.ts';

export function fillEstimates(sections: RawSection[], defaultSec: number): RawSection[] {
  const sum = new Map<string, { total: number; n: number }>();
  for (const s of sections) {
    if (s.sec == null || s.estimated) continue;
    const acc = sum.get(s.lineId) ?? { total: 0, n: 0 };
    acc.total += s.sec;
    acc.n += 1;
    sum.set(s.lineId, acc);
  }
  return sections.map((s) => {
    if (s.sec != null) return s;
    const acc = sum.get(s.lineId);
    return { ...s, sec: acc ? Math.round(acc.total / acc.n) : defaultSec, estimated: true };
  });
}
