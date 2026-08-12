/**
 * Public timeline disclosure boundary.
 *
 * The acceptance producer belongs to the authenticated employer path. An
 * unauthenticated NPI timeline must not even read or transform it before the
 * public evidence projection is built.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { buildDemoPassport } from '../lib/demo/demo-passport';

const { resolveMock, fetchAcceptanceHistoryMock, acceptanceTransformMock } = vi.hoisted(() => ({
  resolveMock: vi.fn(),
  fetchAcceptanceHistoryMock: vi.fn(),
  acceptanceTransformMock: vi.fn(),
}));

vi.mock('@/lib/trust/passport-runtime', () => ({
  resolvePassportRuntimePassport: resolveMock,
}));

vi.mock('@/lib/recognition/acceptance-evidence', () => ({
  fetchAcceptanceHistoryForTimeline: fetchAcceptanceHistoryMock,
  acceptanceHistoryToEvidenceObjects: acceptanceTransformMock,
}));

describe('GET /api/timeline/[entityId] public disclosure boundary', () => {
  beforeEach(() => {
    resolveMock.mockReset();
    fetchAcceptanceHistoryMock.mockReset();
    acceptanceTransformMock.mockReset();
    resolveMock.mockResolvedValue(buildDemoPassport());
    // If this public route regresses to reading acceptance history, this truthy
    // result forces the old branch to call the transform as well.
    fetchAcceptanceHistoryMock.mockResolvedValue({ history: [{ acceptanceId: 'accept-1' }] });
    acceptanceTransformMock.mockReturnValue({ objects: [], relationships: [] });
  });

  it('does not read or transform acceptance history for an unauthenticated NPI timeline', async () => {
    const { GET } = await import('../app/api/timeline/[entityId]/route');
    const res = await GET(
      new NextRequest('http://localhost/api/timeline/1234567890'),
      { params: Promise.resolve({ entityId: '1234567890' }) },
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(fetchAcceptanceHistoryMock).not.toHaveBeenCalled();
    expect(acceptanceTransformMock).not.toHaveBeenCalled();
  });
});
