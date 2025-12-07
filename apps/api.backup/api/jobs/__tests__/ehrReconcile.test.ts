import { describe, expect, it } from '@jest/globals';
import { diffPrivilegeAssignments, normalizePrivilegeCodes } from '../ehr/reconcile';

describe('normalizePrivilegeCodes', () => {
  it('deduplicates codes from strings and objects', () => {
    const result = normalizePrivilegeCodes([
      'P001',
      { code: 'P002' },
      { name: 'Fallback' },
      'p001',
    ]);
    expect(result).toEqual(['P001', 'P002', 'FALLBACK']);
  });

  it('unwraps nested procedures array', () => {
    const result = normalizePrivilegeCodes({
      procedures: [
        { code: 'CARD-1' },
        { name: 'IMMEDIATE-CARE' },
      ],
    });
    expect(result).toEqual(['CARD-1', 'IMMEDIATE-CARE']);
  });
});

describe('diffPrivilegeAssignments', () => {
  it('identifies missing and unexpected codes', () => {
    const diff = diffPrivilegeAssignments(['A', 'B', 'C'], ['B', 'C', 'D']);
    expect(diff.missing).toEqual(['A']);
    expect(diff.unexpected).toEqual(['D']);
    expect(diff.inSync).toBe(false);
  });

  it('marks assignments in sync', () => {
    const diff = diffPrivilegeAssignments(['x', 'y'], ['Y', 'X']);
    expect(diff.missing).toHaveLength(0);
    expect(diff.unexpected).toHaveLength(0);
    expect(diff.inSync).toBe(true);
  });
});
