import { buildEHROrderableMapEntry, normalizeEhrSystem } from '../models/EHROrderableMap';

describe('EHROrderableMap model', () => {
  it('normalizes privilege codes and EHR systems', () => {
    const record = buildEHROrderableMapEntry({
      privilegeCode: ' card cath adult ',
      ehrSystem: 'epic',
      ehrCode: 'E12345',
      description: 'Adult cardiac cath orderable',
    });

    expect(record.privilegeCode).toBe('CARD-CATH-ADULT');
    expect(record.ehrSystem).toBe('EPIC');
  });

  it('deduplicates and sanitizes required roles', () => {
    const record = buildEHROrderableMapEntry({
      privilegeCode: 'anes general',
      ehrSystem: 'CERNER',
      ehrCode: 'CER-ANES-GEN',
      requiredRoles: ['ANES.GENERAL', 'ANES.GENERAL', '  ANES.OB  '],
    });

    expect(record.requiredRoles).toEqual(['ANES.GENERAL', 'ANES.OB']);
  });

  it('rejects unsupported EHR systems', () => {
    expect(() =>
      buildEHROrderableMapEntry({
        privilegeCode: 'rad mri',
        ehrSystem: 'unknown',
        ehrCode: 'X',
      })
    ).toThrow('Unsupported EHR system');
  });

  it('exposes helper to validate EHR system values', () => {
    expect(normalizeEhrSystem('meditech')).toBe('MEDITECH');
    expect(() => normalizeEhrSystem('foobar')).toThrow();
  });
});
