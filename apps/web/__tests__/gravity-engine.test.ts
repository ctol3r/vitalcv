import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function readWorkspaceFile(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

describe('gravity engine single source', () => {
  it('keeps a single truth-render rule source for the public trust path', () => {
    const gravitySource = readWorkspaceFile('lib/trust/ui-truth-integrity.ts');
    const pageSource = readWorkspaceFile('app/p/[slug]/page.tsx');
    const evidenceSource = readWorkspaceFile('app/p/[slug]/EvidencePanel.tsx');
    const loadingSource = readWorkspaceFile('app/p/[slug]/loading.tsx');

    expect(gravitySource.match(/export function areRequiredFlowStagesResolved/g)?.length ?? 0).toBe(1);
    expect(gravitySource.match(/export function resolveAtomicTruthRenderState/g)?.length ?? 0).toBe(1);
    expect(gravitySource.match(/export function assertNoArtificialLatency/g)?.length ?? 0).toBe(1);
    expect(gravitySource.match(/export function assertNoProgressiveComputation/g)?.length ?? 0).toBe(1);

    expect(pageSource).not.toContain('function areRequiredFlowStagesResolved');
    expect(pageSource).not.toContain('function resolveAtomicTruthRenderState');
    expect(pageSource).not.toContain('function assertNoArtificialLatency');
    expect(pageSource).not.toContain('function assertNoProgressiveComputation');
    expect(evidenceSource).not.toContain('function areRequiredFlowStagesResolved');
    expect(evidenceSource).not.toContain('function resolveAtomicTruthRenderState');
    expect(evidenceSource).not.toContain('function assertNoArtificialLatency');
    expect(loadingSource).not.toContain('fetchNextBestAction');
  });

  it('fails the public trust path if staged or duplicate gravity logic markers appear', () => {
    const files = [
      readWorkspaceFile('lib/trust/ui-truth-integrity.ts'),
      readWorkspaceFile('app/p/[slug]/page.tsx'),
      readWorkspaceFile('app/p/[slug]/EvidencePanel.tsx'),
      readWorkspaceFile('app/p/[slug]/loading.tsx'),
    ];

    for (const content of files) {
      expect(content).not.toContain('progressive_rendering_of_truth');
      expect(content).not.toContain('partial render logic');
      expect(content).not.toContain('staged computation logic');
    }
  });
});
