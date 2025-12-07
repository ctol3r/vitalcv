/**
 * B134A-PRIV-005: Requirements Engine for Privilege Verification
 *
 * Evaluates clinician evidence against privilege set requirements.
 * Checks: license active, board certification, training hours, NPDB clean
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface RequirementCheckResult {
  passed: boolean;
  reasons: string[];
  details: {
    licenseActive?: boolean;
    boardCertified?: boolean;
    trainingHoursMet?: boolean;
    npdbClean?: boolean;
    [key: string]: any;
  };
}

export interface PrivilegeRequirements {
  minTrainingHours?: number;
  boardCertRequired?: boolean;
  specificBoardCerts?: string[]; // e.g., ["ABMS Internal Medicine"]
  licenseStates?: string[]; // Required license states
  minimumYearsExperience?: number;
  npdbCleanRequired?: boolean;
  additionalCriteria?: Record<string, any>;
}

export interface EvidenceBundle {
  credentials: Array<{
    id: string;
    type: string;
    data: Record<string, any>;
  }>;
  licenses?: Array<{
    state: string;
    licenseNumber: string;
    status: string;
    expirationDate: string;
  }>;
  boardCertifications?: Array<{
    board: string;
    specialty: string;
    certificationDate: string;
    expirationDate?: string;
  }>;
  training?: {
    totalHours?: number;
    programs?: Array<{
      name: string;
      specialty: string;
      completionDate: string;
      hours?: number;
    }>;
  };
  npdbStatus?: {
    clean: boolean;
    checkDate: string;
    details?: any;
  };
}

/**
 * Main requirements engine that evaluates if evidence meets requirements
 */
export class RequirementsEngine {
  /**
   * Evaluate evidence bundle against privilege requirements
   */
  static async evaluateRequirements(
    requirements: PrivilegeRequirements,
    evidence: EvidenceBundle
  ): Promise<RequirementCheckResult> {
    const reasons: string[] = [];
    const details: Record<string, any> = {};
    let passed = true;

    // Check 1: License Active
    if (requirements.licenseStates && requirements.licenseStates.length > 0) {
      const licenseCheck = this.checkLicenseActive(evidence, requirements.licenseStates);
      details.licenseActive = licenseCheck.passed;

      if (!licenseCheck.passed) {
        passed = false;
        reasons.push(licenseCheck.reason || 'Required active license not found');
      }
    }

    // Check 2: Board Certification
    if (requirements.boardCertRequired) {
      const boardCheck = this.checkBoardCertification(
        evidence,
        requirements.specificBoardCerts
      );
      details.boardCertified = boardCheck.passed;

      if (!boardCheck.passed) {
        passed = false;
        reasons.push(boardCheck.reason || 'Required board certification not found');
      }
    }

    // Check 3: Training Hours
    if (requirements.minTrainingHours) {
      const trainingCheck = this.checkTrainingHours(
        evidence,
        requirements.minTrainingHours
      );
      details.trainingHoursMet = trainingCheck.passed;
      details.trainingHours = evidence.training?.totalHours || 0;

      if (!trainingCheck.passed) {
        passed = false;
        reasons.push(trainingCheck.reason || 'Insufficient training hours');
      }
    }

    // Check 4: NPDB Clean
    if (requirements.npdbCleanRequired) {
      const npdbCheck = this.checkNpdbClean(evidence);
      details.npdbClean = npdbCheck.passed;

      if (!npdbCheck.passed) {
        passed = false;
        reasons.push(npdbCheck.reason || 'NPDB check failed or adverse actions found');
      }
    }

    // Check 5: Years of Experience
    if (requirements.minimumYearsExperience) {
      const experienceCheck = this.checkYearsExperience(
        evidence,
        requirements.minimumYearsExperience
      );
      details.yearsExperience = experienceCheck.years;

      if (!experienceCheck.passed) {
        passed = false;
        reasons.push(
          experienceCheck.reason ||
            `Minimum ${requirements.minimumYearsExperience} years experience required`
        );
      }
    }

    // Success case
    if (passed) {
      reasons.push('All requirements met');
    }

    return {
      passed,
      reasons,
      details,
    };
  }

  /**
   * Check if clinician has active license in required states
   */
  private static checkLicenseActive(
    evidence: EvidenceBundle,
    requiredStates: string[]
  ): { passed: boolean; reason?: string } {
    if (!evidence.licenses || evidence.licenses.length === 0) {
      return { passed: false, reason: 'No licenses provided' };
    }

    const activeLicenses = evidence.licenses.filter(
      (lic) =>
        lic.status === 'active' &&
        new Date(lic.expirationDate) > new Date()
    );

    const hasRequiredStates = requiredStates.every((state) =>
      activeLicenses.some((lic) => lic.state === state)
    );

    if (!hasRequiredStates) {
      return {
        passed: false,
        reason: `Active license required in states: ${requiredStates.join(', ')}`,
      };
    }

    return { passed: true };
  }

  /**
   * Check if clinician has required board certification
   */
  private static checkBoardCertification(
    evidence: EvidenceBundle,
    specificBoardCerts?: string[]
  ): { passed: boolean; reason?: string } {
    if (!evidence.boardCertifications || evidence.boardCertifications.length === 0) {
      return { passed: false, reason: 'No board certifications provided' };
    }

    const validCerts = evidence.boardCertifications.filter((cert) => {
      if (cert.expirationDate) {
        return new Date(cert.expirationDate) > new Date();
      }
      return true; // Some board certs don't expire
    });

    if (validCerts.length === 0) {
      return { passed: false, reason: 'No valid board certifications found' };
    }

    // If specific boards required, check for them
    if (specificBoardCerts && specificBoardCerts.length > 0) {
      const hasRequiredBoard = specificBoardCerts.some((requiredBoard) =>
        validCerts.some((cert) => cert.board === requiredBoard)
      );

      if (!hasRequiredBoard) {
        return {
          passed: false,
          reason: `Required board certification: ${specificBoardCerts.join(' or ')}`,
        };
      }
    }

    return { passed: true };
  }

  /**
   * Check if clinician has sufficient training hours
   */
  private static checkTrainingHours(
    evidence: EvidenceBundle,
    minHours: number
  ): { passed: boolean; reason?: string } {
    const totalHours = evidence.training?.totalHours || 0;

    if (totalHours < minHours) {
      return {
        passed: false,
        reason: `Minimum ${minHours} training hours required, found ${totalHours}`,
      };
    }

    return { passed: true };
  }

  /**
   * Check if NPDB/OIG status is clean
   */
  private static checkNpdbClean(
    evidence: EvidenceBundle
  ): { passed: boolean; reason?: string } {
    if (!evidence.npdbStatus) {
      return {
        passed: false,
        reason: 'NPDB/OIG check status not provided',
      };
    }

    if (!evidence.npdbStatus.clean) {
      return {
        passed: false,
        reason: 'NPDB/OIG check shows adverse actions',
      };
    }

    return { passed: true };
  }

  /**
   * Check years of experience from training completion dates
   */
  private static checkYearsExperience(
    evidence: EvidenceBundle,
    minYears: number
  ): { passed: boolean; years: number; reason?: string } {
    if (!evidence.training?.programs || evidence.training.programs.length === 0) {
      return {
        passed: false,
        years: 0,
        reason: 'No training programs provided to calculate experience',
      };
    }

    // Find earliest completion date
    const completionDates = evidence.training.programs
      .map((p) => new Date(p.completionDate))
      .filter((d) => !isNaN(d.getTime()));

    if (completionDates.length === 0) {
      return {
        passed: false,
        years: 0,
        reason: 'No valid training completion dates found',
      };
    }

    const earliestCompletion = new Date(Math.min(...completionDates.map((d) => d.getTime())));
    const yearsExperience =
      (new Date().getTime() - earliestCompletion.getTime()) / (1000 * 60 * 60 * 24 * 365.25);

    if (yearsExperience < minYears) {
      return {
        passed: false,
        years: Math.floor(yearsExperience * 10) / 10,
        reason: `Minimum ${minYears} years experience required, found ${Math.floor(
          yearsExperience * 10
        ) / 10}`,
      };
    }

    return {
      passed: true,
      years: Math.floor(yearsExperience * 10) / 10,
    };
  }

  /**
   * Get detailed evidence summary for auditing
   */
  static getEvidenceSummary(evidence: EvidenceBundle): Record<string, any> {
    return {
      licensesCount: evidence.licenses?.length || 0,
      boardCertsCount: evidence.boardCertifications?.length || 0,
      trainingHours: evidence.training?.totalHours || 0,
      trainingPrograms: evidence.training?.programs?.length || 0,
      npdbStatus: evidence.npdbStatus?.clean ? 'CLEAN' : 'ADVERSE_ACTION',
      credentialsCount: evidence.credentials?.length || 0,
    };
  }
}

/**
 * Helper function to parse evidence bundle from privilege request
 */
export async function parseEvidenceFromRequest(
  evidenceIds: string[],
  evidenceBundle?: any
): Promise<EvidenceBundle> {
  const evidence: EvidenceBundle = {
    credentials: [],
    licenses: [],
    boardCertifications: [],
    training: { totalHours: 0, programs: [] },
  };

  // If full bundle provided, use it
  if (evidenceBundle) {
    return evidenceBundle as EvidenceBundle;
  }

  // Otherwise, fetch credentials by IDs
  if (evidenceIds && evidenceIds.length > 0) {
    const credentials = await prisma.credential.findMany({
      where: {
        id: { in: evidenceIds },
        status: 'active',
      },
    });

    evidence.credentials = credentials.map((cred) => ({
      id: cred.id,
      type: cred.type,
      data: {},
    }));

    // Parse credentials to extract structured data
    // This would be extended based on your VC schema
    for (const cred of credentials) {
      if (cred.type === 'MedicalLicense') {
        // Extract license info
      } else if (cred.type === 'BoardCertification') {
        // Extract board cert info
      }
      // etc.
    }
  }

  return evidence;
}

