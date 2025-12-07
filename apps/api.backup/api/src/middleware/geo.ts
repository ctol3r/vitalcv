import type { Request, Response, NextFunction } from 'express';

// Geographic routing hints for active-active deployments
export function geoHints(req: Request, res: Response, next: NextFunction) {
  // In production, use CloudFront headers or MaxMind GeoIP
  const cfRegion = req.headers['cloudfront-viewer-country'] as string;
  const xffIp = req.headers['x-forwarded-for'] as string;

  const region = cfRegion || process.env.DATA_REGION || 'us-east-1';

  res.setHeader('X-Geo-Region', region);
  res.setHeader('X-Instance-Id', process.env.INSTANCE_ID || 'local');

  // Store geo context for routing decisions
  (req as any).geo = {
    region,
    ip: xffIp || req.ip,
    country: cfRegion,
  };

  next();
}
