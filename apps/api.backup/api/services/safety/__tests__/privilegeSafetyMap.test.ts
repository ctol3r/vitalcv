import { describe, expect, it } from '@jest/globals';
import {
  filterPrivilegesForSignal,
  getDefaultPrivilegesForSignal,
  getSignalTypesForPrivilege,
  isSignalGlobal,
  normalizeSignalType,
} from '../mapping/privilegeSafetyMap.js';

describe('privilegeSafetyMap', () => {
  it('maps anesthesia privileges to DEA signal', () => {
    const signals = getSignalTypesForPrivilege('anes-general');
    expect(signals).toContain('DEA_EXPIRED');
  });

  it('normalizes legacy signal identifiers', () => {
    expect(normalizeSignalType('LIC_EXPIRED')).toBe('LICENSE_RISK');
  });

  it('filters privileges for a given signal', () => {
    const privileges = ['DEA-REGISTERED', 'BOARD-CERT'];
    const filtered = filterPrivilegesForSignal(privileges, 'DEA_EXPIRED');
    expect(filtered).toEqual(['DEA-REGISTERED']);
  });

  it('provides global coverage defaults', () => {
    expect(isSignalGlobal('LICENSE_RISK')).toBe(true);
    expect(getDefaultPrivilegesForSignal('NPDB_FLAG')).toEqual(['ALL_PRIVILEGES']);
  });
});

