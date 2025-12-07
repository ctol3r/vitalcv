import {
  getPrerequisitesForPrivilege,
  hasOperationalMonitoringRequirement,
  listPrereqSummaries,
} from '../prereqRuleSet';

describe('PrivilegePrereqRuleSet', () => {
  it('returns prerequisite entries with normalized privilege codes', () => {
    const entry = getPrerequisitesForPrivilege('Basic Sedation');
    expect(entry?.privilegeCode).toBe('BASIC-SEDATION');
    expect(entry?.rules.some((rule) => rule.type === 'BOARD_CERT')).toBe(true);
  });

  it('lists summaries keyed by normalized code', () => {
    const summaries = listPrereqSummaries();
    expect(Object.keys(summaries)).toContain('CENTRAL-LINE');
    expect(summaries['UPPER-ENDOSCOPY']).toMatch(/Upper GI/);
  });

  it('detects when OPPE monitoring is required', () => {
    expect(hasOperationalMonitoringRequirement('central line')).toBe(true);
    expect(hasOperationalMonitoringRequirement('arterial line placement')).toBe(false);
  });
});

