import { mapPrivilegeSetToFHIRProcedures, privilegeToProcedureCode } from '../adapter/privilegeProcedureAdapter';

type PrivilegeMatrixEntry = {
  specialty: string;
  privilegeCode: string;
  name: string;
  description: string;
  prerequisites: Array<{
    type: string;
    boards: string[];
    specialties: string[];
    expirationBufferMonths: number;
  }>;
};

describe('privilegeProcedureAdapter', () => {
  const privilege: PrivilegeMatrixEntry = {
    specialty: 'Cardiology',
    privilegeCode: 'CARD-CATH-ADULT',
    name: 'Adult Cardiac Catheterization',
    description: 'Performs diagnostic cardiac catheterizations.',
    prerequisites: [
      {
        type: 'BOARD_CERT',
        boards: ['ABIM'],
        specialties: ['Cardiovascular'],
        expirationBufferMonths: 6
      }
    ]
  };

  it('converts privilege codes to FHIR coding entries', () => {
    const coding = privilegeToProcedureCode(privilege);
    expect(coding.code).toBe('CARD-CATH-ADULT');
    expect(coding.display).toBe('Adult Cardiac Catheterization');
  });

  it('maps privileges to FHIR Procedure resources', () => {
    const procedures = mapPrivilegeSetToFHIRProcedures({
      privileges: [privilege],
      performerReference: 'Practitioner/123'
    });

    expect(procedures).toHaveLength(1);
    expect(procedures[0].code.coding[0].code).toBe('CARD-CATH-ADULT');
    expect(procedures[0].performer?.[0].actor.reference).toBe('Practitioner/123');
    expect(procedures[0].note?.[0].text).toContain('Prerequisites');
  });
});
