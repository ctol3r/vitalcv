/**
 * Reading a passport must never create a person.
 *
 * `GET /api/passport/npi/:npi` is public and unauthenticated. It called
 * `buildPassportByNpi`, which called `resolveEntityFromNpi`, which runs an
 * unconditional `prisma.vcvEntity.upsert` writing the subject's legal name,
 * NPI, specialty, credentials, taxonomies and ADDRESS.
 *
 * So anyone could make VitalCV persist a named record — with address — for any
 * of ~1.3M US clinicians by requesting a URL. None of those people asked for
 * it. The homepage promises entering an NPI "starts nothing you don't
 * approve"; merely looking started something.
 *
 * The write also happened BEFORE `buildPassport`, so a 404 was never evidence
 * that nothing was stored — which is exactly why it stayed invisible. The
 * observable response for an unknown NPI is identical either way, so only the
 * side effect distinguishes the two.
 *
 * WHY THIS IS A SOURCE ASSERTION RATHER THAN A BEHAVIOURAL ONE.
 * `passportService.ts` cannot be imported under ts-jest AT ALL — on unmodified
 * main it dies loading `profileEnrichment.ts` (TS2353), and with a freshly
 * generated client it dies on TS7006 at passportService.ts:1809. Both predate
 * this change. A module that will not load under the runner cannot be tested
 * behaviourally, and that is precisely how a silent write survives: no test can
 * reach it. Recorded as a defect in its own right — the durable fix is to make
 * the module loadable, at which point this should become a mock-prisma test
 * asserting `upsert` is never called.
 *
 * Until then this pins the one thing that regressed, at the only layer that is
 * observable: the call itself.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SERVICE = join(__dirname, '..', 'passportService.ts');
const source = readFileSync(SERVICE, 'utf8');

/** Source with block and line comments stripped — comments may name it freely. */
function codeOnly(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('passportService — a public read is not a write', () => {
  const code = codeOnly(source);

  it('does not call the upserting resolver anywhere', () => {
    // resolveEntityFromNpi() upserts unconditionally. Everything this module
    // serves is a read, so it must not appear outside comments.
    expect(code).not.toMatch(/resolveEntityFromNpi\s*\(/);
  });

  it('does not import the upserting resolver', () => {
    expect(code).not.toMatch(/import[\s\S]{0,200}resolveEntityFromNpi/);
  });

  it('looks entities up read-only, earliest row first', () => {
    const fn = code.slice(code.indexOf('export async function buildPassportByNpi'));
    const body = fn.slice(0, fn.indexOf('\n}'));

    expect(body).toMatch(/vcvEntity\.findFirst/);
    // Deterministic when an NPI has more than one row, matching
    // resolveEmployerReviewSubjectByNpi.
    expect(body).toMatch(/orderBy:\s*\{\s*createdAt:\s*'asc'\s*\}/);
    // Null makes the route 404 — the same response an unknown NPI already got,
    // so the public contract is unchanged and only the side effect is gone.
    expect(body).toMatch(/return null/);
  });

  it('creates no entity anywhere in the module', () => {
    expect(code).not.toMatch(/vcvEntity\.(upsert|create)\s*\(/);
  });
});
