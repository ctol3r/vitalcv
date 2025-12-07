import { buildPrivilegeMatrixEntry } from '../models/PrivilegeMatrix';
import { validatePrivilegeRequest } from '../validators/validatePrivilegeRequest';

const cathPrivilege = buildPrivilegeMatrixEntry({
  specialty: 'Cardiology',
  privilegeCode: 'CARD-CATH-ADULT',
  name: 'Adult Cardiac Catheterization',
  description: 'Performs diagnostic and interventional cath lab procedures.',
  prerequisites: [
    {
      type: 'BOARD_CERT',
      boards: ['ABIM'],
      specialties: ['Cardiovascular'],
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

const controlledSubstancePrivilege = buildPrivilegeMatrixEntry({
  specialty: 'Cardiology',
  privilegeCode: 'CARD-DEACARD',
  name: 'Cardiology Controlled Substances',
  description: 'Prescribes controlled substances for inpatient cardiology.',
  prerequisites: [
    {
      type: 'DEA_REGISTRATION',
      schedules: ['II', 'III'],
    },
    {
      type: 'LICENSE_STATUS',
      states: ['CA'],
      status: 'ACTIVE',
    },
  ],
});

describe('validatePrivilegeRequest', () => {
  it('passes when clinician meets all prerequisites', () => {
    const result = validatePrivilegeRequest({
      privilegeSetSpecialty: 'Cardiology',
      privilegeCodes: ['CARD-CATH-ADULT'],
      privileges: [cathPrivilege],
      clinician: {
        clinicianDid: 'did:example:123',
        specialty: 'Cardiology',
        boardCertifications: [
          {
            board: 'ABIM',
            specialty: 'Cardiovascular Disease',
            certifiedAt: '2018-01-01',
            expiresAt: '2030-01-01',
          },
        ],
        procedureVolumes: [
          {
            procedureName: 'Cardiac Catheterization',
            count: 60,
            lookbackMonths: 24,
          },
        ],
        licenses: [
          {
            state: 'CA',
            status: 'ACTIVE',
            expiresAt: '2030-01-01',
          },
        ],
        deaRegistrations: [
          {
            number: 'AB1234567',
            schedules: ['II', 'III', 'IV'],
            expiresAt: '2028-01-01',
          },
        ],
      },
    });

    expect(result.valid).toBe(true);
    expect(result.failed).toHaveLength(0);
  });

  it('fails when prerequisites are not met', () => {
    const result = validatePrivilegeRequest({
      privilegeSetSpecialty: 'Cardiology',
      privilegeCodes: ['CARD-DEACARD'],
      privileges: [controlledSubstancePrivilege],
      clinician: {
        clinicianDid: 'did:example:456',
        specialty: 'Internal Medicine',
        boardCertifications: [],
        procedureVolumes: [],
        licenses: [
          {
            state: 'NV',
            status: 'ACTIVE',
            expiresAt: '2030-01-01',
          },
        ],
        deaRegistrations: [],
      },
    });

    expect(result.valid).toBe(false);
    expect(result.matchedSpecialty).toBe(false);
    expect(result.failed).toHaveLength(2);
    expect(result.failed[0].reason).toContain('DEA registration');
  });
});

