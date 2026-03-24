export interface BoundingBox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

export interface MapViewport {
  bbox: BoundingBox;
  zoom: number;
}

export interface GeoJsonPointGeometry {
  type: 'Point';
  coordinates: [number, number];
}

export interface GeoJsonLineStringGeometry {
  type: 'LineString';
  coordinates: Array<[number, number]>;
}

export interface GeoJsonPolygonGeometry {
  type: 'Polygon';
  coordinates: Array<Array<[number, number]>>;
}

export interface GeoJsonMultiPolygonGeometry {
  type: 'MultiPolygon';
  coordinates: Array<Array<Array<[number, number]>>>;
}

export type GeoJsonGeometry =
  | GeoJsonPointGeometry
  | GeoJsonLineStringGeometry
  | GeoJsonPolygonGeometry
  | GeoJsonMultiPolygonGeometry;

export interface GeoJsonFeature<TProperties extends Record<string, unknown>> {
  type: 'Feature';
  id?: string;
  geometry: GeoJsonGeometry;
  properties: TProperties;
}

export interface GeoJsonFeatureCollection<TProperties extends Record<string, unknown>> {
  type: 'FeatureCollection';
  features: Array<GeoJsonFeature<TProperties>>;
}

export type ClusterablePoint<TProperties extends Record<string, unknown>> = {
  id: string;
  latitude: number;
  longitude: number;
  properties: TProperties;
};

export type PointCluster<TProperties extends Record<string, unknown>> = {
  id: string;
  latitude: number;
  longitude: number;
  pointCount: number;
  properties: TProperties;
};
