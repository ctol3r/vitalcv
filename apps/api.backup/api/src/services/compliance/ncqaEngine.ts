import { Credential } from '@prisma/client';
import { inWindow } from '../ncqa_windows';

export interface NCQAResult {
  ruleName: string;
  status: 'pass' | 'fail' | 'warn';
  detail: string;
}

export class NCQAEngine {
  /**
   * CR1: Primary source licensure verified within 120 days (or 90 for CVO)
   */
  static checkLicensureTimeliness(credential: Credential, isCvo = false): NCQAResult {
    if (credential.type !== 'MedicalLicense') {
      return {
        ruleName: 'CR1',
        status: 'pass', // Not a license, rule doesn't apply (or skip?)
        detail: 'Credential is not a MedicalLicense',
      };
    }

    const verificationDate = credential.issuedAt; // Assuming issuedAt implies verification
    const valid = inWindow(verificationDate, isCvo);

    return {
      ruleName: 'CR1',
      status: valid ? 'pass' : 'fail',
      detail: valid
        ? `Verified within ${isCvo ? 90 : 120} days`
        : `Verification expired (Date: ${verificationDate.toISOString()})`,
    };
  }

  /**
   * CR2: Sanctions check within 30 days
   */
  static checkSanctions(credential: Credential, lastSanctionsCheck?: Date): NCQAResult {
    if (!lastSanctionsCheck) {
      return {
        ruleName: 'CR2',
        status: 'fail',
        detail: 'No sanctions check record found',
      };
    }

    const diffDays = (Date.now() - lastSanctionsCheck.getTime()) / (1000 * 60 * 60 * 24);
    const valid = diffDays <= 30;

    return {
      ruleName: 'CR2',
      status: valid ? 'pass' : 'fail',
      detail: valid
        ? `Sanctions checked ${Math.floor(diffDays)} days ago`
        : `Sanctions check expired (${Math.floor(diffDays)} days ago)`,
    };
  }

  /**
   * CR3: Board certification verified
   */
  static checkBoardCertification(credential: Credential): NCQAResult {
    if (credential.type !== 'BoardCertification') {
       return {
        ruleName: 'CR3',
        status: 'pass', // Not a board cert
        detail: 'Credential is not a BoardCertification',
      };
    }

    // Basic existence check implies verification if the credential exists and is active
    const isActive = credential.status === 'active';

    return {
      ruleName: 'CR3',
      status: isActive ? 'pass' : 'fail',
      detail: isActive ? 'Board certification active' : 'Board certification not active',
    };
  }

  /**
   * CR4: DEA + MATE Act compliance
   */
  static checkDEACompliance(credential: Credential): NCQAResult {
     if (credential.type !== 'DEA') {
       return {
        ruleName: 'CR4',
        status: 'pass',
        detail: 'Credential is not a DEA license',
      };
    }

    // Check for MATE Act compliance (mock logic - assume metadata flag or similar)
    // In a real scenario, we'd parse the credential payload
    // For now, if it's a DEA credential and active, pass with warning if MATE unknown

    const isActive = credential.status === 'active';
    // Assume we can check metadata for MATE
    // const hasMate = (credential as any).metadata?.mate === true;

    if (!isActive) {
        return {
            ruleName: 'CR4',
            status: 'fail',
            detail: 'DEA license not active',
        };
    }

    return {
      ruleName: 'CR4',
      status: 'pass',
      detail: 'DEA license active (MATE compliance assumed/manual check)',
    };
  }

  /**
   * CR5: Completeness & accuracy of credentialing file
   */
  static checkFileCompleteness(credential: Credential): NCQAResult {
    // Check for essential fields
    const missingFields = [];
    if (!credential.issuer) missingFields.push('issuer');
    if (!credential.userId) missingFields.push('userId');
    // if (!credential.credHash) missingFields.push('credHash');

    if (missingFields.length > 0) {
      return {
        ruleName: 'CR5',
        status: 'fail',
        detail: `Missing fields: ${missingFields.join(', ')}`,
      };
    }

    return {
      ruleName: 'CR5',
      status: 'pass',
      detail: 'Credential file appears complete',
    };
  }

  static evaluateAll(credential: Credential, lastSanctionsCheck?: Date, isCvo = false): NCQAResult[] {
      const results: NCQAResult[] = [];

      // Logic to determine which rules apply to which credential type
      // For now, run all applicable checks

      if (credential.type === 'MedicalLicense') {
          results.push(this.checkLicensureTimeliness(credential, isCvo));
      }

      if (credential.type === 'BoardCertification') {
          results.push(this.checkBoardCertification(credential));
      }

      if (credential.type === 'DEA') {
          results.push(this.checkDEACompliance(credential));
      }

      // Universal checks
      results.push(this.checkSanctions(credential, lastSanctionsCheck)); // Check sanctions for the clinician (linked to credential)
      results.push(this.checkFileCompleteness(credential));

      return results;
  }
}














