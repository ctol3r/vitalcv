export type ClinicianIdentityProfile = {
  did: string;
  name: string;
  npi: string;
  specialty: string;
};

const DEMO_ISSUER_LABEL = 'DEMO ISSUER';

export async function issueIdentity(profile: ClinicianIdentityProfile): Promise<string> {
  return `${DEMO_ISSUER_LABEL}: clinician=${profile.did}`;
}

export async function issueClinicianIdentityVC(profile: ClinicianIdentityProfile): Promise<string> {
  return issueIdentity(profile);
}
