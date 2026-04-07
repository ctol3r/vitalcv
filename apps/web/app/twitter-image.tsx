import { ImageResponse } from 'next/og';

// Re-uses the same design as the Open Graph image.
// Next.js uses this file to auto-inject <meta name="twitter:image">.

export const alt = 'VitalCV — Check Clinician Readiness in Seconds';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Note: runtime is defined directly because Next.js static analysis
// cannot resolve re-exported config fields from other route files.
export const runtime = 'edge';

export { default } from './opengraph-image';
