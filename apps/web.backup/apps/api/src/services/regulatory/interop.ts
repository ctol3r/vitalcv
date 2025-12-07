import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface RegulatoryMapping {
  ncqa?: {
    evidenceList: Array<{ type: string; source: string; status: string }>;
    gaps: string[];
  };
  jointCommission?: {
    privilegeRouting: Array<{ privilege: string; route: string }>;
    verificationStatus: Record<string, string>;
  };
  deaMate?: {
    mateTraining: Array<{ hours: number; completed: boolean; date?: string }>;
    deaLicense: { number: string; expiration: string; status: string };
  };
  ecfmgImg?: {
    certification: { number: string; status: string; date: string };
    equivalency: { level: string; usEquivalent: string };
  };
}

/**
 * Map VitalCV credentials to NCQA evidence list
 */
export async function mapToNCQA(clinicianId: string): Promise<RegulatoryMapping['ncqa']> {
  const credentials = await prisma.walletCredential.findMany({
    where: { clinicianId, revokedAt: null },
  });

  const licenses = await prisma.globalLicense.findMany({
    where: { clinicianId, status: 'active' },
  });

  const evidenceList: Array<{ type: string; source: string; status: string }> = [];

  // Map licenses
  for (const license of licenses) {
    evidenceList.push({
      type: 'license',
      source: `VitalCV:${license.id}`,
      status: license.status === 'active' ? 'verified' : 'expired',
    });
  }

  // Map board certifications
  const boardCerts = credentials.filter((c) => c.type === 'board_certification');
  for (const cert of boardCerts) {
    evidenceList.push({
      type: 'board_certification',
      source: `VitalCV:${cert.credentialId}`,
      status: 'verified',
    });
  }

  // Map DEA
  const deaCreds = await prisma.dEACredential.findMany({
    where: { clinicianId },
  });
  for (const dea of deaCreds) {
    evidenceList.push({
      type: 'dea',
      source: `VitalCV:${dea.id}`,
      status: dea.expiration > new Date() ? 'active' : 'expired',
    });
  }

  // Identify gaps
  const gaps: string[] = [];
  if (licenses.length === 0) {
    gaps.push('No active licenses found');
  }
  if (boardCerts.length === 0) {
    gaps.push('No board certifications found');
  }

  return { evidenceList, gaps };
}

/**
 * Map to Joint Commission privilege & verification routing
 */
export async function mapToJointCommission(clinicianId: string): Promise<RegulatoryMapping['jointCommission']> {
  // Get privileges (from privilege assignments)
  const privileges = await prisma.privilegeSet.findMany({
    where: { hospitalId: { not: null } },
    take: 10,
  });

  const privilegeRouting: Array<{ privilege: string; route: string }> = [];
  for (const priv of privileges) {
    for (const procedure of priv.procedures) {
      privilegeRouting.push({
        privilege: procedure,
        route: `JC:${priv.hospitalId}:${procedure}`,
      });
    }
  }

  // Verification status
  const verificationStatus: Record<string, string> = {};
  const checks = await prisma.complianceCheck.findMany({
    where: { clinicianId },
    take: 20,
  });

  for (const check of checks) {
    verificationStatus[check.type] = (check.result as any).status ?? 'pending';
  }

  return { privilegeRouting, verificationStatus };
}

/**
 * Map MATE training and DEA license data
 */
export async function mapToDEAMATE(clinicianId: string): Promise<RegulatoryMapping['deaMate']> {
  const deaCreds = await prisma.dEACredential.findMany({
    where: { clinicianId },
    orderBy: { expiration: 'desc' },
    take: 1,
  });

  const deaLicense = deaCreds.length > 0
    ? {
        number: deaCreds[0].deaNumber,
        expiration: deaCreds[0].expiration.toISOString(),
        status: deaCreds[0].expiration > new Date() ? 'active' : 'expired',
      }
    : { number: '', expiration: '', status: 'missing' };

  // MATE training (mock - would integrate with MATE training system)
  const mateTraining: Array<{ hours: number; completed: boolean; date?: string }> = [
    {
      hours: deaCreds[0]?.mateHours ?? 0,
      completed: (deaCreds[0]?.mateHours ?? 0) >= 8,
      date: deaCreds[0]?.createdAt.toISOString(),
    },
  ];

  return { mateTraining, deaLicense };
}

/**
 * Map ECFMG/IMG certification
 */
export async function mapToECFMGIMG(clinicianId: string): Promise<RegulatoryMapping['ecfmgImg']> {
  const foreignCreds = await prisma.foreignCredential.findMany({
    where: { clinicianId, type: { in: ['GMC', 'NMC', 'IMG'] } },
  });

  if (foreignCreds.length === 0) {
    return {
      certification: { number: '', status: 'not_applicable', date: '' },
      equivalency: { level: 'N/A', usEquivalent: 'N/A' },
    };
  }

  const cred = foreignCreds[0];
  const data = cred.data as any;

  return {
    certification: {
      number: data.certificationNumber ?? '',
      status: data.status ?? 'unknown',
      date: cred.createdAt.toISOString(),
    },
    equivalency: {
      level: data.equivalencyLevel ?? 'UNKNOWN',
      usEquivalent: data.usEquivalent ?? 'N/A',
    },
  };
}

/**
 * Build complete regulatory mapping
 */
export async function buildRegulatoryMapping(clinicianId: string, region: string = 'US'): Promise<RegulatoryMapping> {
  const [ncqa, jointCommission, deaMate, ecfmgImg] = await Promise.all([
    mapToNCQA(clinicianId),
    mapToJointCommission(clinicianId),
    mapToDEAMATE(clinicianId),
    mapToECFMGIMG(clinicianId),
  ]);

  return {
    ncqa,
    jointCommission,
    deaMate,
    ecfmgImg,
  };
}

/**
 * Get or create regulatory mapping
 */
export async function getOrCreateRegulatoryMapping(
  clinicianId: string,
  region: string = 'US'
): Promise<RegulatoryMapping> {
  let mapping = await prisma.regInterop.findFirst({
    where: { region },
    orderBy: { updatedAt: 'desc' },
  });

  const regulatoryMapping = await buildRegulatoryMapping(clinicianId, region);

  if (!mapping) {
    await prisma.regInterop.create({
      data: {
        region,
        mapping: regulatoryMapping as unknown as any,
      },
    });
  } else if (isMappingStale(mapping.updatedAt)) {
    await prisma.regInterop.update({
      where: { id: mapping.id },
      data: {
        mapping: regulatoryMapping as unknown as any,
        updatedAt: new Date(),
      },
    });
  }

  return regulatoryMapping;
}

function isMappingStale(updatedAt: Date): boolean {
  const hoursSinceUpdate = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60);
  return hoursSinceUpdate > 24;
}

/**
 * Detect missing evidence for regulatory compliance
 */
export async function detectRegulatoryGaps(clinicianId: string, standard: 'NCQA' | 'JC' | 'DEA' | 'ECFMG'): Promise<string[]> {
  const mapping = await buildRegulatoryMapping(clinicianId);
  const gaps: string[] = [];

  if (standard === 'NCQA' && mapping.ncqa) {
    gaps.push(...mapping.ncqa.gaps);
  }

  if (standard === 'JC' && mapping.jointCommission) {
    const checks = await prisma.complianceCheck.findMany({
      where: { clinicianId, type: { in: ['license', 'board', 'privilege'] } },
    });
    const failed = checks.filter((c) => (c.result as any).status === 'failed');
    if (failed.length > 0) {
      gaps.push(`${failed.length} failed compliance checks`);
    }
  }

  if (standard === 'DEA' && mapping.deaMate) {
    if (mapping.deaMate.deaLicense.status === 'missing') {
      gaps.push('DEA license missing');
    }
    const incompleteMate = mapping.deaMate.mateTraining.filter((t) => !t.completed);
    if (incompleteMate.length > 0) {
      gaps.push('Incomplete MATE training');
    }
  }

  if (standard === 'ECFMG' && mapping.ecfmgImg) {
    if (mapping.ecfmgImg.certification.status === 'not_applicable') {
      gaps.push('ECFMG certification not found');
    }
  }

  return gaps;
}

/**
 * Generate regulator-grade compliance packet
 */
export async function generateRegulatoryCompliancePacket(
  clinicianId: string,
  standard: 'NCQA' | 'JC' | 'DEA' | 'ECFMG'
): Promise<{
  clinicianId: string;
  standard: string;
  generatedAt: string;
  evidence: unknown[];
  gaps: string[];
  compliance: { status: string; score: number };
}> {
  const mapping = await buildRegulatoryMapping(clinicianId);
  const gaps = await detectRegulatoryGaps(clinicianId, standard);

  let evidence: unknown[] = [];
  if (standard === 'NCQA' && mapping.ncqa) {
    evidence = mapping.ncqa.evidenceList;
  } else if (standard === 'JC' && mapping.jointCommission) {
    evidence = [
      ...mapping.jointCommission.privilegeRouting,
      mapping.jointCommission.verificationStatus,
    ];
  } else if (standard === 'DEA' && mapping.deaMate) {
    evidence = [mapping.deaMate.deaLicense, ...mapping.deaMate.mateTraining];
  } else if (standard === 'ECFMG' && mapping.ecfmgImg) {
    evidence = [mapping.ecfmgImg.certification, mapping.ecfmgImg.equivalency];
  }

  const compliance = {
    status: gaps.length === 0 ? 'compliant' : 'gaps_detected',
    score: gaps.length === 0 ? 1.0 : Math.max(0, 1 - gaps.length * 0.1),
  };

  return {
    clinicianId,
    standard,
    generatedAt: new Date().toISOString(),
    evidence,
    gaps,
    compliance,
  };
}

