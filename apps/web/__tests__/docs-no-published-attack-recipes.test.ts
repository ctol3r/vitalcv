import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

/**
 * This repository is PUBLIC. `docs/` is published with it.
 *
 * The rule this guard enforces is narrow on purpose:
 *
 *   A markdown file under docs/ may not contain a runnable request that pairs a
 *   command-line HTTP client with a caller-asserted identity, role, organization
 *   or operator-secret header.
 *
 * That pairing is the copy-pasteable artifact — the thing a browsing reader can
 * run without understanding the system. It is deliberately NOT a ban on:
 *
 *   - naming a header (the header names are in application source, in the
 *     header-trust baseline, and in test names; banning the words here would
 *     punish the docs that describe the boundary and change nothing an attacker
 *     can read),
 *   - `curl`ing a production origin (every deploy runbook does this against
 *     /health, and a gate that reddens 38 lines of ops documentation on day one
 *     is a gate that gets deleted),
 *   - documenting an open gap, its status, its owner, or its exit criteria.
 *     The honest gap record is an asset. The recipe is not.
 *
 * If you are adding a runbook that genuinely needs to send one of these headers,
 * take the value from an operator-supplied environment variable and have the
 * script skip when it is unset — see the launch-monitor block in
 * docs/LAUNCH_PACKAGE.md for the shape. Do not check in a working value.
 */

const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const DOCS_ROOT = join(REPO_ROOT, 'docs');

// Headers that assert who the caller is, what role they hold, which tenant they
// are acting for, or that they hold an operator secret. A request carrying one
// of these is an authorization attempt, not a health check.
const ASSERTED_AUTHZ_HEADER =
  /x-clerk-user-id|x-org-id|x-org-role|x-user-role|x-verifier-role|x-monitoring-secret|x-internal-secret|x-admin-secret/i;

// Command-line HTTP clients. A fenced example in a client SDK's own language is
// documentation of an API; a shell one-liner is a thing you paste into a shell.
const HTTP_CLIENT = /\b(curl|wget|http(?:ie)?\s+-{1,2})\b/;

const SKIP_DIRS = new Set(['node_modules', '.next', '.turbo', 'dist', 'build', 'coverage']);

function markdownFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) markdownFiles(full, out);
    else if (entry.endsWith('.md') || entry.endsWith('.mdx')) out.push(full);
  }
  return out;
}

export interface Offence {
  file: string;
  line: number;
  text: string;
}

/** Exported so the injection proof can exercise the rule against fixture text. */
export function findOffences(source: string, file = '<inline>'): Offence[] {
  const offences: Offence[] = [];
  source.split('\n').forEach((raw, index) => {
    if (!HTTP_CLIENT.test(raw)) return;
    if (!ASSERTED_AUTHZ_HEADER.test(raw)) return;
    offences.push({ file, line: index + 1, text: raw.trim().slice(0, 140) });
  });
  return offences;
}

describe('docs/ carries no runnable authorization-bypass recipe', () => {
  it('pairs no command-line HTTP client with a caller-asserted authz header', () => {
    const offences: Offence[] = [];
    for (const file of markdownFiles(DOCS_ROOT)) {
      offences.push(...findOffences(readFileSync(file, 'utf8'), relative(REPO_ROOT, file)));
    }

    expect(
      offences,
      offences.length === 0
        ? ''
        : [
            'A public doc contains a runnable request that asserts identity, role, tenant',
            'or an operator secret. Take the value from an operator-supplied env var and',
            'skip when unset (see docs/LAUNCH_PACKAGE.md), or remove the request and leave',
            'the finding: "[reproduction detail withheld — see internal gap register]".',
            '',
            ...offences.map((o) => `  ${o.file}:${o.line}  ${o.text}`),
          ].join('\n'),
    ).toEqual([]);
  });

  it('actually catches the thing it claims to catch', () => {
    // The rule is only worth having if it has been seen to fail. These fixtures
    // are the exact shapes that were removed from docs/ in this change.
    const caught = [
      `curl -s https://api.example.test/api/data -H 'x-org-id: anything'`,
      `curl -si -H "x-clerk-user-id: user_forged" https://api.example.test/api/me/role`,
      `wget --header='x-user-role: super-admin' https://api.example.test/api/thing`,
    ];
    for (const line of caught) {
      expect(findOffences(line), `should have been caught: ${line}`).toHaveLength(1);
    }

    // …and does not fire on the documentation we deliberately keep.
    const allowed = [
      'curl -fsS https://api.vitalcv.com/health',
      'The backend reads `x-clerk-user-id` only after `verifiedIdentity` rewrites it.',
      'curl -s "$BACKEND/api/findings?limit=1" -H "$SMOKE_AUTH_HEADER"',
      '| G1 | Header-trust authentication | authMiddleware.ts:4-11 | open |',
    ];
    for (const line of allowed) {
      expect(findOffences(line), `false positive on: ${line}`).toHaveLength(0);
    }
  });
});
