import type { GraphEdge } from './types';

export type GraphZoomBand = 'overview' | 'network' | 'evidence';

export interface GraphViewportState {
  x: number;
  y: number;
  zoom: number;
  zoomBand: GraphZoomBand;
}

export function resolveGraphZoomBand(zoom: number): GraphZoomBand {
  if (zoom < 0.78) {
    return 'overview';
  }

  if (zoom >= 1.48) {
    return 'evidence';
  }

  return 'network';
}

export function resolveEdgeStrength(edge: Pick<GraphEdge, 'confidence' | 'weight'>): number {
  const confidence = Number.isFinite(edge.confidence) ? edge.confidence : 0.5;
  const weight = Number.isFinite(edge.weight) ? edge.weight : confidence;
  const normalized = Math.max(0.32, Math.min(1, ((confidence * 0.58) + (weight * 0.42))));

  return normalized;
}
