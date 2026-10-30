// data-build/src/types.ts 의 Graph와 같은 모양(빌드 산출물 graph.v1.json).
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

/** 엔진이 쓰는 형태: 인접 리스트 + 역 → 노드 목록 + ID 색인. */
export interface PreparedGraph {
  raw: Graph;
  adj: { to: number; sec: number; transfer: boolean; estimated: boolean }[][];
  stationNodes: number[][];
  stationById: Map<string, number>;
}

export interface Reach { sec: number; transfers: number; estimated: boolean; node: number; }

export interface ParticipantResult { sec: number; transfers: number; estimated: boolean; }

export interface CandidateResult {
  stationIdx: number;
  per: ParticipantResult[];
  maxSec: number;
  minSec: number;
  avgSec: number;
  stdevSec: number;
  totalTransfers: number;
  sumSec: number;
  /** 100 × 가장 짧은 사람 / 가장 긴 사람. 높을수록 비슷하게 걸린다(참고용 지표). */
  fairness: number;
  estimated: boolean;
}

export interface EvaluateOptions {
  /** 'hubs' = 환승역(모이기 좋은 역 기본값), 'all' = 모든 역 */
  candidates: 'hubs' | 'all';
  /** 최대 시간이 같을 때 편차보다 환승 수를 먼저 본다 */
  preferFewerTransfers: boolean;
  limit: number;
}

export interface Evaluation {
  results: CandidateResult[];
  /** 그래프에서 서로 이어지지 않아 제외한 후보가 있었는지 */
  excludedUnreachable: number;
}

export type PathStep =
  | { kind: 'ride'; lineIdx: number; fromStation: number; toStation: number; stops: number; sec: number; estimated: boolean }
  | { kind: 'transfer'; station: number; fromLine: number; toLine: number; sec: number; estimated: boolean };

export interface RoutePath { sec: number; transfers: number; estimated: boolean; steps: PathStep[]; }
