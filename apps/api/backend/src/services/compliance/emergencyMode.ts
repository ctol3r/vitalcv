import { PrismaClient } from '@prisma/client';
import { generateAuditHash } from '../../utils/deterministic';

const prisma = new PrismaClient();

// Internal global override switch (in production this would be Redis/Db backed)
let emergencyModeActive = false;
let currentEmergencyContext = '';

export interface EmergencyDeclaration {
  active: boolean;
  context: string;
  declaredBy: string;
  declaredAt: Date;
}

export class EmergencyGovernanceService {

  /**
   * Toggles the global disaster resilience state.
   */
  static declareEmergency(active: boolean, context: string, declaredByNpi: string): EmergencyDeclaration {
    emergencyModeActive = active;
    currentEmergencyContext = active ? context : '';

    console.warn(`🚨 [EMERGENCY_GOVERNANCE] Status: ${active ? 'ACTIVE' : 'DEACTIVATED'} | Context: ${context} | By: ${declaredByNpi}`);

    return {
      active: emergencyModeActive,
      context: currentEmergencyContext,
      declaredBy: declaredByNpi,
      declaredAt: new Date()
    };
  }

  static isEmergencyActive(): boolean {
    return emergencyModeActive;
  }

  /**
   * Intercepts a standard presentation request and escalates L2 credentials to L3
   * if the system is under an emergency public_health order.
   */
  static async evaluateEmergencyOverride(
    clinicianNpi: string,
    credentials: any[],
    purposeOfUse: string
  ): Promise<{ escalatedCredentials: any[], scrapbookEntryId: string | null }> {

    if (!emergencyModeActive || (purposeOfUse !== 'emergency' && purposeOfUse !== 'public_health')) {
      return { escalatedCredentials: credentials, scrapbookEntryId: null };
    }

    console.warn(`[EMERGENCY_GOVERNANCE] Overriding policies for NPI ${clinicianNpi}`);

    const escalated = credentials.map(cred => {
      // Mock logic: If a credential is L2 (e.g. Identity Verified, but missing Primary Source Medical Board)
      // we escalate it to L3 for 72 hours based on Genesis Mesh disaster protocol.
      if (cred.trustLevel === 'L2' || !cred.trustLevel) {
        return {
          ...cred,
          trustLevel: 'L3',
          _emergencyFlag: true,
          _escalationReason: currentEmergencyContext,
          _ttlExpiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString() // 72 hours
        };
      }
      return cred;
    });

    // We must permanently record this escalation in the AuditScrapbook for post-event reconciliation
    const reconciliationHash = generateAuditHash(JSON.stringify(escalated));

    const scrapbookEntry = await prisma.auditEvent.create({
      data: {
        clinicianId: clinicianNpi,
        type: 'EMERGENCY_ESCALATION',
        metadata: {
          context: currentEmergencyContext,
          credentialsEscalated: escalated.filter((c: any) => c._emergencyFlag).length,
          ttl: '72_HOURS'
        },
        hash: reconciliationHash
      }
    });

    return {
      escalatedCredentials: escalated,
      scrapbookEntryId: scrapbookEntry.id
    };
  }
}
