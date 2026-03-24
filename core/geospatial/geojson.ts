import type {
  GeoJsonFeature,
  GeoJsonFeatureCollection,
  GeoJsonLineStringGeometry,
  GeoJsonMultiPolygonGeometry,
  GeoJsonPointGeometry,
  GeoJsonPolygonGeometry,
} from './types';

export function pointGeometry(longitude: number, latitude: number): GeoJsonPointGeometry {
  return {
    type: 'Point',
    coordinates: [longitude, latitude],
  };
}

export function lineStringGeometry(
  coordinates: Array<[number, number]>,
): GeoJsonLineStringGeometry {
  return {
    type: 'LineString',
    coordinates,
  };
}

export function polygonGeometry(
  coordinates: Array<Array<[number, number]>>,
): GeoJsonPolygonGeometry {
  return {
    type: 'Polygon',
    coordinates,
  };
}

export function multiPolygonGeometry(
  coordinates: Array<Array<Array<[number, number]>>>,
): GeoJsonMultiPolygonGeometry {
  return {
    type: 'MultiPolygon',
    coordinates,
  };
}

export function feature<TProperties extends Record<string, unknown>>(
  geometry: GeoJsonFeature<TProperties>['geometry'],
  properties: TProperties,
  id?: string,
): GeoJsonFeature<TProperties> {
  return {
    type: 'Feature',
    id,
    geometry,
    properties,
  };
}

export function featureCollection<TProperties extends Record<string, unknown>>(
  features: Array<GeoJsonFeature<TProperties>>,
): GeoJsonFeatureCollection<TProperties> {
  return {
    type: 'FeatureCollection',
    features,
  };
}
