/**
 * TrustSpec 0.1 validation suite (PTC Wave P1).
 *
 * Exit-gate structure:
 *  - every validation error code has at least one invalid fixture that fails
 *    on exactly that rule (the closure test proves the mapping is exhaustive,
 *    so a silently retired rule turns this suite red);
 *  - valid fixtures, including one exercising every operator, pass with zero
 *    errors;
 *  - error ordering is deterministic and numeric-path aware.
 *
 * All fixtures are synthetic. Nothing here evaluates evidence, reads a clock,
 * or implies acceptance — see the module doc in trustSpec.ts.
 */

import { describe, expect, it } from 'vitest';

import {
  MAX_CONDITION_DEPTH,
  TRUST_SPEC_OPERATORS,
  TRUST_SPEC_SCHEMA_VERSION,
  TRUST_SPEC_VALIDATION_ERROR_CODES,
  validateTrustSpec,
  type TrustSpecValidationErrorCode,
} from './trustSpec';
import {
  INVALID_TRUST_SPEC_FIXTURES,
  MULTI_ERROR_ORDERING_FIXTURE,
  TYPED_VALID_SPEC,
  VALID_TRUST_SPEC_FIXTURES,
} from './fixtures/trustSpecValidation';

describe('TrustSpec 0.1 contract constants', () => {
  it('pins the schema version and the closed operator set', () => {
    expect(TRUST_SPEC_SCHEMA_VERSION).toBe('0.1');
    expect(TRUST_SPEC_OPERATORS).toEqual([
      'EVIDENCE_EXISTS',
      'VALUE_EQUALS',
      'VALUE_IN',
      'COUNT_AT_LEAST',
      'SOURCE_IN',
      'FRESH_WITHIN',
      'JURISDICTION_EQUALS',
      'ALL_OF',
      'ANY_OF',
      'NOT',
      'MANUAL_REVIEW',
    ]);
    expect(MAX_CONDITION_DEPTH).toBe(32);
  });
});

describe('valid TrustSpec fixtures', () => {
  for (const fixture of VALID_TRUST_SPEC_FIXTURES) {
    it(`${fixture.fixtureId}: ${fixture.description}`, () => {
      const result = validateTrustSpec(fixture.inputTrustSpec);
      expect(result.errors).toEqual([]);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.spec).not.toBeNull();
      }
    });
  }

  it('accepts the typed valid spec authored directly against the contract types', () => {
    const result = validateTrustSpec(TYPED_VALID_SPEC);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('returns a deep-frozen copy, never an alias of the input', () => {
    const input = VALID_TRUST_SPEC_FIXTURES[0]!.inputTrustSpec as Record<string, unknown>;
    const result = validateTrustSpec(input);
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.spec).not.toBe(input);
    expect(Object.isFrozen(result.spec)).toBe(true);
    expect(Object.isFrozen(result.spec.requirements)).toBe(true);
    expect(Object.isFrozen(result.spec.requirements[0])).toBe(true);
    expect(Object.isFrozen(result.spec.requirements[0]!.condition)).toBe(true);
  });

  it('never mutates the candidate document', () => {
    const input = VALID_TRUST_SPEC_FIXTURES[1]!.inputTrustSpec;
    const before = JSON.stringify(input);
    validateTrustSpec(input);
    expect(JSON.stringify(input)).toBe(before);
  });
});

describe('invalid TrustSpec fixtures (one red per validation rule)', () => {
  for (const fixture of INVALID_TRUST_SPEC_FIXTURES) {
    it(`${fixture.fixtureId}: ${fixture.description}`, () => {
      const result = validateTrustSpec(fixture.inputTrustSpec);
      expect(result.valid).toBe(false);
      expect(result.spec).toBeNull();
      const distinctCodes = [...new Set(result.errors.map((error) => error.code))].sort();
      expect(distinctCodes).toEqual([...fixture.expectedErrorCodes].sort());
      for (const error of result.errors) {
        expect(typeof error.path).toBe('string');
        expect(error.message.length).toBeGreaterThan(0);
      }
    });
  }

  it('CLOSURE: every validation error code is exercised by a failing fixture', () => {
    const exercised = new Set<TrustSpecValidationErrorCode>(
      INVALID_TRUST_SPEC_FIXTURES.flatMap((fixture) => [...fixture.expectedErrorCodes]),
    );
    const missing = TRUST_SPEC_VALIDATION_ERROR_CODES.filter(
      (code) => !exercised.has(code),
    );
    expect(missing).toEqual([]);
  });

  it('CLOSURE: no fixture claims a code outside the declared union', () => {
    const declared = new Set<string>(TRUST_SPEC_VALIDATION_ERROR_CODES);
    for (const fixture of INVALID_TRUST_SPEC_FIXTURES) {
      for (const code of fixture.expectedErrorCodes) {
        expect(declared.has(code)).toBe(true);
      }
    }
  });
});

describe('deterministic error ordering', () => {
  it('produces identical error lists across repeated validations', () => {
    const first = validateTrustSpec(MULTI_ERROR_ORDERING_FIXTURE.inputTrustSpec);
    const second = validateTrustSpec(MULTI_ERROR_ORDERING_FIXTURE.inputTrustSpec);
    expect(first.errors).toEqual(second.errors);
  });

  it('orders errors by path with numeric-aware segments, then code, then message', () => {
    const result = validateTrustSpec(MULTI_ERROR_ORDERING_FIXTURE.inputTrustSpec);
    expect(result.valid).toBe(false);
    const paths = result.errors.map((error) => error.path);
    // requirement index 2 sorts before index 11 (numeric, not lexical), and
    // /requirements/* sorts before /title.
    expect(paths).toEqual([
      '/requirements/2/necessity',
      '/requirements/11/condition/maxAgeHours',
      '/title',
    ]);
    const codes = result.errors.map((error) => error.code);
    expect(codes).toEqual([
      'NECESSITY_UNKNOWN',
      'FRESHNESS_WINDOW_INVALID',
      'TITLE_EMPTY',
    ]);
  });

  it('reports each distinct dependency cycle exactly once, normalized deterministically', () => {
    const cyclic = INVALID_TRUST_SPEC_FIXTURES.find(
      (fixture) => fixture.fixtureId === 'I022_DEPENDENCY_CYCLE_TRIANGLE',
    )!;
    const result = validateTrustSpec(cyclic.inputTrustSpec);
    expect(result.valid).toBe(false);
    const cycleErrors = result.errors.filter((error) => error.code === 'DEPENDENCY_CYCLE');
    expect(cycleErrors).toHaveLength(1);
    expect(cycleErrors[0]!.message).toBe(
      'dependency cycle: req-a -> req-b -> req-c -> req-a',
    );
    expect(cycleErrors[0]!.path).toBe('/requirements/0/dependsOn');
  });
});

describe('fail-closed behavior', () => {
  it('rejects an unknown schema version outright, never partially validating', () => {
    const result = validateTrustSpec({
      schemaVersion: '9.9',
      specId: 'spec-synthetic',
      specVersion: 1,
      organizationKey: 'org-synthetic',
      title: 'Synthetic',
      requirements: [
        {
          requirementId: 'req-x',
          label: 'X',
          necessity: 'mandatory',
          condition: { operator: 'EVIDENCE_EXISTS', evidenceClass: 'identity' },
          dependsOn: [],
        },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.map((error) => error.code)).toContain(
      'SCHEMA_VERSION_UNSUPPORTED',
    );
  });

  it('rejects an unknown operator without guessing at intent', () => {
    const result = validateTrustSpec({
      schemaVersion: '0.1',
      specId: 'spec-synthetic',
      specVersion: 1,
      organizationKey: 'org-synthetic',
      title: 'Synthetic',
      requirements: [
        {
          requirementId: 'req-x',
          label: 'X',
          necessity: 'mandatory',
          condition: { operator: 'AUTO_APPROVE' },
          dependsOn: [],
        },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.map((error) => error.code)).toContain('OPERATOR_UNKNOWN');
  });
});
