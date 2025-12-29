import jwt from 'jsonwebtoken';

export type ClinicianIdentityProfile = {
  did: string;
  name: string;
  npi: string;
  specialty: string;
};

const DEMO_ISSUER_LABEL = 'DEMO ISSUER';
const DEFAULT_TTL_SECONDS = Number(process.env.ISSUER_TOKEN_TTL_SECONDS || 60 * 60 * 24 * 7);

function resolveIssuerSecret(): string {
  return process.env.JWT_SECRET || process.env.ISSUER_JWT_SECRET || 'dev-only-secret';
}

export async function issueIdentity(profile: ClinicianIdentityProfile): Promise<string> {
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + DEFAULT_TTL_SECONDS * 1000).toISOString();
  const payload = {
    credentialId: profile.did,
    subjectId: profile.did,
    name: profile.name,
    npi: profile.npi,
    specialty: profile.specialty,
    issuerLabel: DEMO_ISSUER_LABEL,
    issuedAt: issuedAt.toISOString(),
    expiresAt,
  };

  return jwt.sign(payload, resolveIssuerSecret(), {
    algorithm: 'HS256',
    expiresIn: DEFAULT_TTL_SECONDS,
    issuer: DEMO_ISSUER_LABEL,
    subject: profile.did,
  });
}

export async function issueClinicianIdentityVC(profile: ClinicianIdentityProfile): Promise<string> {
  return issueIdentity(profile);
}
