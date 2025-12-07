/**
 * Facility Privileging Engine - Requirement Verification Engine
 * Phase 1: Privilege Model + Core Logic
 */

import type {
  ClinicianProfile,
  Privilege,
  PrivilegeRequirementResult,
} from './models';

export class PrivilegeRequirementEngine {
  /**
   * Verify all requirements for a privilege
   */
  verifyRequirements(
    privilege: Privilege,
    profile: ClinicianProfile
  ): PrivilegeRequirementResult[] {
    const results: PrivilegeRequirementResult[] = [];

    // Verify credentials
    for (const requiredCred of privilege.requiredCredentials) {
      const result = this.verifyCredential(requiredCred, profile);
      results.push(result);
    }

    // Verify skills
    for (const requiredSkill of privilege.requiredSkills) {
      const result = this.verifySkill(requiredSkill, profile);
      results.push(result);
    }

    // Verify attestations
    for (const requiredAttestation of privilege.requiredAttestations) {
      const result = this.verifyAttestation(requiredAttestation, profile);
      results.push(result);
    }

    // Verify DEA registration
    if (privilege.deaRequired) {
      const result = this.verifyDEA(privilege.deaSchedules, profile);
      results.push(result);
    }

    // Verify MATE registration
    if (privilege.mateRequired) {
      const result = this.verifyMATE(profile);
      results.push(result);
    }

    // Verify chain anchors
    const chainResult = this.verifyChainAnchors(profile);
    results.push(chainResult);

    // Check compliance
    const complianceResult = this.verifyCompliance(profile);
    results.push(complianceResult);

    return results;
  }

  /**
   * Verify credential requirement
   */
  private verifyCredential(
    credentialType: string,
    profile: ClinicianProfile
  ): PrivilegeRequirementResult {
    const credential = profile.credentials.find(
      (c) => c.type === credentialType && c.verified
    );

    if (!credential) {
      return {
        type: 'credential',
        identifier: credentialType,
        verified: false,
        confidence: 0,
        blockers: [`Missing verified credential: ${credentialType}`],
      };
    }

    // Check expiration
    const isExpired = credential.expiresAt
      ? new Date(credential.expiresAt) < new Date()
      : false;

    if (isExpired) {
      return {
        type: 'credential',
        identifier: credentialType,
        verified: false,
        confidence: 0,
        blockers: [`Credential expired: ${credentialType}`],
        expiresAt: credential.expiresAt,
      };
    }

    return {
      type: 'credential',
      identifier: credentialType,
      verified: true,
      confidence: 95,
      evidence: [`Credential ${credential.identifier} verified by ${credential.issuer}`],
      expiresAt: credential.expiresAt,
    };
  }

  /**
   * Verify skill requirement
   */
  private verifySkill(
    skillName: string,
    profile: ClinicianProfile
  ): PrivilegeRequirementResult {
    const skill = profile.skills.find(
      (s) => s.name === skillName && s.verified
    );

    if (!skill) {
      return {
        type: 'skill',
        identifier: skillName,
        verified: false,
        confidence: 0,
        blockers: [`Missing verified skill: ${skillName}`],
      };
    }

    const confidence = skill.competencyScore || 80;

    return {
      type: 'skill',
      identifier: skillName,
      verified: true,
      confidence,
      evidence: [
        `Skill ${skillName} verified${skill.verifiedBy ? ` by ${skill.verifiedBy}` : ''}`,
        skill.verifiedAt ? `Verified at ${skill.verifiedAt}` : '',
      ].filter(Boolean),
      expiresAt: skill.verifiedAt,
    };
  }

  /**
   * Verify attestation requirement
   */
  private verifyAttestation(
    attestationType: string,
    profile: ClinicianProfile
  ): PrivilegeRequirementResult {
    const attestation = profile.attestations.find(
      (a) => a.type === attestationType
    );

    if (!attestation) {
      return {
        type: 'attestation',
        identifier: attestationType,
        verified: false,
        confidence: 0,
        blockers: [`Missing attestation: ${attestationType}`],
      };
    }

    // Check expiration
    const isExpired = attestation.expiresAt
      ? new Date(attestation.expiresAt) < new Date()
      : false;

    if (isExpired) {
      return {
        type: 'attestation',
        identifier: attestationType,
        verified: false,
        confidence: 0,
        blockers: [`Attestation expired: ${attestationType}`],
        expiresAt: attestation.expiresAt,
      };
    }

    return {
      type: 'attestation',
      identifier: attestationType,
      verified: true,
      confidence: 90,
      evidence: [
        `Attestation ${attestationType} provided by ${attestation.attestedBy}`,
        `Attested at ${attestation.attestedAt}`,
      ],
      expiresAt: attestation.expiresAt,
    };
  }

  /**
   * Verify DEA registration
   */
  private verifyDEA(
    requiredSchedules: string[],
    profile: ClinicianProfile
  ): PrivilegeRequirementResult {
    if (!profile.deaRegistration) {
      return {
        type: 'dea',
        identifier: 'DEA Registration',
        verified: false,
        confidence: 0,
        blockers: ['Missing DEA registration'],
      };
    }

    // Check expiration
    const isExpired = profile.deaRegistration.expiresAt
      ? new Date(profile.deaRegistration.expiresAt) < new Date()
      : false;

    if (isExpired) {
      return {
        type: 'dea',
        identifier: 'DEA Registration',
        verified: false,
        confidence: 0,
        blockers: ['DEA registration expired'],
        expiresAt: profile.deaRegistration.expiresAt,
      };
    }

    // Check schedule coverage
    const missingSchedules = requiredSchedules.filter(
      (schedule) => !profile.deaRegistration!.schedules.includes(schedule)
    );

    if (missingSchedules.length > 0) {
      return {
        type: 'dea',
        identifier: 'DEA Registration',
        verified: false,
        confidence: 50,
        blockers: [`Missing DEA schedules: ${missingSchedules.join(', ')}`],
      };
    }

    return {
      type: 'dea',
      identifier: 'DEA Registration',
      verified: true,
      confidence: 95,
      evidence: [
        `DEA ${profile.deaRegistration.number} covers schedules: ${profile.deaRegistration.schedules.join(', ')}`,
      ],
      expiresAt: profile.deaRegistration.expiresAt,
    };
  }

  /**
   * Verify MATE registration
   */
  private verifyMATE(profile: ClinicianProfile): PrivilegeRequirementResult {
    if (!profile.mateRegistration) {
      return {
        type: 'mate',
        identifier: 'MATE Registration',
        verified: false,
        confidence: 0,
        blockers: ['Missing MATE registration'],
      };
    }

    // Check expiration
    const isExpired = profile.mateRegistration.expiresAt
      ? new Date(profile.mateRegistration.expiresAt) < new Date()
      : false;

    if (isExpired) {
      return {
        type: 'mate',
        identifier: 'MATE Registration',
        verified: false,
        confidence: 0,
        blockers: ['MATE registration expired'],
        expiresAt: profile.mateRegistration.expiresAt,
      };
    }

    return {
      type: 'mate',
      identifier: 'MATE Registration',
      verified: true,
      confidence: 95,
      evidence: [`MATE ${profile.mateRegistration.number} verified`],
      expiresAt: profile.mateRegistration.expiresAt,
    };
  }

  /**
   * Verify chain anchors
   */
  private verifyChainAnchors(
    profile: ClinicianProfile
  ): PrivilegeRequirementResult {
    if (profile.chainAnchors.length === 0) {
      return {
        type: 'chain',
        identifier: 'Chain Anchors',
        verified: false,
        confidence: 0,
        blockers: ['No chain anchors found'],
      };
    }

    // Check if anchors are recent (within last 90 days)
    const recentAnchors = profile.chainAnchors.filter((anchor) => {
      const anchorDate = new Date(anchor.timestamp);
      const daysSince = (Date.now() - anchorDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysSince <= 90;
    });

    if (recentAnchors.length === 0) {
      return {
        type: 'chain',
        identifier: 'Chain Anchors',
        verified: false,
        confidence: 50,
        blockers: ['Chain anchors are stale (older than 90 days)'],
      };
    }

    return {
      type: 'chain',
      identifier: 'Chain Anchors',
      verified: true,
      confidence: 90,
      evidence: [
        `${recentAnchors.length} recent chain anchor(s) verified`,
        ...recentAnchors.map((a) => `Anchor ${a.anchorId} on ${a.network}`),
      ],
    };
  }

  /**
   * Verify compliance (risk factors, sanctions, etc.)
   */
  private verifyCompliance(
    profile: ClinicianProfile
  ): PrivilegeRequirementResult {
    if (profile.riskFactors.length > 0) {
      return {
        type: 'compliance',
        identifier: 'Compliance',
        verified: false,
        confidence: 100 - profile.riskFactors.length * 10,
        blockers: profile.riskFactors,
      };
    }

    return {
      type: 'compliance',
      identifier: 'Compliance',
      verified: true,
      confidence: 100,
      evidence: ['No compliance issues detected'],
    };
  }

  /**
   * Map risk score from requirements and profile
   */
  mapRiskScore(
    privilege: Privilege,
    requirementResults: PrivilegeRequirementResult[],
    profile: ClinicianProfile
  ): number {
    let riskScore = 0;

    // Base risk from privilege level
    const privilegeRiskMap: Record<string, number> = {
      low: 10,
      medium: 30,
      high: 60,
      critical: 80,
    };
    riskScore += privilegeRiskMap[privilege.riskLevel] || 30;

    // Add risk from missing requirements
    const missingCount = requirementResults.filter((r) => !r.verified).length;
    riskScore += missingCount * 5;

    // Add risk from profile risk factors
    riskScore += profile.riskFactors.length * 10;

    // Add risk from expiring credentials
    const expiringCredentials = profile.credentials.filter((c) => {
      if (!c.expiresAt) return false;
      const daysUntilExpiry =
        (new Date(c.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      return daysUntilExpiry > 0 && daysUntilExpiry < 45;
    });
    riskScore += expiringCredentials.length * 5;

    // Add risk from chain drift (stale anchors)
    const staleAnchors = profile.chainAnchors.filter((anchor) => {
      const anchorDate = new Date(anchor.timestamp);
      const daysSince = (Date.now() - anchorDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysSince > 90;
    });
    riskScore += staleAnchors.length * 3;

    return Math.min(100, riskScore);
  }
}

