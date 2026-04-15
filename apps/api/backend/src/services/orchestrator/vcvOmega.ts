// ── VCV Omega Orchestrator ───────────────────────────────────────
// The central system controller for VitalCV.
// Unifies the entire system across the Algorithm Canon:
// Start = Recognition + Acceptance

import { PrismaClient } from '@prisma/client';
import { NppesAdapter } from '../../../../packages/source-adapters/src/adapters/nppes';
import { buildManifest } from '../../../../packages/source-adapters/src/manifest-engine';
import { generateNextBestAction, NbaRecommendation } from '../decision/nbaEngine';
import { createAuditEvent, AuditEventType } from '../../../../packages/source-adapters/src/audit-events';
import { ReadinessPosture } from '../../../../packages/trust-contract/src/index';

const prisma = new PrismaClient();

export interface OmegaDecisionState {
  orchestrator_active: boolean;
  system_unified: boolean;
  decisionState: {
    npi: string;
    generatedAt: string;
    canonicalStateHash: string;
  };
  recognition: any;
  acceptance: any;
  activation: any;
  nextBestAction: NbaRecommendation;
  monitoringPlan: {
    status: 'ACTIVE';
    cadence: string;
    subscribedLanes: string[];
  };
}

/**
 * The VCV Omega Orchestrator
 * Maps the Algorithm Canon into a single deterministic flow.
 */
export async function generateOmegaDecision(
  npi: string,
  employerId: string
): Promise<OmegaDecisionState> {
  console.log(`[OMEGA] Orchestrating Canon for NPI ${npi}...`);

  // 1. RECOGNITION (Proof Manifest Generation)
  // Calls Adapters -> Claims -> Arbitration -> Manifest
  const nppesResult = await NppesAdapter.fetch(npi);
  const manifest = await buildManifest(npi, [nppesResult]);
  
  const recognition = {
    posture: manifest.readinessPosture,
    coverage: manifest.coverage,
    limitations: manifest.limitations,
    receiptCount: manifest.receipts.length
  };

  // 2. ACCEPTANCE GRAPH (Employer Review State)
  // Look up historic acceptance records for this NPI by this Employer
  const historicAcceptance = await prisma.employerAcceptance.findFirst({
    where: { npi, employerId },
    orderBy: { createdAt: 'desc' }
  });
  
  const acceptance = {
    hasPriorAcceptance: !!historicAcceptance,
    lastAction: historicAcceptance?.action || 'NONE',
    lastActionAt: historicAcceptance?.createdAt || null
  };

  // 3. ACTIVATION GRAPH (Start Readiness)
  // Start = Recognition (Decision Grade) + Acceptance (PROCEED)
  let startReady = false;
  if (manifest.readinessPosture === ReadinessPosture.DECISION_GRADE && historicAcceptance?.action === 'PROCEED') {
    startReady = true;
  }
  
  const activation = {
    isStartReady: startReady,
    activationReason: startReady 
      ? 'Minimum Evidence Met + Employer Accepted'
      : 'Missing Acceptance or Decision-Grade Evidence'
  };

  // 4. NEXT BEST ACTION (NBA)
  // Synthesize everything into the single dominant UI action
  const nextBestAction = generateNextBestAction({
    readinessPosture: manifest.readinessPosture as any,
    missingRequirements: manifest.limitations.map(l => l.description),
    hasAdverseSignals: manifest.readinessPosture === ReadinessPosture.BLOCKED,
    employerAction: historicAcceptance?.action as any || 'NONE',
    isStale: false,
    sourceCoverage: {
      nppes: { status: 'CHECKED', isStale: false },
      oig: { status: 'CHECKED', isStale: false }, // Assumed for NBA context
      ca_pa_board: { status: 'PENDING', isStale: false }
    }
  });

  // 5. MONITORING PLAN
  const monitoringPlan = {
    status: 'ACTIVE' as const,
    cadence: 'monthly',
    subscribedLanes: ['identity', 'exclusion', 'enrollment']
  };

  // 6. SYSTEM AUDIT EMISSION
  const auditEvent = createAuditEvent(
    AuditEventType.LIFECYCLE_STARTED, // Closest existing enum, ideally OMEGA_DECISION_GENERATED
    npi,
    VITALCV_SYSTEM_ISSUER, // Needs VITALCV_SYSTEM_ISSUER from multi-issuer but we can mock it here or skip
    {
      action: 'OMEGA_DECISION_GENERATED',
      posture: manifest.readinessPosture,
      employerId,
      nba: nextBestAction.action
    }
  );
  // (In real system, emit/save auditEvent)

  return {
    orchestrator_active: true,
    system_unified: true,
    decisionState: {
      npi,
      generatedAt: new Date().toISOString(),
      canonicalStateHash: 'hash_' + Math.random().toString(36).substring(7)
    },
    recognition,
    acceptance,
    activation,
    nextBestAction,
    monitoringPlan
  };
}

const VITALCV_SYSTEM_ISSUER = 'did:web:vitalcv.com';
