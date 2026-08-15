/**
 * Machine-checked writer inventory for durable employer-decision records
 * (ADR 0007 — one employer decision service).
 *
 * `EmployerAcceptance` and `StartAttestation` are the durable records behind
 * the product's canonical transaction; every past incident in this area came
 * from a SECOND writer with different semantics (wave-122's unmounted
 * `routes/employer-action.ts` wrote acceptances with no audit event and no
 * duplicate guard; hiring.ts billed a start the UI door did not). The columns
 * only mean one thing while exactly one module writes them — employerId means
 * ORGANIZATION id only because the single writer resolves it that way.
 *
 * WHAT THIS ASSERTS AND WHY IT IS A SOURCE-LEVEL CHECK
 * Same reasoning as startPathDoesNotBill.test.ts: a behavioural assertion
 * would need every forbidden writer to be mounted and reachable in a test
 * environment — the unmounted-but-live writer is exactly the defect this
 * exists to catch. So it walks the served source tree and asserts the closure:
 * the set of non-test files containing each create call equals the allowlist.
 *
 * ADDING A FILE TO AN ALLOWLIST REQUIRES AN ADR. A new writer is a change to
 * what the columns mean, not a code detail — record it in docs/adr/ (see
 * 0007-one-employer-decision-service.md) and cite the ADR in the PR before
 * extending a list here. Known upcoming addition: PR #1378 lands
 * `services/opportunities/employerWorkflowService.ts` as door A's writer —
 * that PR extends EMPLOYER_ACCEPTANCE_WRITERS with it under ADR 0007.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const SRC_ROOT = join(__dirname, '..');

/** The only modules permitted to create durable EmployerAcceptance rows. */
const EMPLOYER_ACCEPTANCE_WRITERS = [
  'src/services/entity/employerReviewActions.ts',
];

/** The only modules permitted to create StartAttestation rows. */
const START_ATTESTATION_WRITERS = [
  'src/services/hiring/startWriter.ts',
];

function isTestPath(relPath: string): boolean {
  return (
    relPath.split(sep).includes('__tests__')
    || relPath.endsWith('.test.ts')
    || relPath.endsWith('.spec.ts')
  );
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      if (entry === 'node_modules') continue;
      walk(full, out);
    } else if (/\.(ts|tsx|js|mjs|cjs)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Every non-test source file whose CODE contains `<model>.create`. Comments
 * are stripped first so prose about the rule cannot satisfy or trip it.
 */
function filesCreating(model: string): string[] {
  const needle = new RegExp(`\\b${model}\\s*\\.\\s*create\\b`);
  const stripComments = (src: string): string =>
    src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

  return walk(SRC_ROOT)
    .map((file) => relative(join(SRC_ROOT, '..'), file).split(sep).join('/'))
    .filter((relPath) => !isTestPath(relPath))
    .filter((relPath) => {
      const source = readFileSync(join(SRC_ROOT, '..', relPath), 'utf8');
      return needle.test(stripComments(source));
    })
    .sort();
}

describe('durable employer-decision writer inventory (ADR 0007)', () => {
  it('EmployerAcceptance has exactly the allowlisted writers', () => {
    expect(filesCreating('employerAcceptance')).toEqual(
      [...EMPLOYER_ACCEPTANCE_WRITERS].sort(),
    );
  });

  it('StartAttestation has exactly the allowlisted writers', () => {
    expect(filesCreating('startAttestation')).toEqual(
      [...START_ATTESTATION_WRITERS].sort(),
    );
  });

  it('every allowlisted writer actually exists and writes', () => {
    // A stale allowlist entry would make the equality assertions above fail
    // closed, but name the defect here so the failure reads correctly.
    for (const relPath of [...EMPLOYER_ACCEPTANCE_WRITERS, ...START_ATTESTATION_WRITERS]) {
      expect(() => readFileSync(join(SRC_ROOT, '..', relPath), 'utf8')).not.toThrow();
    }
  });
});
