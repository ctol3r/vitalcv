#!/usr/bin/env -S node --import=tsx/esm
/**
 * verify-replay-integrity.ts
 *
 * Recomputes the canonical replay identity (`lineageKey` + `runId`) for
 * a given evidence set and verifies the survivability contract from
 * the Wave 14 doc (docs/architecture/replay-survivability-matrix.md):
 *
 *   1. Determinism — N recomputations of the same input → one unique id
 *   2. Cosmetic-input invariance — whitespace / ordering changes do NOT
 *      change the id
 *   3. Sensitivity — any input field change DOES change the runId
 *
 * If an `expectedRunId` is supplied (e.g. recovered from a prior
 * snapshot manifest), the script also verifies that the recomputed
 * runId matches it — this is the "no silent corruption" check the
 * audit-chain integrity property depends on.
 *
 * Usage:
 *   pnpm exec tsx scripts/replay/verify-replay-integrity.ts \
 *     --evidence path/to/evidence.json \
 *     [--expected-run-id run_v1_...]
 *
 * Exit codes:
 *   0   integrity verified
 *   2   bad inputs (missing file, malformed JSON, etc.)
 *   3   integrity FAILED (drift detected vs --expected-run-id)
 */
import {
  computeLineageKey,
  computeRunId,
} from '../../apps/api/backend/src/services/replay/replayIdentity';
import {
  emitHumanLine,
  emitJsonLine,
  loadEvidenceFromFile,
  parseArgs,
  type ReplayEvidence,
} from './_lib';

interface Finding {
  finding: 'determinism' | 'cosmetic-invariance' | 'sensitivity' | 'expected-match' | 'summary';
  ok: boolean;
  detail: Record<string, unknown>;
}

export function verifyReplayIntegrity(
  evidence: ReplayEvidence,
  expectedRunId: string | null,
): Finding[] {
  const findings: Finding[] = [];

  const lineageKey = computeLineageKey(evidence.entityId);
  const baseRunId = computeRunId(evidence);

  // 1. Determinism — recompute 25 times, must collapse to one value.
  const repeated: string[] = [];
  for (let i = 0; i < 25; i += 1) {
    repeated.push(computeRunId(evidence));
  }
  const uniqueCount = new Set(repeated).size;
  findings.push({
    finding: 'determinism',
    ok: uniqueCount === 1,
    detail: { iterations: 25, uniqueRunIds: uniqueCount, runId: baseRunId },
  });

  // 2. Cosmetic invariance — re-order artifacts + whitespace-pad → same id.
  const cosmetic = computeRunId({
    ...evidence,
    artifactChecksums: [...evidence.artifactChecksums].reverse().map((c) => ` ${c} `),
  });
  findings.push({
    finding: 'cosmetic-invariance',
    ok: cosmetic === baseRunId,
    detail: { original: baseRunId, cosmeticVariant: cosmetic },
  });

  // 3. Sensitivity — mutating any input changes the id.
  const tamperedCheckedAt = computeRunId({
    ...evidence,
    lastCheckedAt: evidence.lastCheckedAt
      ? new Date(new Date(evidence.lastCheckedAt).getTime() + 1000).toISOString()
      : '2099-01-01T00:00:00.000Z',
  });
  const tamperedChecksums = computeRunId({
    ...evidence,
    artifactChecksums: [...evidence.artifactChecksums, 'cks-tampered'],
  });
  findings.push({
    finding: 'sensitivity',
    ok:
      tamperedCheckedAt !== baseRunId
      && tamperedChecksums !== baseRunId,
    detail: {
      runId: baseRunId,
      tamperedCheckedAt,
      tamperedChecksums,
    },
  });

  // 4. Optional: expected-match check against a previously-captured runId.
  if (expectedRunId !== null) {
    findings.push({
      finding: 'expected-match',
      ok: baseRunId === expectedRunId,
      detail: { recomputed: baseRunId, expected: expectedRunId },
    });
  }

  const allOk = findings.every((f) => f.ok);
  findings.push({
    finding: 'summary',
    ok: allOk,
    detail: {
      entityId: evidence.entityId,
      lineageKey,
      runId: baseRunId,
      schemeVersion: 'v1',
      artifactCount: evidence.artifactChecksums.length,
    },
  });

  return findings;
}

function main(): void {
  const { flags } = parseArgs(process.argv.slice(2));
  const evidencePath = flags.get('evidence');
  const expectedRunId = flags.get('expected-run-id') ?? null;

  if (!evidencePath) {
    emitHumanLine('usage: verify-replay-integrity --evidence <path.json> [--expected-run-id <id>]');
    process.exit(2);
  }

  let evidence: ReplayEvidence;
  try {
    evidence = loadEvidenceFromFile(evidencePath);
  } catch (err) {
    emitHumanLine(`error: ${String(err)}`);
    process.exit(2);
  }

  const findings = verifyReplayIntegrity(evidence, expectedRunId);
  for (const f of findings) {
    emitJsonLine(f as unknown as Record<string, unknown>);
  }

  const summary = findings[findings.length - 1];
  const integrityFailed = !findings.every((f) => f.ok);
  emitHumanLine(
    integrityFailed
      ? 'verify-replay-integrity: FAILED (see findings above)'
      : `verify-replay-integrity: OK (runId=${(summary.detail.runId as string) ?? '<unknown>'})`,
  );
  process.exit(integrityFailed ? 3 : 0);
}

// Execute only when invoked as a script (not when imported by tests).
if (typeof require !== 'undefined' && require.main === module) {
  main();
}
