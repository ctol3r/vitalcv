import { describe, expect, it } from 'vitest';
import {
  resolveLineageGraph,
} from '@/lib/audit/lineageGraph';
import { listDemoAuditEvents } from '@/lib/audit/demoEvents';

describe('lineage-graph resolver · upstream + downstream', () => {
  const all = listDemoAuditEvents();

  it('returns null for an unknown event id', () => {
    expect(resolveLineageGraph('does-not-exist', all)).toBeNull();
  });

  it('resolves upstream parents BFS (focal evt_a04 → evt_a02 + evt_a03 + evt_a01)', () => {
    const g = resolveLineageGraph('evt_a04', all);
    expect(g).not.toBeNull();
    const upstreamIds = g!.upstream.map((n) => n.id);
    expect(upstreamIds).toContain('evt_a02');
    expect(upstreamIds).toContain('evt_a03');
    expect(upstreamIds).toContain('evt_a01');
    expect(g!.summary.upstreamCount).toBe(upstreamIds.length);
  });

  it('resolves downstream children (focal evt_a01 → evt_a02 + evt_a03 + evt_a04 + evt_a05)', () => {
    const g = resolveLineageGraph('evt_a01', all);
    const ids = g!.downstream.map((n) => n.id);
    expect(ids).toContain('evt_a02');
    expect(ids).toContain('evt_a03');
    expect(ids).toContain('evt_a04');
    expect(ids).toContain('evt_a05');
  });

  it('emits parent edges for the focal + upstream + downstream subgraph', () => {
    const g = resolveLineageGraph('evt_a04', all);
    const parentEdges = g!.edges.filter((e) => e.relation === 'parent');
    expect(parentEdges.find((e) => e.from === 'evt_a02' && e.to === 'evt_a04')).toBeTruthy();
    expect(parentEdges.find((e) => e.from === 'evt_a03' && e.to === 'evt_a04')).toBeTruthy();
    expect(parentEdges.find((e) => e.from === 'evt_a01' && e.to === 'evt_a02')).toBeTruthy();
  });
});

describe('lineage-graph resolver · siblings (shared run / shared lineage)', () => {
  const all = listDemoAuditEvents();

  it('flags events that share the same runId but are not ancestors or descendants', () => {
    // For evt_a02 (oig_exclusions check in run_7a2cb8d3):
    // - upstream: evt_a01
    // - downstream: evt_a04, evt_a05
    // - siblings in same run: evt_a03 only (not ancestor, not descendant)
    const g = resolveLineageGraph('evt_a02', all);
    const sharedRun = g!.siblings.filter((s) => s.relation === 'shared_run');
    const ids = sharedRun.map((s) => s.node.id);
    expect(ids).toContain('evt_a03');
    // evt_a01 is an ancestor and must NOT appear as a sibling.
    expect(ids).not.toContain('evt_a01');
    // evt_a05 is a descendant and must NOT appear as a sibling.
    expect(ids).not.toContain('evt_a05');
  });

  it('does not include the focal event in any list', () => {
    const g = resolveLineageGraph('evt_a04', all);
    const everyId = [
      ...g!.upstream.map((n) => n.id),
      ...g!.downstream.map((n) => n.id),
      ...g!.siblings.map((s) => s.node.id),
    ];
    expect(everyId).not.toContain('evt_a04');
  });

  it('emits sibling edges with the matching relation tag', () => {
    const g = resolveLineageGraph('evt_a02', all);
    const siblingEdges = g!.edges.filter((e) => e.relation === 'shared_run');
    expect(siblingEdges.length).toBeGreaterThanOrEqual(1);
    for (const edge of siblingEdges) {
      expect(edge.from).toBe('evt_a02');
    }
  });
});

describe('audit graph route input validation', () => {
  it('rejects malformed event ids', async () => {
    const { GET } = await import('@/app/api/audit/[eventId]/graph/route');
    const req = {} as unknown as import('next/server').NextRequest;
    const res = await GET(req, {
      params: Promise.resolve({ eventId: 'bad event!' }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'invalid_event_id_format' });
  });

  it('returns 404 for unknown event ids', async () => {
    const { GET } = await import('@/app/api/audit/[eventId]/graph/route');
    const req = {} as unknown as import('next/server').NextRequest;
    const res = await GET(req, {
      params: Promise.resolve({ eventId: 'evt_unknown' }),
    });
    expect(res.status).toBe(404);
  });

  it('returns the full LineageGraph payload for a known event', async () => {
    const { GET } = await import('@/app/api/audit/[eventId]/graph/route');
    const req = {} as unknown as import('next/server').NextRequest;
    const res = await GET(req, {
      params: Promise.resolve({ eventId: 'evt_a04' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.focal.id).toBe('evt_a04');
    expect(body.upstream.length).toBeGreaterThan(0);
    expect(body.downstream.length).toBeGreaterThan(0);
    expect(body.summary.upstreamCount).toBe(body.upstream.length);
    expect(body.summary.downstreamCount).toBe(body.downstream.length);
  });
});
