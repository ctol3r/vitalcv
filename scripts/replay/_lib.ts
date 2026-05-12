/**
 * Shared helpers for the replay-integrity CLI scripts.
 *
 * Each script under scripts/replay/* is a small operational tool that
 * exercises the canonical replay-identity contract (apps/api/backend/
 * src/services/replay/replayIdentity.ts, shipped in PR #343 + #344).
 *
 * The helpers here:
 *   - resolve evidence inputs for an NPI either from a Prisma
 *     connection or from a JSON file (so the scripts work in CI / dev
 *     without a live DB)
 *   - format human-readable + machine-readable output blocks
 *   - parse CLI args without pulling in yargs/commander (keep the
 *     scripts dependency-light)
 *
 * Scripts intentionally do NOT mutate state. They are read-only audits
 * over persisted inputs.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Subset of `verificationArtifact` rows the replay-identity scheme
 * cares about — entity id + lastCheckedAt + artifact checksums.
 * Either provided via a JSON fixture or fetched from a Prisma client.
 */
export interface ReplayEvidence {
  /** Canonical entity / NPI. */
  entityId: string;
  /** ISO timestamp of the most recent passport snapshot, or null. */
  lastCheckedAt: string | null;
  /** Stable artifact identifiers / checksums that contributed to this
   *  snapshot. Order does not matter — the replay-identity generator
   *  normalizes it inside. */
  artifactChecksums: string[];
  /** Optional channel — see `computeRunId` semantics. */
  channel?: string;
}

/**
 * Loads a JSON fixture from disk. Used by the scripts for offline
 * verification + by unit tests. Schema is documented in
 * `scripts/replay/__tests__/fixtures/sample-evidence.json` (added in
 * the test suite below).
 */
export function loadEvidenceFromFile(path: string): ReplayEvidence {
  const abs = resolve(path);
  if (!existsSync(abs)) {
    throw new Error(`evidence file not found: ${abs}`);
  }
  const raw = readFileSync(abs, 'utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`evidence file ${abs} is not valid JSON: ${String(err)}`);
  }
  return normalizeEvidence(parsed);
}

/**
 * Pure normalizer: accepts a permissive shape and returns the strict
 * `ReplayEvidence` the scripts operate on. Throws on invalid input —
 * scripts surface the error to stderr and exit non-zero.
 */
export function normalizeEvidence(input: unknown): ReplayEvidence {
  if (!input || typeof input !== 'object') {
    throw new Error('evidence must be a JSON object');
  }
  const obj = input as Record<string, unknown>;
  const entityId = typeof obj.entityId === 'string' ? obj.entityId.trim() : '';
  if (!entityId) {
    throw new Error('evidence.entityId is required (string)');
  }
  const lastCheckedAt = obj.lastCheckedAt === null
    ? null
    : (typeof obj.lastCheckedAt === 'string' ? obj.lastCheckedAt.trim() : null);

  const artifacts = Array.isArray(obj.artifactChecksums)
    ? obj.artifactChecksums
        .filter((c): c is string => typeof c === 'string')
        .map((c) => c.trim())
        .filter((c) => c.length > 0)
    : [];

  const channel = typeof obj.channel === 'string' ? obj.channel.trim() : undefined;

  return { entityId, lastCheckedAt, artifactChecksums: artifacts, channel };
}

/**
 * Parses a simple `--key=value` / `--key value` arg vector. Returns a
 * Map of resolved key→value plus a list of bare positional args.
 */
export interface ParsedArgs {
  flags: Map<string, string>;
  positional: string[];
}

export function parseArgs(argv: readonly string[]): ParsedArgs {
  const flags = new Map<string, string>();
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq >= 0) {
        flags.set(a.slice(2, eq), a.slice(eq + 1));
      } else {
        const next = argv[i + 1];
        if (typeof next === 'string' && !next.startsWith('--')) {
          flags.set(a.slice(2), next);
          i += 1;
        } else {
          flags.set(a.slice(2), '1');
        }
      }
    } else {
      positional.push(a);
    }
  }
  return { flags, positional };
}

/**
 * Returns a sortable order key derived from an ISO timestamp.
 * Stable lexicographic order is used so the scripts don't depend on
 * Date arithmetic precision.
 */
export function chronologyKey(iso: string | null): string {
  return iso ?? '0000-00-00T00:00:00.000Z';
}

/**
 * Returns hours-difference between two ISO timestamps (b - a).
 * `null` on either side returns `null` (no signal).
 */
export function hoursBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return null;
  return (tb - ta) / (1000 * 60 * 60);
}

/**
 * Stream a structured-JSON line for machine-readable output.
 * Scripts emit one JSON object per "finding" or "summary" line, so a
 * piped consumer can do `… | jq` cleanly.
 */
export function emitJsonLine(obj: Record<string, unknown>): void {
  process.stdout.write(`${JSON.stringify(obj)}\n`);
}

export function emitHumanLine(line: string): void {
  process.stderr.write(`${line}\n`);
}
