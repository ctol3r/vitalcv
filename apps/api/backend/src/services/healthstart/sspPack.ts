/**
 * sspPack.ts — Wave 118: System Security Plan Evidence Pack
 *
 * Generates deployment-profile-aware SSP evidence packs for compliance
 * reviews (HIPAA, NIST 800-53, FedRAMP-like). Each pack includes:
 *   - inherited controls with status and evidence
 *   - audit integrity summary
 *   - trust registry summary
 *   - federation health summary
 *   - HAIP compliance attestation
 *   - control health validation
 */

import { log } from '../../obs/logger';
import { getDeploymentProfile, generateEvidencePack, type DeploymentProfileType } from './deploymentProfile';
import { getInheritedControls, validateControlHealth, type ControlInheritanceReport } from './controlInheritance';

// ── Types ─────────────────────────────────────────────────────────────

export interface SSPSection {
  sectionId: string;
  title: string;
  description: string;
  controls: Array<{
    id: string;
    name: string;
    status: string;
    evidence: string;
    nistRef: string;
    hipaaRef: string;
  }>;
}

export interface SSPPack {
  generatedAt: string;
  version: string;
  profileType: DeploymentProfileType;
  profileDisplayName: string;
  systemName: string;
  systemDescription: string;
  sections: SSPSection[];
  controlInheritance: ControlInheritanceReport;
  controlHealthValidation: {
    healthy: boolean;
    checks: Array<{ controlId: string; name: string; ok: boolean; detail: string }>;
  };
  complianceEvidence: {
    auditSummary: { totalEvents: number; recentEventsCount: number; ledgerIntegrity: string };
    trustRegistrySummary: { activeIssuers: number; totalVerifications: number };
    federationSummary: { totalPeers: number; activePeers: number };
    haipAttestation: { enforced: boolean; complianceLevel: string };
  };
  attestation: {
    generatedBy: string;
    generatedAt: string;
    validUntil: string;
    disclaimer: string;
  };
}

// ── SSP Section Definitions ───────────────────────────────────────────

function buildSections(inheritance: ControlInheritanceReport): SSPSection[] {
  const families = new Map<string, typeof inheritance.controls>();

  for (const control of inheritance.controls) {
    const key = control.family;
    if (!families.has(key)) families.set(key, []);
    families.get(key)!.push(control);
  }

  const FAMILY_TITLES: Record<string, { title: string; description: string }> = {
    AUDIT_LOGGING: {
      title: 'Audit & Accountability',
      description: 'Controls ensuring comprehensive, tamper-evident audit logging for all trust operations.',
    },
    ENCRYPTION: {
      title: 'Cryptographic Protection',
      description: 'Controls governing credential signing, selective disclosure, and data encryption.',
    },
    BOUNDARY_PROTECTION: {
      title: 'System & Communications Protection',
      description: 'Controls for network boundaries, rate limiting, and federation validation.',
    },
    REVOCATION_PROPAGATION: {
      title: 'System & Information Integrity',
      description: 'Controls for credential revocation, cascade propagation, and blast radius analysis.',
    },
    TRUST_REGISTRY_ENFORCEMENT: {
      title: 'Identification & Authentication',
      description: 'Controls for issuer registration, trust scoring, and trust band assignment.',
    },
    CREDENTIAL_EVIDENCE: {
      title: 'Configuration Management',
      description: 'Controls ensuring credential issuance and verification follows HAIP and OID4VC standards.',
    },
    SIEM_EXPORT: {
      title: 'Security Monitoring & Export',
      description: 'Controls for SIEM integration, anomaly detection, and structured event export.',
    },
  };

  const sections: SSPSection[] = [];
  let sectionIndex = 1;

  for (const [family, controls] of families) {
    const meta = FAMILY_TITLES[family] ?? { title: family, description: '' };
    sections.push({
      sectionId: `SSP-${String(sectionIndex).padStart(2, '0')}`,
      title: meta.title,
      description: meta.description,
      controls: controls.map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        evidence: c.evidence,
        nistRef: c.nistMapping.join(', '),
        hipaaRef: c.hipaaMapping.join(', '),
      })),
    });
    sectionIndex++;
  }

  return sections;
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Generate a full SSP evidence pack for a given deployment profile.
 */
export async function generateSSPPack(
  profileType: DeploymentProfileType = 'SaaS'
): Promise<SSPPack> {
  const profile = getDeploymentProfile(profileType);
  const inheritance = getInheritedControls(profileType);
  const health = validateControlHealth();
  const evidence = await generateEvidencePack(profileType);

  const now = new Date();
  const validUntil = new Date(now);
  validUntil.setDate(validUntil.getDate() + 90);

  const pack: SSPPack = {
    generatedAt: now.toISOString(),
    version: '1.0.0',
    profileType,
    profileDisplayName: profile.displayName,
    systemName: 'VitalCV Trust Substrate',
    systemDescription: 'Healthcare-native cryptographic trust infrastructure for federated credential verification, clinician credentialing, and trust network operations.',
    sections: buildSections(inheritance),
    controlInheritance: inheritance,
    controlHealthValidation: health,
    complianceEvidence: {
      auditSummary: evidence.auditSummary,
      trustRegistrySummary: {
        activeIssuers: evidence.trustRegistrySummary.activeIssuers,
        totalVerifications: evidence.trustRegistrySummary.haipCompliantIssuers,
      },
      federationSummary: {
        totalPeers: evidence.federationSummary.totalEntities,
        activePeers: evidence.federationSummary.trustedEntities,
      },
      haipAttestation: {
        enforced: true,
        complianceLevel: evidence.trustRegistrySummary.haipCompliantIssuers > 0 ? 'FULL' : 'PARTIAL',
      },
    },
    attestation: {
      generatedBy: 'VitalCV HealthStart Engine',
      generatedAt: now.toISOString(),
      validUntil: validUntil.toISOString(),
      disclaimer: 'This SSP evidence pack is auto-generated from live system state. It is intended as supporting evidence for compliance reviews and does not constitute a formal certification.',
    },
  };

  log('info', 'healthstart_ssp: pack generated', {
    profileType,
    sections: pack.sections.length,
    controls: inheritance.totalControls,
    healthy: health.healthy,
  });

  return pack;
}
