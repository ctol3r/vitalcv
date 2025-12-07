import {
  buildPrivilegeMatrixEntry,
  describePrerequisite,
  filterPrivilegeMatrixEntries,
  PrivilegeMatrixEntry,
} from '../models/PrivilegeMatrix';

describe('PrivilegeMatrix model', () => {
  const sampleEntry = buildPrivilegeMatrixEntry({
    specialty: 'Cardiology',
    privilegeCode: ' card cath adult ',
    name: 'Adult Cardiac Catheterization',
    description: 'Performs diagnostic and interventional cath lab procedures.',
    prerequisites: [
      {
        type: 'BOARD_CERT',
        boards: ['ABIM'],
        specialties: ['Cardiovascular Disease'],
        expirationBufferMonths: 6,
      },
      {
        type: 'PROCEDURE_VOLUME',
        procedureName: 'Cardiac Catheterization',
        minProcedures: 50,
        lookbackMonths: 24,
      },
    ],
  });

  it('normalizes privilege codes', () => {
    expect(sampleEntry.privilegeCode).toBe('CARD-CATH-ADULT');
  });

  it('filters privileges by specialty and text search', () => {
    const result = filterPrivilegeMatrixEntries([sampleEntry], {
      specialty: 'cardiology',
      search: 'catheterization',
    });
    expect(result).toHaveLength(1);
    expect(result[0].privilegeCode).toBe('CARD-CATH-ADULT');
  });

  it('generates human-friendly prerequisite descriptions', () => {
    const summary = describePrerequisite(sampleEntry.prerequisites[0]);
    expect(summary).toContain('Board certification');
    expect(summary).toContain('ABIM');
  });

  it('rejects invalid privilege data', () => {
    expect(() =>
      buildPrivilegeMatrixEntry({
        specialty: '',
        privilegeCode: 'bad code',
        name: 'Nope',
        description: 'short',
      } as unknown as PrivilegeMatrixEntry)
    ).toThrow();
  });
});


