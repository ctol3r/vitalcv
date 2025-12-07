import { buildPrivilegeMatrixEntry } from '../../../privileging/models/PrivilegeMatrix';
import { validatePrivilegeBeforeSync } from '../validatePrivilegeBeforeSync';

const clinician = {
  clinicianDid: 'did:vital:123',
  specialty: 'Cardiology',
  boardCertifications: [
    {
      board: 'ABIM',
      specialty: 'Cardiovascular Disease',
      certifiedAt: '2018-01-01',
      expiresAt: '2030-01-01',
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
      schedules: ['II', 'III'],
      expiresAt: '2030-01-01',
    },
  ],
  procedureVolumes: [],
} as const;

describe('validatePrivilegeBeforeSync', () => {
  const boardCertPrivilege = buildPrivilegeMatrixEntry({
    specialty: 'Cardiology',
    privilegeCode: 'CARD-CATH-ADULT',
    name: 'Adult Cardiac Catheterization',
    description: 'Performs diagnostic cardiac catheterizations.',
    prerequisites: [
      {
        type: 'BOARD_CERT',
        boards: ['ABIM'],
        specialties: ['Cardiovascular'],
        expirationBufferMonths: 6,
      },
    ],
  });

  const deaPrivilege = buildPrivilegeMatrixEntry({
    specialty: 'Anesthesiology',
    privilegeCode: 'ANES-GENERAL-ADULT',
    name: 'Adult General Anesthesia',
    description: 'Manages adult general anesthesia.',
    prerequisites: [
      {
        type: 'DEA_REGISTRATION',
        schedules: ['II'],
      },
      {
        type: 'LICENSE_STATUS',
        states: ['CA'],
        status: 'ACTIVE',
        allowProbation: false,
      },
    ],
  });

  it('flags missing blocking prerequisites before sync', () => {
    const result = validatePrivilegeBeforeSync({
      privilegeCodes: ['CARD-CATH-ADULT'],
      privileges: [boardCertPrivilege],
      clinician: {
        ...clinician,
        boardCertifications: [],
      },
      privilegeSetSpecialty: 'Cardiology',
    });

    expect(result.ok).toBe(false);
    expect(result.blockingIssues).toHaveLength(1);
    expect(result.blockingIssues[0].prerequisiteType).toBe('BOARD_CERT');
  });

  it('passes when board, license, and DEA requirements met', () => {
    const result = validatePrivilegeBeforeSync({
      privilegeCodes: ['ANES-GENERAL-ADULT'],
      privileges: [deaPrivilege],
      clinician: clinician,
      privilegeSetSpecialty: 'Anesthesiology',
    });

    expect(result.ok).toBe(true);
    expect(result.blockingIssues).toHaveLength(0);
  });
});
