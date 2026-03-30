import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/server/pilot-ops', () => ({
  forwardPilotOpsRequest: vi.fn(),
}));

describe('/api/internal/pilot-proof proxy', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('passes through CSV proof exports without coercing them into JSON', async () => {
    const { forwardPilotOpsRequest } = await import('@/lib/server/pilot-ops');
    const forwardPilotOpsRequestMock = vi.mocked(forwardPilotOpsRequest);
    forwardPilotOpsRequestMock.mockResolvedValue(new Response('section,label,value\nproof_chain,total_cases,1', {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename=\"pilot-proof.csv\"',
      },
    }));

    const { GET } = await import('../app/api/internal/pilot-proof/route');
    const { NextRequest } = await import('next/server');

    const response = await GET(new NextRequest('http://localhost/api/internal/pilot-proof?format=csv'));

    expect(forwardPilotOpsRequestMock).toHaveBeenCalledWith('/api/internal/pilot-proof?format=csv', {
      method: 'GET',
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/csv');
    expect(response.headers.get('content-disposition')).toContain('pilot-proof.csv');
    await expect(response.text()).resolves.toContain('proof_chain,total_cases,1');
  });
});
