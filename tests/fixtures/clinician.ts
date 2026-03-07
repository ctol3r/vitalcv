export interface ClinicianFixture {
  npi: string;
  holderDid: string;
  firstName: string;
  lastName: string;
  taxonomyCode: string;
  taxonomyDescription: string;
  state: string;
  licenseNumber: string;
}

function buildNpi(seed: number): string {
  const suffix = String(seed % 1_000_000_000).padStart(9, '0');
  return `8${suffix}`;
}

export function createClinicianFixture(seed = Date.now()): ClinicianFixture {
  const npi = buildNpi(seed);

  return {
    npi,
    holderDid: `did:vitalcv:clinician:${npi}`,
    firstName: 'Avery',
    lastName: `Wave${String(seed).slice(-4)}`,
    taxonomyCode: '207Q00000X',
    taxonomyDescription: 'Family Medicine Physician',
    state: 'CA',
    licenseNumber: `A${String(seed).slice(-6)}`,
  };
}

export function buildLicenseClaims(
  clinician: ClinicianFixture,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    npi: clinician.npi,
    givenName: clinician.firstName,
    familyName: clinician.lastName,
    state: clinician.state,
    licenseNumber: clinician.licenseNumber,
    taxonomyCode: clinician.taxonomyCode,
    taxonomyDescription: clinician.taxonomyDescription,
    ...overrides,
  };
}
