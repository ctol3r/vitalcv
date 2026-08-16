/**
 * Every start route persists through the canonical application-bound start
 * command — never directly.
 *
 * `START_ATTESTED` is one of the five canonical non-repudiation events, so a
 * `StartAttestation` without one is an unprovable claim. The one writer that
 * guarantees the pairing (plus the START_RECORDED lifecycle event and the
 * outbound intent, all in one transaction) is
 * `services/activation/applicationStartCommandService.ts` (ADR 0007,
 * start-writer succession — COMPLETE: the legacy `services/hiring/startWriter.ts`
 * and its last caller were migrated and deleted).
 *
 * This is the ROUTING closure: each start route reaches persistence only
 * through its allowlisted command entry point. The WHOLE-TREE closure — that
 * no other non-test module contains `startAttestation.create` at all — lives
 * in `src/__tests__/acceptanceWriterInventory.test.ts`. The behavioural
 * atomicity proof (both audit rows and the outbox commit with the attestation
 * or nothing persists) lives in
 * `src/services/activation/__tests__/applicationStartCommand.db.test.ts`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROUTES = join(__dirname, '..');

const stripComments = (src: string): string => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('no route writes a start on its own', () => {
  it.each([
    // The machine lane adapts acceptance-keyed input onto the command.
    ['hiring.ts', /confirmStartByAcceptance\s*\(/],
    // The application surface runs the command directly.
    ['activation.ts', /confirmApplicationStart\s*\(/],
    // Door B (entity-scoped confirm-start) adapts onto the command too —
    // this line completes the succession ADR 0007 recorded as its follow-up.
    ['employerActions.ts', /confirmStartByAcceptance\s*\(/],
  ] as const)(
    '%s persists its start through the canonical command, not directly',
    (file, writerCall) => {
      const code = stripComments(readFileSync(join(ROUTES, file), 'utf8'));

      expect(code).not.toMatch(/startAttestation\s*\.\s*create/);
      expect(code).toMatch(writerCall);
    },
  );

  it('no route imports a start writer other than the canonical command', () => {
    // The retired legacy writer must not be quietly recreated and re-imported.
    for (const file of ['hiring.ts', 'activation.ts', 'employerActions.ts']) {
      const code = stripComments(readFileSync(join(ROUTES, file), 'utf8'));
      expect(code).not.toMatch(/services\/hiring\/startWriter/);
    }
  });
});
