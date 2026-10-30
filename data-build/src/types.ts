// 앱 번들에 들어가는 그래프 형식. app/src/engine/types.ts 와 같은 모양을 유지한다(저장소 간 import 금지 규칙에 맞춰 복제).

export interface Station { id: string; name: string; aliases: string[]; lines: string[]; chosung: string; }
export interface Line { id: string; name: string; short: string; operator: string; color: string; }
export interface Edge { from: number; to: number; sec: number; kind: 'ride' | 'transfer'; estimated: boolean; }
export interface Source { id: string; name: string; baseDate: string; license: string; attribution: string; }
export interface Graph {
  version: number;
  builtAt: string;
  demo: boolean;
  sources: Source[];
  stations: Station[];
  lines: Line[];
  nodes: { stationIdx: number; lineIdx: number }[];
  edges: Edge[];
}

/** 원본 어댑터가 내놓는 중간 형식: 노선별 인접역 구간. */
export interface RawSection { lineId: string; from: string; to: string; sec: number | null; estimated: boolean; }
export interface RawLine { id: string; name: string; short: string; operator: string; color: string; }
export interface RawTransfer { station: string; fromLine: string; toLine: string; sec: number; }
export interface RawDataset { lines: RawLine[]; sections: RawSection[]; transfers: RawTransfer[]; sources: Source[]; demo: boolean; }
