// 시간 없는 구간 추정. 추정 구간은 항상 estimated=true.
//  1. 거리(km)가 있으면: 실측 구간(시간+거리)으로 sec = a + b·km 를 최소제곱 적합해 적용
//     (a ≈ 가감속·정차, b ≈ 순항 속도의 역수). 실측 구간이 부족하면(<10) 2번으로.
//  2. 거리도 없으면: 같은 노선 실측 평균, 그것도 없으면 기본값.

import type { RawSection } from './types.ts';

export interface DistanceModel { a: number; b: number; n: number; mae: number; }

export function fitDistanceModel(sections: RawSection[]): DistanceModel | null {
  const pts = sections.filter((s) => !s.estimated && s.sec != null && s.km != null && s.km > 0).map((s) => [s.km!, s.sec!] as const);
  if (pts.length < 10) return null;
  const n = pts.length;
  const mx = pts.reduce((t, p) => t + p[0], 0) / n;
  const my = pts.reduce((t, p) => t + p[1], 0) / n;
  const sxy = pts.reduce((t, p) => t + (p[0] - mx) * (p[1] - my), 0);
  const sxx = pts.reduce((t, p) => t + (p[0] - mx) ** 2, 0);
  const b = sxy / sxx;
  const a = my - b * mx;
  const mae = pts.reduce((t, p) => t + Math.abs(a + b * p[0] - p[1]), 0) / n;
  return { a, b, n, mae };
}

export function fillEstimates(sections: RawSection[], defaultSec: number, model: DistanceModel | null = fitDistanceModel(sections)): RawSection[] {
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
    if (model && s.km != null && s.km > 0) return { ...s, sec: Math.round(model.a + model.b * s.km), estimated: true };
    const acc = sum.get(s.lineId);
    return { ...s, sec: acc ? Math.round(acc.total / acc.n) : defaultSec, estimated: true };
  });
}
