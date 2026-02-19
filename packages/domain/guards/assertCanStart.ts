import { DomainError } from '../../domain-common/src/errors/DomainError';
import { EmployerAcceptance } from '../events/EmployerAcceptance';
import { StartAttestation } from '../events/StartAttestation';

export function assertCanStart(
  acceptance: EmployerAcceptance | null | undefined,
  priorStarts: StartAttestation[] = [],
): asserts acceptance is EmployerAcceptance {
  if (!acceptance) {
    throw new DomainError('Acceptance is required before start', 'MISSING_ACCEPTANCE');
  }

  const alreadyStarted = priorStarts.some(
    (start) => start.acceptanceId === acceptance.acceptanceId,
  );

  if (alreadyStarted) {
    throw new DomainError('Start already exists for this acceptance', 'START_EXISTS');
  }
}
