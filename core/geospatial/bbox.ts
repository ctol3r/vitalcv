import type { BoundingBox, MapViewport } from './types';

const MAX_WORLD_WIDTH = 360;
const MAX_WORLD_HEIGHT = 180;

function parseNumber(value: string, label: string): number {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid ${label}`);
  }
  return parsed;
}

export function parseBoundingBox(raw: string): BoundingBox {
  const parts = raw.split(',').map((value) => value.trim());
  if (parts.length !== 4) {
    throw new Error('bbox must be minLng,minLat,maxLng,maxLat');
  }

  const [minLngRaw, minLatRaw, maxLngRaw, maxLatRaw] = parts;
  const bbox = {
    minLng: parseNumber(minLngRaw!, 'bbox.minLng'),
    minLat: parseNumber(minLatRaw!, 'bbox.minLat'),
    maxLng: parseNumber(maxLngRaw!, 'bbox.maxLng'),
    maxLat: parseNumber(maxLatRaw!, 'bbox.maxLat'),
  };

  validateBoundingBox(bbox);
  return bbox;
}

export function validateBoundingBox(bbox: BoundingBox): void {
  if (bbox.minLng < -180 || bbox.maxLng > 180 || bbox.minLat < -90 || bbox.maxLat > 90) {
    throw new Error('bbox coordinates are out of range');
  }
  if (bbox.minLng >= bbox.maxLng || bbox.minLat >= bbox.maxLat) {
    throw new Error('bbox minimums must be less than maximums');
  }

  const width = bbox.maxLng - bbox.minLng;
  const height = bbox.maxLat - bbox.minLat;
  if (width > MAX_WORLD_WIDTH || height > MAX_WORLD_HEIGHT) {
    throw new Error('bbox is too large');
  }
}

export function clampZoom(raw: number, minZoom = 0, maxZoom = 20): number {
  if (!Number.isFinite(raw)) {
    throw new Error('zoom must be a finite number');
  }

  const zoom = Math.trunc(raw);
  if (zoom < minZoom || zoom > maxZoom) {
    throw new Error(`zoom must be between ${minZoom} and ${maxZoom}`);
  }

  return zoom;
}

export function createViewport(bboxRaw: string, zoomRaw: number): MapViewport {
  return {
    bbox: parseBoundingBox(bboxRaw),
    zoom: clampZoom(zoomRaw),
  };
}

export function pointInBoundingBox(
  latitude: number,
  longitude: number,
  bbox: BoundingBox,
): boolean {
  return (
    longitude >= bbox.minLng
    && longitude <= bbox.maxLng
    && latitude >= bbox.minLat
    && latitude <= bbox.maxLat
  );
}

export function expandBoundingBox(bbox: BoundingBox, paddingDegrees: number): BoundingBox {
  return {
    minLng: Math.max(-180, bbox.minLng - paddingDegrees),
    minLat: Math.max(-90, bbox.minLat - paddingDegrees),
    maxLng: Math.min(180, bbox.maxLng + paddingDegrees),
    maxLat: Math.min(90, bbox.maxLat + paddingDegrees),
  };
}
