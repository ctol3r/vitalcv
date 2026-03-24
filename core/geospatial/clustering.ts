import Supercluster from 'supercluster';
import { pointInBoundingBox } from './bbox';
import type {
  BoundingBox,
  ClusterablePoint,
  PointCluster,
} from './types';

type ClusterFeature<TProperties extends Record<string, unknown>> = {
  type: 'Feature';
  id?: string | number;
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: TProperties & {
    cluster?: boolean;
    cluster_id?: number;
    point_count?: number;
  };
};

export function clusterPoints<TProperties extends Record<string, unknown>>(
  points: Array<ClusterablePoint<TProperties>>,
  bbox: BoundingBox,
  zoom: number,
  reduce?: (accumulated: TProperties, next: TProperties) => void,
  initial?: () => TProperties,
): Array<PointCluster<TProperties>> {
  const visiblePoints = points.filter((point) => pointInBoundingBox(point.latitude, point.longitude, bbox));
  if (visiblePoints.length === 0) {
    return [];
  }

  const supercluster = new Supercluster<TProperties, TProperties>({
    radius: 60,
    maxZoom: 20,
    reduce,
    map: (properties) => (
      reduce
        ? {
          ...(initial ? initial() : {} as TProperties),
          ...properties,
        }
        : { ...properties }
    ),
  });

  supercluster.load(
    visiblePoints.map((point) => ({
      type: 'Feature',
      id: point.id,
      geometry: {
        type: 'Point',
        coordinates: [point.longitude, point.latitude],
      },
      properties: point.properties,
    })) as Array<ClusterFeature<TProperties>>,
  );

  return supercluster.getClusters(
    [bbox.minLng, bbox.minLat, bbox.maxLng, bbox.maxLat],
    zoom,
  ).map((entry) => {
    const [longitude, latitude] = entry.geometry.coordinates;
    const clusterId = entry.properties.cluster_id;
    const pointCount = typeof entry.properties.point_count === 'number'
      ? entry.properties.point_count
      : 1;

    return {
      id: clusterId ? `cluster:${clusterId}` : String(entry.id ?? `${longitude}:${latitude}`),
      latitude,
      longitude,
      pointCount,
      properties: entry.properties as TProperties,
    };
  });
}
