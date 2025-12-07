import { getChecklistTemplate, normalizePrivilegeCode } from '../fppeChecklist';

describe('fppeChecklist templates', () => {
  it('normalizes privilege codes with spaces and punctuation', () => {
    expect(normalizePrivilegeCode(' card cath adult ')).toBe('CARD-CATH-ADULT');
    expect(normalizePrivilegeCode('peds.emerg/sed')).toBe('PEDS-EMERG-SED');
  });

  it('returns specialty-specific targets for cardiology cath lab', () => {
    const checklist = getChecklistTemplate('card cath adult');
    const charts = checklist.items.find((item) => item.key === 'chartsReviewed');
    expect(checklist.specialty).toBe('Cardiology');
    expect(charts?.targetCount).toBe(10);
  });

  it('returns different requirements for pediatric sedation', () => {
    const checklist = getChecklistTemplate('ped-emerg-sed');
    const supervisedCases = checklist.items.find((item) => item.key === 'supervisedCases');
    expect(checklist.specialty).toBe('Pediatric Emergency Medicine');
    expect(supervisedCases?.targetCount).toBe(6);
  });

  it('falls back to default template when code unknown', () => {
    const checklist = getChecklistTemplate('unknown-skill');
    expect(checklist.privilegeCode).toBe('UNKNOWN-SKILL');
    expect(checklist.items).toHaveLength(3);
    const totals = checklist.items.map((item) => item.targetCount);
    expect(totals).toEqual(expect.arrayContaining([6, 3, 2]));
  });
});

