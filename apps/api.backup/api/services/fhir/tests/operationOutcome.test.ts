import { describe, expect, it } from 'vitest';
import { buildOperationOutcome, outcomeFromValidation } from '../../fhir/operationOutcome';

describe('operation outcome helpers', () => {
  it('wraps issues into OperationOutcome', () => {
    const outcome = buildOperationOutcome([{
      severity: 'error',
      code: 'invalid',
      diagnostics: 'Bad input',
    }]);

    expect(outcome.resourceType).toBe('OperationOutcome');
    expect(outcome.issue).toHaveLength(1);
  });

  it('converts validation issues', () => {
    const outcome = outcomeFromValidation('Practitioner', [{
      message: 'identifier missing',
      path: '/identifier',
    }]);

    expect(outcome.issue[0].diagnostics).toContain('identifier');
    expect(outcome.issue[0].expression?.[0]).toBe('identifier');
  });
});

import { describe, expect, it } from 'vitest';
import { buildOperationOutcome, outcomeFromValidation } from '../../fhir/operationOutcome';

describe('OperationOutcome helpers', () => {
  it('builds outcome from issues', () => {
    const outcome = buildOperationOutcome([{
      severity: 'error',
      code: 'invalid',
      diagnostics: 'Missing field',
    }]);

    expect(outcome.issue).toHaveLength(1);
  });

  it('converts validation issues to OperationOutcome', () => {
    const outcome = outcomeFromValidation('Practitioner', [{
      message: 'identifier is required',
      path: '/identifier',
    }]);

    expect(outcome.issue[0].diagnostics).toContain('identifier');
    expect(outcome.issue[0].expression?.[0]).toBe('identifier');
  });
});


