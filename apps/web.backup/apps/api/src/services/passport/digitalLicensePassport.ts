import { PrismaClient } from '@prisma/client';
import { ChainClient } from '../chain/client';

const prisma = new PrismaClient();
import { createHash } from 'crypto';

const chainClient = new ChainClient();

export interface LicensePassportData {
  licenses: Array<{
    state: string;
    licenseNumber: string;
    status: string;
    expirationDate?: string;
    issueDate?: string;
  }>;
  compactMemberships?: string[];
  reciprocity?: Record<string, boolean>;
}

export interface PassportEligibility {
  eligible: boolean;
  reasons: string[];
  compactEligible: string[];
  reciprocityEligible: string[];
}

/**
 * Build a consolidated passport VC from all licenses
 */
export async function buildPassport(clinicianId: string): Promise<{
  passport: LicensePassportData;
  version: number;
}> {
  // Fetch all licenses for clinician
  const licenses = await prisma.globalLicense.findMany({
    where: { clinicianId, status: 'active' },
    select: {
      state: true,
      licenseNumber: true,
      status: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  // Fetch compact memberships
  const compacts = await prisma.compactEligibility.findMany({
    where: { clinicianId, eligible: true },
    select: { compact: true },
  });

  // Build passport data
  const passport: LicensePassportData = {
    licenses: licenses.map((l) => ({
      state: l.state || '',
      licenseNumber: l.licenseNumber,
      status: l.status,
      expirationDate: l.expiresAt?.toISOString(),
      issueDate: l.createdAt.toISOString(),
    })),
    compactMemberships: compacts.map((c) => c.compact),
    reciprocity: {},
  };

  // Get existing passport to determine version
  const existing = await prisma.digitalLicensePassport.findUnique({
    where: { clinicianId },
  });

  const version = existing ? existing.version + 1 : 1;

  // Save passport
  await prisma.digitalLicensePassport.upsert({
    where: { clinicianId },
    create: {
      clinicianId,
      passport: passport as any,
      version,
    },
    update: {
      passport: passport as any,
      version,
    },
  });

  return { passport, version };
}

/**
 * Validate passport eligibility (reciprocity, compact membership, expiration)
 */
export async function validatePassportEligibility(
  clinicianId: string,
  targetState?: string,
): Promise<PassportEligibility> {
  const passport = await prisma.digitalLicensePassport.findUnique({
    where: { clinicianId },
  });

  if (!passport) {
    return {
      eligible: false,
      reasons: ['No passport found'],
      compactEligible: [],
      reciprocityEligible: [],
    };
  }

  const data = passport.passport as LicensePassportData;
  const reasons: string[] = [];
  const compactEligible: string[] = [];
  const reciprocityEligible: string[] = [];

  // Check compact eligibility
  if (data.compactMemberships && data.compactMemberships.length > 0) {
    compactEligible.push(...data.compactMemberships);
  }

  // Check license expiration
  const expiredLicenses = data.licenses.filter((l) => {
    if (!l.expirationDate) return false;
    return new Date(l.expirationDate) < new Date();
  });

  if (expiredLicenses.length > 0) {
    reasons.push(`${expiredLicenses.length} expired license(s)`);
  }

  // Check active licenses
  const activeLicenses = data.licenses.filter((l) => l.status === 'active');
  if (activeLicenses.length === 0) {
    reasons.push('No active licenses');
  }

  // Check target state if provided
  if (targetState) {
    const hasTargetStateLicense = activeLicenses.some((l) => l.state === targetState);
    if (!hasTargetStateLicense) {
      const hasCompact = compactEligible.some((c) => {
        // Simplified: check if compact covers target state
        return c.toLowerCase().includes(targetState.toLowerCase());
      });
      if (!hasCompact) {
        reasons.push(`No license or compact eligibility for ${targetState}`);
      } else {
        reciprocityEligible.push(targetState);
      }
    } else {
      reciprocityEligible.push(targetState);
    }
  }

  return {
    eligible: reasons.length === 0,
    reasons,
    compactEligible,
    reciprocityEligible,
  };
}

/**
 * Generate SD-JWT selective disclosure passport
 */
export async function generatePassportProof(
  clinicianId: string,
  disclosedFields?: string[],
): Promise<{
  sdJwt: string;
  hash: string;
}> {
  const passport = await prisma.digitalLicensePassport.findUnique({
    where: { clinicianId },
  });

  if (!passport) {
    throw new Error('Passport not found');
  }

  const data = passport.passport as LicensePassportData;

  // Simplified SD-JWT generation (in production, use proper SD-JWT library)
  const payload: Record<string, unknown> = {
    version: passport.version,
    updatedAt: passport.updatedAt.toISOString(),
  };

  // Add disclosed fields
  if (disclosedFields) {
    if (disclosedFields.includes('licenses')) {
      payload.licenses = data.licenses;
    }
    if (disclosedFields.includes('compacts')) {
      payload.compactMemberships = data.compactMemberships;
    }
  } else {
    // Default: disclose all
    payload.licenses = data.licenses;
    payload.compactMemberships = data.compactMemberships;
  }

  // Generate hash
  const hash = createHash('sha256').update(JSON.stringify(payload)).digest('hex');

  // In production, generate actual SD-JWT here
  const sdJwt = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${Buffer.from(JSON.stringify(payload)).toString('base64')}.${hash}`;

  return { sdJwt, hash };
}

/**
 * Detect anomalies in passport (missing or contradictory details)
 */
export async function detectPassportAnomalies(clinicianId: string): Promise<{
  anomalies: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
  }>;
}> {
  const passport = await prisma.digitalLicensePassport.findUnique({
    where: { clinicianId },
  });

  if (!passport) {
    return { anomalies: [] };
  }

  const data = passport.passport as LicensePassportData;
  const anomalies: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
  }> = [];

  // Check for missing licenses
  if (!data.licenses || data.licenses.length === 0) {
    anomalies.push({
      type: 'missing_licenses',
      severity: 'high',
      description: 'No licenses found in passport',
    });
  }

  // Check for contradictory states (same license number in multiple states)
  const licenseNumbers = new Map<string, string[]>();
  data.licenses.forEach((l) => {
    if (!licenseNumbers.has(l.licenseNumber)) {
      licenseNumbers.set(l.licenseNumber, []);
    }
    licenseNumbers.get(l.licenseNumber)!.push(l.state);
  });

  licenseNumbers.forEach((states, licenseNumber) => {
    if (states.length > 1) {
      anomalies.push({
        type: 'duplicate_license',
        severity: 'medium',
        description: `License ${licenseNumber} appears in multiple states: ${states.join(', ')}`,
      });
    }
  });

  // Check for expired licenses
  const expired = data.licenses.filter((l) => {
    if (!l.expirationDate) return false;
    return new Date(l.expirationDate) < new Date();
  });

  if (expired.length > 0) {
    anomalies.push({
      type: 'expired_licenses',
      severity: 'high',
      description: `${expired.length} expired license(s) found`,
    });
  }

  return { anomalies };
}

/**
 * Refresh passport after license change
 */
export async function refreshPassport(clinicianId: string): Promise<void> {
  await buildPassport(clinicianId);

  // Anchor passport hash
  await anchorPassportHash(clinicianId);
}

/**
 * Map passport to NCQA + Joint Commission compliance rules
 */
export async function mapPassportCompliance(
  clinicianId: string,
): Promise<{
  ncqa: Record<string, boolean>;
  jointCommission: Record<string, boolean>;
}> {
  const passport = await prisma.digitalLicensePassport.findUnique({
    where: { clinicianId },
  });

  if (!passport) {
    return { ncqa: {}, jointCommission: {} };
  }

  const data = passport.passport as LicensePassportData;

  // NCQA compliance checks
  const ncqa = {
    hasActiveLicense: data.licenses.some((l) => l.status === 'active'),
    hasExpirationDate: data.licenses.some((l) => l.expirationDate),
    hasMultipleStates: data.licenses.length > 1,
  };

  // Joint Commission compliance checks
  const jointCommission = {
    hasValidLicense: data.licenses.some(
      (l) => l.status === 'active' && (!l.expirationDate || new Date(l.expirationDate) > new Date()),
    ),
    hasCompactEligibility: (data.compactMemberships?.length ?? 0) > 0,
    hasStateVerification: data.licenses.length > 0,
  };

  return { ncqa, jointCommission };
}

/**
 * Anchor passport hash to blockchain
 */
export async function anchorPassportHash(clinicianId: string): Promise<string | null> {
  try {
    const passport = await prisma.digitalLicensePassport.findUnique({
      where: { clinicianId },
    });

    if (!passport) {
      return null;
    }

    const hash = createHash('sha256')
      .update(JSON.stringify(passport.passport))
      .digest('hex');

    const receipt = await chainClient.submitAuditEvent({
      eventType: 'digitalPassportAnchored',
      payload: {
        clinicianId,
        passportVersion: passport.version,
        hash,
      },
    });

    return receipt.txHash;
  } catch (error) {
    console.error('[DigitalLicensePassport] Failed to anchor passport hash', error);
    return null;
  }
}

