// 번들된 그래프(data-build 산출물)를 한 번만 준비한다. graph.v1.json은 직접 수정하지 않는다.
import { prepareGraph, type Graph } from '../engine';
import raw from './graph.v1.json';

export const graph = prepareGraph(raw as Graph);

export const validStationIds = new Set(graph.raw.stations.map((s) => s.id));

export function stationName(idx: number): string {
  return graph.raw.stations[idx].name;
}
