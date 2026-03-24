import {
  clusterPoints,
  clusterRadiusKm,
  hashAddress,
  normalizeAddressPart,
  pointInGeometry,
} from '../../../../../../../core/geospatial';

describe('core geospatial utilities', () => {
  it('normalizes and hashes addresses stably', () => {
    expect(normalizeAddressPart(' 123 Main st ')).toBe('123 MAIN ST');
    expect(
      hashAddress(['123 Main St', 'San Francisco', 'CA', '94107']),
    ).toBe(
      hashAddress([' 123   MAIN ST ', 'san francisco', 'ca', '94107']),
    );
  });

  it('clusters nearby map points', () => {
    const clusters = clusterPoints(
      [
        {
          id: 'a',
          latitude: 37.7749,
          longitude: -122.4194,
          properties: { label: 'A', score: 80 },
        },
        {
          id: 'b',
          latitude: 37.7751,
          longitude: -122.4192,
          properties: { label: 'B', score: 70 },
        },
      ],
      {
        minLng: -123,
        minLat: 37,
        maxLng: -121,
        maxLat: 38,
      },
      4,
      (accumulated, next) => {
        accumulated.score = Number(accumulated.score) + Number(next.score);
      },
      () => ({ label: '', score: 0 }),
    );

    expect(clusters.some((cluster) => cluster.pointCount > 1)).toBe(true);
  });

  it('supports polygon hit testing and cluster radius math', () => {
    const inside = pointInGeometry(
      [-122.4194, 37.7749],
      {
        type: 'Polygon',
        coordinates: [[
          [-122.5, 37.7],
          [-122.3, 37.7],
          [-122.3, 37.8],
          [-122.5, 37.8],
          [-122.5, 37.7],
        ]],
      },
    );

    const radius = clusterRadiusKm([
      { latitude: 37.7749, longitude: -122.4194 },
      { latitude: 37.7849, longitude: -122.4094 },
    ]);

    expect(inside).toBe(true);
    expect(radius).toBeGreaterThan(0);
  });
});
