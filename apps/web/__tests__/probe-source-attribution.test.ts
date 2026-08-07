import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * D4 — every production caller of the probe endpoint must attribute itself.
 *
 * `_handler.ts` reads `?source=` and falls back to `manual`. That fallback is
 * correct for a human with curl, but it makes an unattributed automated caller
 * *silently* wrong: the row is still written, the probe still returns 200, and
 * nothing anywhere reports a problem. The only symptom is that months later
 * every sample claims to be `manual` and the column no one can re-derive is
 * worthless.
 *
 * Both callers shipped without the parameter (caught before any data
 * accumulated). This guard pins them, because the defect is invisible at
 * runtime and would otherwise only surface when someone tried to use the data.
 */

const REPO = path.resolve(process.cwd(), '../..');

const CALLERS = [
  {
    file: '.github/workflows/source-health-probe.yml',
    what: 'the scheduled cron probe',
    expected: 'source=cron',
  },
  {
    file: 'scripts/deploy-health-probe.sh',
    what: 'the post-deploy probe',
    expected: 'source=deploy',
  },
] as const;

describe('D4 — probe callers attribute their source', () => {
  it('finds the caller files where it expects them', () => {
    // If a refactor moves these, the assertions below would vacuously pass on
    // an empty read. Fail loudly instead.
    for (const c of CALLERS) {
      expect(fs.existsSync(path.join(REPO, c.file)), `${c.file} not found`).toBe(true);
    }
  });

  for (const c of CALLERS) {
    it(`${c.what} POSTs with ?${c.expected}`, () => {
      const src = fs.readFileSync(path.join(REPO, c.file), 'utf8');
      // The endpoint may appear more than once (docs/comments); require that
      // the POST target itself carries the parameter.
      const targets = src.match(/\S*api\/internal\/source-health\/probe\S*/g) ?? [];
      const posted = targets.filter((t) => !t.startsWith('#') && t.includes('source-health/probe'));
      expect(posted.length, `no probe URL found in ${c.file}`).toBeGreaterThan(0);
      expect(
        posted.some((t) => t.includes(c.expected)),
        `${c.file} calls the probe without ?${c.expected} — its samples would be recorded as 'manual'. Found: ${posted.join(', ')}`,
      ).toBe(true);
    });
  }

  it('the probe response echoes the source it stored under', async () => {
    // Closes the last inference gap in D4. The callers above are asserted to
    // SEND `?source=`, and readProbeSource is asserted to parse it — but
    // nothing proved the two meet, so the stored label stayed unobservable
    // from outside the database. One curl should settle it.
    const { __handleForTests } = await import(
      '../app/api/internal/source-health/probe/_handler'
    );

    const seen: string[] = [];
    const deps = {
      authEnv: { cronSecret: 's', monitoringSecret: null },
      runProbes: async () => ({ snapshots: [], durationMs: 1, errors: [] }),
      recordSamples: async (_snaps: unknown, source: string) => {
        seen.push(source);            // what the ledger was actually told
        return { written: 0, failed: false };
      },
    } as unknown as Parameters<typeof __handleForTests>[1];

    for (const [query, expected] of [
      ['?source=cron', 'cron'],
      ['?source=deploy', 'deploy'],
      ['', 'manual'],               // no param -> honest default
      ['?source=bogus', 'manual'],  // unrecognised -> honest default, not the raw value
    ] as const) {
      const res = await __handleForTests(
        new Request(`https://x/api/internal/source-health/probe${query}`, {
          method: 'POST',
          headers: { authorization: 'Bearer s' },
        }),
        deps,
      );
      const body = await res.json();
      expect(res.status).toBe(200);
      // The echo must equal what was handed to the ledger — otherwise the
      // field would be decorative and could drift from the stored value.
      expect(body.ledger.source).toBe(expected);
      expect(seen.at(-1)).toBe(expected);
    }
  });
});

