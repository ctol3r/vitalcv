/**
 * GET /api/embed/apply-badge.svg — the hosted "Apply with VitalCV" badge for
 * employer careers-page embeds (see OpportunityEmbedPanel). Pure static SVG:
 * no user input reaches the markup. Long-cacheable; served with a permissive
 * CORS header so <img> loads work from any employer origin.
 */
import { NextResponse } from 'next/server';

const BADGE = `<svg xmlns="http://www.w3.org/2000/svg" width="196" height="44" viewBox="0 0 196 44" role="img" aria-label="Apply with VitalCV">
  <rect x="0.5" y="0.5" width="195" height="43" rx="8" fill="#14141a" stroke="#2c2c36"/>
  <circle cx="22" cy="22" r="9" fill="none" stroke="#8b8cf0" stroke-width="1.5"/>
  <circle cx="22" cy="22" r="3" fill="#f4c76b"/>
  <text x="40" y="19" font-family="ui-monospace, 'Geist Mono', monospace" font-size="9" letter-spacing="1.5" fill="#9aa0b5">APPLY WITH</text>
  <text x="40" y="33" font-family="Georgia, 'Times New Roman', serif" font-size="15" fill="#f4f3ee">VitalCV</text>
</svg>
`;

export async function GET() {
  return new NextResponse(BADGE, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      'Access-Control-Allow-Origin': '*',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
