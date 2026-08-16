/**
 * release-truth-scripts.test.ts — Wave 1078.
 *
 * Behavioural tests for the two release-truth scripts, run as real subprocesses
 * against a stub server rather than grepped for strings. A structural test that
 * asserts `script.includes('UNAVAILABLE')` passes just as happily when the
 * comparison behind it is inverted, and both of these scripts exist to catch a
 * failure mode that has actually shipped before — a non-existent NPI rendering
 * as source-backed, and a green deploy that was serving a different commit.
 *
 * So each guard is exercised twice: once against an honest payload (must pass)
 * and once against the exact payload it exists to reject (must fail, non-zero).
 * A guard that has never been observed failing is not known to work.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFile, execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';

const REPO_ROOT = resolve(__dirname, '../../..');
const RELEASE_RECORD = resolve(REPO_ROOT, 'scripts/release-record.mjs');
const NPI_SMOKE = resolve(REPO_ROOT, 'scripts/npi-smoke.mjs');

const execFileAsync = promisify(execFile);

/** Run a script and capture stdout plus the real (unpiped) exit code. */
async function run(script: string, args: string[]): Promise<{ code: number; stdout: string }> {
  try {
    const { stdout } = await execFileAsync('node', [script, ...args], { cwd: REPO_ROOT });
    return { code: 0, stdout };
  } catch (error) {
    const e = error as { code?: number; stdout?: string };
    return { code: typeof e.code === 'number' ? e.code : 1, stdout: e.stdout ?? '' };
  }
}

/**
 * The ancestry classifier needs two commits where one descends from the other.
 * This checkout cannot supply them: CI clones shallow, so `HEAD~1` is not a
 * revision there even though it resolves fine locally. Build a throwaway repo
 * with exactly the history these assertions need and point the script at it
 * with `--repo`, so the test proves the same thing at any clone depth.
 */
const gitRepo = mkdtempSync(join(tmpdir(), 'vitalcv-release-record-'));
const inRepo = (...gitArgs: string[]) =>
  execFileSync('git', gitArgs, { cwd: gitRepo, encoding: 'utf8' }).trim();

inRepo('init', '--quiet', '--initial-branch=main');
inRepo('config', 'user.email', 'test@vitalcv.invalid');
inRepo('config', 'user.name', 'Release Record Test');
writeFileSync(join(gitRepo, 'file.txt'), 'first\n');
inRepo('add', 'file.txt');
inRepo('commit', '--quiet', '-m', 'first');
const PARENT_SHA = inRepo('rev-parse', 'HEAD');
writeFileSync(join(gitRepo, 'file.txt'), 'second\n');
inRepo('add', 'file.txt');
inRepo('commit', '--quiet', '-m', 'second');
const HEAD_SHA = inRepo('rev-parse', 'HEAD');

/** Every release-record run resolves commits against that throwaway repo. */
const runRecord = (args: string[]) => run(RELEASE_RECORD, ['--repo', gitRepo, ...args]);

/** Payloads the stub serves; each test rewrites this before running a script. */
let routes: Record<string, unknown> = {};
let server: Server;
let origin = '';

beforeAll(async () => {
  server = createServer((req, res) => {
    const path = (req.url ?? '').split('?')[0];
    const body = routes[path];
    res.writeHead(body === undefined ? 404 : 200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body ?? { error: 'not stubbed' }));
  });
  await new Promise<void>((ready) => server.listen(0, '127.0.0.1', ready));
  const address = server.address();
  origin = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
});

afterAll(async () => {
  await new Promise<void>((done) => server.close(() => done()));
  rmSync(gitRepo, { recursive: true, force: true });
});

const versionPayload = (commit: string) => ({
  service: 'web',
  commit,
  branch: 'main',
  environment: 'production',
  platform: 'railway',
});

describe('release-record: convergence is ancestry, not a boolean', () => {
  it('reports converged and exits 0 when both services serve the intended SHA', async () => {
    routes = { '/api/version': versionPayload(HEAD_SHA), '/health': { git_sha: HEAD_SHA, git_branch: 'main' } };

    const { code, stdout } = await runRecord(['--sha', HEAD_SHA, '--web', origin, '--api', origin]);
    const record = JSON.parse(stdout);

    expect(code).toBe(0);
    expect(record.verdict.converged).toBe(true);
    expect(record.verdict.states).toEqual({ web: 'converged', api: 'converged' });
  });

  it('reports behind — not merely "not converged" — when the deploy has not landed', async () => {
    routes = { '/api/version': versionPayload(PARENT_SHA), '/health': { git_sha: PARENT_SHA, git_branch: 'main' } };

    const { code, stdout } = await runRecord(['--sha', HEAD_SHA, '--web', origin, '--api', origin]);
    const record = JSON.parse(stdout);

    expect(code).toBe(1);
    expect(record.verdict.states.web).toBe('behind');
    expect(record.services.web.convergence.detail).toContain('behind');
  });

  it('reports ahead when production has moved past the intended SHA', async () => {
    routes = { '/api/version': versionPayload(HEAD_SHA), '/health': { git_sha: HEAD_SHA, git_branch: 'main' } };

    const { code, stdout } = await runRecord(['--sha', PARENT_SHA, '--web', origin, '--api', origin]);
    const record = JSON.parse(stdout);

    expect(code).toBe(1);
    expect(record.verdict.states.web).toBe('ahead');
  });

  it('records unknown with a reason instead of guessing when a service is unreachable', async () => {
    routes = { '/api/version': versionPayload(HEAD_SHA) }; // /health deliberately absent

    const { code, stdout } = await runRecord(['--sha', HEAD_SHA, '--web', origin, '--api', origin]);
    const record = JSON.parse(stdout);

    expect(code).toBe(1);
    expect(record.services.api.convergence.state).toBe('unknown');
    expect(record.services.api.deployedSha).toBeNull();
    expect(record.services.api.reason).toBeTruthy();
  });

  it('never invents a review URL it was not given', async () => {
    routes = { '/api/version': versionPayload(HEAD_SHA), '/health': { git_sha: HEAD_SHA, git_branch: 'main' } };

    const { stdout } = await runRecord(['--sha', HEAD_SHA, '--web', origin, '--api', origin]);

    expect(JSON.parse(stdout).reviewUrl).toBeNull();
  });
});

/** An honest response set: real NPI resolves, absent NPI stays unresolved. */
const honestRoutes = (presentNpi: string, absentNpi: string) => ({
  [`/api/identity/bootstrap/${presentNpi}`]: {
    npi: presentNpi,
    npiType: 'TYPE_1',
    inferredPersona: 'CLINICIAN',
    identitySource: 'NPPES_API',
    firstName: 'REAL',
    lastName: 'CLINICIAN',
    alreadyRegistered: false,
  },
  [`/api/trust-state/${presentNpi}`]: {
    identityVerified: true,
    licensureStatus: 'unknown',
    exclusionClear: true,
    exclusionStatus: 'CLEAR',
    blockers: [],
    sourceCoverage: [{ sourceId: 'NPPES_API', state: 'checked', checkedAt: '2026-08-08T00:00:00.000Z' }],
  },
  [`/api/identity/bootstrap/${absentNpi}`]: {
    npi: absentNpi,
    npiType: 'TYPE_1',
    inferredPersona: 'UNKNOWN',
    identitySource: 'UNAVAILABLE',
    alreadyRegistered: false,
  },
  [`/api/trust-state/${absentNpi}`]: {
    identityVerified: false,
    licensureStatus: 'unknown',
    exclusionClear: false,
    exclusionStatus: 'UNCHECKED',
    blockers: ['Identity not verified'],
    sourceCoverage: [],
  },
  [`/api/matcha/opportunities/${presentNpi}`]: {
    visibility: 'public',
    matches: [{ opportunityId: 'x', fitIndication: 'limited_public_signal' }],
  },
  '/api/status': { source_lanes: { state_license: { lifecycle: 'planned', status: 'pending_integration' } } },
});

describe('npi-smoke: the fabrication guards actually fire', () => {
  const PRESENT = '1558395518';
  const ABSENT = '1999999992';

  it('passes against an honest response set', async () => {
    routes = honestRoutes(PRESENT, ABSENT);

    const { code, stdout } = await run(NPI_SMOKE, ['--base', origin, '--npi', PRESENT, '--absent-npi', ABSENT]);

    expect(stdout).toContain('NPI SMOKE PASS');
    expect(code).toBe(0);
  });

  it('fails when an unknown NPI is given a name — the fabrication that shipped before', async () => {
    routes = {
      ...honestRoutes(PRESENT, ABSENT),
      [`/api/identity/bootstrap/${ABSENT}`]: {
        npi: ABSENT,
        npiType: 'TYPE_1',
        inferredPersona: 'CLINICIAN',
        identitySource: 'NPPES_API',
        firstName: 'INVENTED',
        lastName: 'PERSON',
        alreadyRegistered: false,
      },
    };

    const { code, stdout } = await run(NPI_SMOKE, ['--base', origin, '--npi', PRESENT, '--absent-npi', ABSENT]);

    expect(code).toBe(1);
    expect(stdout).toContain('FAIL  absent: no name is invented');
    expect(stdout).toContain('FABRICATED: INVENTED PERSON');
  });

  it('fails when an unresolved NPI is reported exclusion-clear', async () => {
    routes = {
      ...honestRoutes(PRESENT, ABSENT),
      [`/api/trust-state/${ABSENT}`]: {
        identityVerified: false,
        licensureStatus: 'unknown',
        exclusionClear: true,
        exclusionStatus: 'CLEAR',
        blockers: [],
        sourceCoverage: [],
      },
    };

    const { code, stdout } = await run(NPI_SMOKE, ['--base', origin, '--npi', PRESENT, '--absent-npi', ABSENT]);

    expect(code).toBe(1);
    expect(stdout).toContain('FAIL  absent: exclusion screening is not claimed clear');
  });

  it('fails when licensure reads active while the licensure lane is not connected', async () => {
    routes = {
      ...honestRoutes(PRESENT, ABSENT),
      [`/api/trust-state/${PRESENT}`]: {
        identityVerified: true,
        licensureStatus: 'active',
        exclusionClear: true,
        exclusionStatus: 'CLEAR',
        blockers: [],
        sourceCoverage: [{ sourceId: 'NPPES_API', state: 'checked', checkedAt: '2026-08-08T00:00:00.000Z' }],
      },
    };

    const { code, stdout } = await run(NPI_SMOKE, ['--base', origin, '--npi', PRESENT, '--absent-npi', ABSENT]);

    expect(code).toBe(1);
    expect(stdout).toContain('FAIL  licensure: lane not connected, status is not affirmative');
  });

  it('allows an affirmative licensure status once the lane is genuinely live', async () => {
    // The guard tracks the lane rather than pinning the string, so connecting a
    // real licensure source must not require editing this smoke test.
    routes = {
      ...honestRoutes(PRESENT, ABSENT),
      [`/api/trust-state/${PRESENT}`]: {
        identityVerified: true,
        licensureStatus: 'active',
        exclusionClear: true,
        exclusionStatus: 'CLEAR',
        blockers: [],
        sourceCoverage: [{ sourceId: 'NPPES_API', state: 'checked', checkedAt: '2026-08-08T00:00:00.000Z' }],
      },
      '/api/status': { source_lanes: { state_license: { lifecycle: 'active', status: 'operational' } } },
    };

    const { code, stdout } = await run(NPI_SMOKE, ['--base', origin, '--npi', PRESENT, '--absent-npi', ABSENT]);

    expect(stdout).toContain('PASS  licensure: lane is live, status may be affirmative');
    expect(code).toBe(0);
  });

  it('fails when a real NPI stops resolving against the registry', async () => {
    routes = {
      ...honestRoutes(PRESENT, ABSENT),
      [`/api/identity/bootstrap/${PRESENT}`]: {
        npi: PRESENT,
        npiType: 'TYPE_1',
        inferredPersona: 'UNKNOWN',
        identitySource: 'UNAVAILABLE',
        alreadyRegistered: false,
      },
    };

    const { code, stdout } = await run(NPI_SMOKE, ['--base', origin, '--npi', PRESENT, '--absent-npi', ABSENT]);

    expect(code).toBe(1);
    expect(stdout).toContain('FAIL  present: attributed to NPPES');
  });
});
