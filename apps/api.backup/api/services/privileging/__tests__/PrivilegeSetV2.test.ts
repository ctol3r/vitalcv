import {
  CreatePrivilegeSetV2Schema,
  ensurePrivilegeCodesExist,
  normalizePrivilegeCodes,
} from '../models/PrivilegeSetV2';
import { buildPrivilegeMatrixEntry } from '../models/PrivilegeMatrix';

describe('PrivilegeSetV2 model', () => {
  const privilegeA = buildPrivilegeMatrixEntry({
    specialty: 'Cardiology',
    privilegeCode: 'card cath adult',
    name: 'Adult Diagnostic Cath',
    description: 'Performs diagnostic cardiac catheterizations.',
  });

  const privilegeB = buildPrivilegeMatrixEntry({
    specialty: 'Cardiology',
    privilegeCode: 'CARD-PCI',
    name: 'Percutaneous Coronary Intervention',
    description: 'Performs PCI with stent placement.',
  });

  it('validates privilege set creation payloads', () => {
    const parsed = CreatePrivilegeSetV2Schema.parse({
      orgId: 'org-123',
      name: 'Cath Lab Core',
      specialty: 'Cardiology',
      privilegeCodes: ['card cath adult', 'card-pci'],
    });

    expect(parsed.orgId).toBe('org-123');
  });

  it('deduplicates privilege codes', () => {
    const normalized = normalizePrivilegeCodes(['card cath adult', 'CARD-CATH-ADULT', 'card-pci']);
    expect(normalized).toEqual(['CARD-CATH-ADULT', 'CARD-PCI']);
  });

  it('ensures privilege codes exist in matrix', () => {
    const normalized = ensurePrivilegeCodesExist(['card cath adult'], [privilegeA, privilegeB]);
    expect(normalized).toEqual(['CARD-CATH-ADULT']);

    expect(() => ensurePrivilegeCodesExist(['UNKNOWN-CODE'], [privilegeA])).toThrow(/Unknown privilege codes/);
  });
});

