import { describe, expect, it } from '@jest/globals';
import {
  DEFAULT_SEVERITY_STATE_MAP,
  PRIVILEGE_SAFETY_STATE_VALUES,
  SAFETY_SIGNAL_SEVERITY_ORDER,
  PRIVILEGE_STATE_ORDER,
  appendCascadeScope,
  buildPrivilegeSafetyState,
  compareSignalSeverity,
  compareStateSeverity,
  isBlockingState,
  mapSeverityToState,
  mergeSignalIds,
} from '../models/PrivilegeSafetyState';
import { PrivilegeDependencyType, PrivilegeSafetyStateValue, SafetySignalSeverity } from '@prisma/client';

describe('PrivilegeSafetyState model helpers', () => {
  it('normalizes privilege codes and enforces schema', () => {
    const record = buildPrivilegeSafetyState({
      clinicianId: 'clinician-1',
      orgId: 'org-1',
      privilegeCode: 'central line ',
      state: PrivilegeSafetyStateValue.HOLD,
      reasonCode: 'SAFETY:NPDB',
      severity: SafetySignalSeverity.CRITICAL,
      source: 'autoHold',
      signalIds: ['sig-1'],
      metadata: { foo: 'bar' },
    });

    expect(record.privilegeCode).toBe('CENTRAL-LINE');
    expect(record.signalIds).toEqual(['sig-1']);
  });

  it('maps severities using defaults and overrides', () => {
    expect(mapSeverityToState(SafetySignalSeverity.CRITICAL)).toBe(DEFAULT_SEVERITY_STATE_MAP.CRITICAL);
    const overrides = { CRITICAL: PrivilegeSafetyStateValue.SUSPENDED };
    expect(mapSeverityToState(SafetySignalSeverity.CRITICAL, overrides)).toBe(
      PrivilegeSafetyStateValue.SUSPENDED,
    );
  });

  it('compares state + signal severity according to ordering tables', () => {
    expect(compareStateSeverity(PrivilegeSafetyStateValue.FULL, PrivilegeSafetyStateValue.HOLD)).toBeLessThan(0);
    expect(compareStateSeverity(PrivilegeSafetyStateValue.SUSPENDED, PrivilegeSafetyStateValue.RESTRICTED)).toBeGreaterThan(0);
    expect(compareSignalSeverity(SafetySignalSeverity.LOW, SafetySignalSeverity.MEDIUM)).toBeLessThan(0);
    expect(Object.keys(PRIVILEGE_STATE_ORDER)).toEqual(Object.keys(PRIVILEGE_SAFETY_STATE_VALUES));
    expect(Object.keys(SAFETY_SIGNAL_SEVERITY_ORDER)).toContain(SafetySignalSeverity.HIGH);
  });

  it('detects blocking states', () => {
    expect(isBlockingState(PrivilegeSafetyStateValue.FULL)).toBe(false);
    expect(isBlockingState(PrivilegeSafetyStateValue.PENDING_REVIEW)).toBe(true);
    expect(isBlockingState(PrivilegeSafetyStateValue.SUSPENDED)).toBe(true);
  });

  it('merges signal ids without duplicates', () => {
    expect(mergeSignalIds(['a', 'b'], ['b', 'c'])).toEqual(['a', 'b', 'c']);
    expect(mergeSignalIds(undefined, ['x'])).toEqual(['x']);
  });

  it('appends cascade scopes and drops empty payloads', () => {
    expect(appendCascadeScope(undefined, undefined)).toBeUndefined();
    const scope = appendCascadeScope(
      [
        {
          originPrivilegeCode: 'A',
          dependencyType: PrivilegeDependencyType.REQUIRES,
          path: ['A', 'B'],
        },
      ],
      {
        originPrivilegeCode: 'A',
        dependencyType: 'CONFLICT',
        path: ['A', 'C'],
      },
    );

    expect(scope).toHaveLength(2);
    expect(scope?.[1]).toMatchObject({ dependencyType: 'CONFLICT' });
  });
});

