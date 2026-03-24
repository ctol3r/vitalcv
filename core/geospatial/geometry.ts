import type {
  BoundingBox,
  GeoJsonGeometry,
  GeoJsonMultiPolygonGeometry,
  GeoJsonPointGeometry,
  GeoJsonPolygonGeometry,
} from './types';

type Coordinate = [number, number];
type Ring = Coordinate[];
type PolygonCoordinates = Ring[];
type MultiPolygonCoordinates = PolygonCoordinates[];

function safeAverage(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function closeRing(ring: Ring): Ring {
  if (ring.length === 0) {
    return [];
  }

  const first = ring[0]!;
  const last = ring[ring.length - 1]!;
  if (first[0] === last[0] && first[1] === last[1]) {
    return ring;
  }

  return [...ring, first];
}

function polygonArea(ring: Ring): number {
  const closed = closeRing(ring);
  let area = 0;

  for (let index = 0; index < closed.length - 1; index += 1) {
    const [x1, y1] = closed[index]!;
    const [x2, y2] = closed[index + 1]!;
    area += (x1 * y2) - (x2 * y1);
  }

  return area / 2;
}

function ringCentroid(ring: Ring): Coordinate {
  const closed = closeRing(ring);
  let crossSum = 0;
  let xSum = 0;
  let ySum = 0;

  for (let index = 0; index < closed.length - 1; index += 1) {
    const [x1, y1] = closed[index]!;
    const [x2, y2] = closed[index + 1]!;
    const cross = (x1 * y2) - (x2 * y1);
    crossSum += cross;
    xSum += (x1 + x2) * cross;
    ySum += (y1 + y2) * cross;
  }

  if (Math.abs(crossSum) < 0.0000001) {
    return [
      safeAverage(closed.map(([lng]) => lng)),
      safeAverage(closed.map(([, lat]) => lat)),
    ];
  }

  const factor = 1 / (3 * crossSum);
  return [xSum * factor, ySum * factor];
}

function pointOnSegment(point: Coordinate, start: Coordinate, end: Coordinate): boolean {
  const [x, y] = point;
  const [x1, y1] = start;
  const [x2, y2] = end;
  const cross = ((x - x1) * (y2 - y1)) - ((y - y1) * (x2 - x1));
  if (Math.abs(cross) > 0.0000001) {
    return false;
  }

  const dot = ((x - x1) * (x2 - x1)) + ((y - y1) * (y2 - y1));
  if (dot < 0) {
    return false;
  }

  const squaredLength = ((x2 - x1) ** 2) + ((y2 - y1) ** 2);
  return dot <= squaredLength;
}

function pointInRing(point: Coordinate, ring: Ring): boolean {
  const closed = closeRing(ring);
  let inside = false;

  for (let index = 0, previous = closed.length - 1; index < closed.length; previous = index, index += 1) {
    const current = closed[index]!;
    const prior = closed[previous]!;

    if (pointOnSegment(point, prior, current)) {
      return true;
    }

    const [x, y] = point;
    const [xi, yi] = current;
    const [xj, yj] = prior;
    const intersects = ((yi > y) !== (yj > y))
      && (x < (((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON)) + xi);

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function polygonCentroidFromCoordinates(coordinates: PolygonCoordinates): Coordinate {
  const outer = coordinates[0] ?? [];
  if (outer.length === 0) {
    return [0, 0];
  }

  return ringCentroid(outer);
}

function multiPolygonCentroidFromCoordinates(coordinates: MultiPolygonCoordinates): Coordinate {
  const weighted = coordinates
    .map((polygon) => {
      const outer = polygon[0] ?? [];
      const area = Math.abs(polygonArea(outer));
      const [lng, lat] = polygonCentroidFromCoordinates(polygon);
      return { area, lng, lat };
    })
    .filter((entry) => Number.isFinite(entry.lng) && Number.isFinite(entry.lat));

  const totalArea = weighted.reduce((sum, entry) => sum + entry.area, 0);
  if (weighted.length === 0) {
    return [0, 0];
  }

  if (totalArea <= 0) {
    return [
      safeAverage(weighted.map((entry) => entry.lng)),
      safeAverage(weighted.map((entry) => entry.lat)),
    ];
  }

  return [
    weighted.reduce((sum, entry) => sum + (entry.lng * entry.area), 0) / totalArea,
    weighted.reduce((sum, entry) => sum + (entry.lat * entry.area), 0) / totalArea,
  ];
}

function collectBounds(
  lng: number,
  lat: number,
  bounds: { minLng: number; minLat: number; maxLng: number; maxLat: number },
): void {
  bounds.minLng = Math.min(bounds.minLng, lng);
  bounds.minLat = Math.min(bounds.minLat, lat);
  bounds.maxLng = Math.max(bounds.maxLng, lng);
  bounds.maxLat = Math.max(bounds.maxLat, lat);
}

export function computeBoundingBoxForGeometry(geometry: GeoJsonGeometry): BoundingBox {
  const bounds = {
    minLng: Infinity,
    minLat: Infinity,
    maxLng: -Infinity,
    maxLat: -Infinity,
  };

  const applyCoordinate = ([lng, lat]: Coordinate): void => {
    collectBounds(lng, lat, bounds);
  };

  if (geometry.type === 'Point') {
    applyCoordinate(geometry.coordinates);
  } else if (geometry.type === 'LineString') {
    geometry.coordinates.forEach(applyCoordinate);
  } else if (geometry.type === 'Polygon') {
    geometry.coordinates.flat().forEach(applyCoordinate);
  } else {
    geometry.coordinates.flat(2).forEach(applyCoordinate);
  }

  if (!Number.isFinite(bounds.minLng) || !Number.isFinite(bounds.minLat)) {
    return {
      minLng: 0,
      minLat: 0,
      maxLng: 0,
      maxLat: 0,
    };
  }

  return bounds;
}

export function centroidForPolygon(geometry: GeoJsonPolygonGeometry): Coordinate {
  return polygonCentroidFromCoordinates(geometry.coordinates);
}

export function centroidForMultiPolygon(geometry: GeoJsonMultiPolygonGeometry): Coordinate {
  return multiPolygonCentroidFromCoordinates(geometry.coordinates);
}

export function centroidForGeometry(geometry: GeoJsonGeometry): Coordinate {
  switch (geometry.type) {
    case 'Point':
      return geometry.coordinates;
    case 'Polygon':
      return centroidForPolygon(geometry);
    case 'MultiPolygon':
      return centroidForMultiPolygon(geometry);
    case 'LineString':
    default:
      return [
        safeAverage(geometry.coordinates.map(([lng]) => lng)),
        safeAverage(geometry.coordinates.map(([, lat]) => lat)),
      ];
  }
}

export function pointInPolygon(point: Coordinate, geometry: GeoJsonPolygonGeometry): boolean {
  const [outer, ...holes] = geometry.coordinates;
  if (!outer || !pointInRing(point, outer)) {
    return false;
  }

  return !holes.some((ring) => pointInRing(point, ring));
}

export function pointInMultiPolygon(point: Coordinate, geometry: GeoJsonMultiPolygonGeometry): boolean {
  return geometry.coordinates.some((polygon) => pointInPolygon(point, {
    type: 'Polygon',
    coordinates: polygon,
  }));
}

export function pointInGeometry(point: Coordinate, geometry: GeoJsonGeometry): boolean {
  switch (geometry.type) {
    case 'Point':
      return geometry.coordinates[0] === point[0] && geometry.coordinates[1] === point[1];
    case 'Polygon':
      return pointInPolygon(point, geometry);
    case 'MultiPolygon':
      return pointInMultiPolygon(point, geometry);
    case 'LineString':
    default:
      return false;
  }
}

export function haversineDistanceKm(
  firstLatitude: number,
  firstLongitude: number,
  secondLatitude: number,
  secondLongitude: number,
): number {
  const toRadians = (value: number): number => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const latitudeDelta = toRadians(secondLatitude - firstLatitude);
  const longitudeDelta = toRadians(secondLongitude - firstLongitude);
  const latitudeA = toRadians(firstLatitude);
  const latitudeB = toRadians(secondLatitude);

  const a = (Math.sin(latitudeDelta / 2) ** 2)
    + (Math.cos(latitudeA) * Math.cos(latitudeB) * (Math.sin(longitudeDelta / 2) ** 2));
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

export function clusterRadiusKm(points: Array<{ latitude: number; longitude: number }>): number {
  if (points.length <= 1) {
    return 0;
  }

  const centroidLatitude = safeAverage(points.map((point) => point.latitude));
  const centroidLongitude = safeAverage(points.map((point) => point.longitude));
  return Number(
    Math.max(
      ...points.map((point) => haversineDistanceKm(
        centroidLatitude,
        centroidLongitude,
        point.latitude,
        point.longitude,
      )),
    ).toFixed(2),
  );
}
