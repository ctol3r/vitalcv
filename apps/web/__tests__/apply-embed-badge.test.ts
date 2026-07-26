/**
 * Apply-with-VitalCV embed badge — served SVG must be valid, cacheable,
 * cross-origin loadable, and free of banned truth-contract strings.
 */
import { describe, expect, it } from 'vitest';
import { GET } from '@/app/api/embed/apply-badge.svg/route';

const BANNED = [
  'automatically verified',
  'guaranteed verification',
  'complete credentialing',
  'instant credentialing',
  'legally accepted',
  'certified compliant',
];

describe('GET /api/embed/apply-badge.svg', () => {
  it('serves a cacheable, cross-origin SVG badge', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('image/svg+xml');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res.headers.get('Cache-Control')).toContain('max-age');

    const body = await res.text();
    expect(body).toContain('<svg');
    expect(body).toContain('Apply with VitalCV');
  });

  it('contains no banned claims and no bare Verified label', async () => {
    const body = await (await GET()).text();
    for (const phrase of BANNED) {
      expect(body.toLowerCase()).not.toContain(phrase);
    }
    expect(body).not.toMatch(/>\s*Verified\s*</);
  });
});
