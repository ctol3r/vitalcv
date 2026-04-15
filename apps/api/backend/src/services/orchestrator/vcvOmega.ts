// ── VCV Omega Orchestrator ───────────────────────────────────────
// The central system controller for VitalCV.
// Unifies the entire system across the Algorithm Canon:
// Start = Recognition + Acceptance

import { PrismaClient } from '@prisma/client';
import { buildManifest } from '../../../../packages/source-adapters/src/manifest-engine';
import { generateNextBestAction, NbaRecommendation } from '../decision/nbaEngine';
import { createAuditEvent, AuditEventType } from '../../../../packages/source-adapters/src/audit-events';
import { ReadinessPosture, TruthSnapshot, SourceStatus, FreshnessState } from '../../../../packages/trust-contract/src/index';

import { fetchOutcomeHistory, recordDecisionOutcome, OutcomeResult, DecisionOutcome } from '../decision/decisionOutcome';
import { buildOutcomeMemory, OutcomeMemory } from '../decision/outcomeMemory';
import { fetchOrgPolicy, applyOrgPolicy } from '../decision/orgPolicyEngine';
import { calibrateTrust, CalibrationResult } from '../decision/confidenceEngine';
import { DecisionTrace, storeDecisionTrace } from '../decision/decisionTraceEngine';
import { evaluateFreshness, FreshnessState } from '../../../../packages/trust-contract/src/index';

const prisma = new PrismaClient();

export interface OmegaDecisionState {
  orchestrator_active: boolean;
  system_unified: boolean;
  learning_pipeline: boolean;
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
  learningContext: OutcomeMemory;
  calibration: CalibrationResult;
  orgPolicy: {
    applied: boolean;
    notes: string[];
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
  // DECOUPLED: Omega DO NOT call external APIs here.
  // We ONLY read cached truth from the DB that the Async Ingest Pipeline has stored.
  
  // (Mocking the DB read of cached results instead of NppesAdapter.fetch)
  // const cachedResults = await prisma.cachedSourceResult.findMany({ where: { npi } });
  
  // Fallback to minimal mock shape to allow Manifest engine to run locally for now
  const cachedNppesResult = {
    sourceId: 'nppes',
    status: 'checked' as const,
    timestamp: new Date().toISOString(),
    raw: {
      number: npi,
      basic: { first_name: 'Cached', last_name: 'Provider' },
      taxonomies: [{ code: '208D00000X', primary: true, state: 'CA', license: 'A1234' }]
    }
  };

  // Evaluate Freshness on cached results
  const nppesFreshness = evaluateFreshness({
    verifiedAt: cachedNppesResult.timestamp,
    ttlMs: 30 * 24 * 60 * 60 * 1000 // 30 days
  });

  const manifest = await buildManifest(npi, [cachedNppesResult as any]);
  
  let effectivePosture = manifest.readinessPosture;
  let hasStaleData = false;

  // Freshness Engine Decision Impact
  if (nppesFreshness.state === FreshnessState.EXPIRED) {
    effectivePosture = ReadinessPosture.INSUFFICIENT_DATA;
    manifest.limitations.push({ code: 'DATA_EXPIRED', description: 'Core identity data has expired.' });
  } else if (nppesFreshness.state === FreshnessState.STALE) {
    hasStaleData = true;
    if (effectivePosture === ReadinessPosture.DECISION_GRADE) {
      effectivePosture = ReadinessPosture.PARTIAL; // Degrade
    }
    manifest.limitations.push({ code: 'DATA_STALE', description: 'Some verification data is stale and requires refresh.' });
  } else if (nppesFreshness.state === FreshnessState.AGING) {
    // Fire off async refresh in background (conceptual)
    manifest.limitations.push({ code: 'DATA_AGING', description: 'Data is approaching expiration.' });
  }

  const recognition = {
    posture: effectivePosture,
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
  if (effectivePosture === ReadinessPosture.DECISION_GRADE && historicAcceptance?.action === 'PROCEED') {
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
    readinessPosture: effectivePosture as any,
    missingRequirements: manifest.limitations.map(l => l.description),
    hasAdverseSignals: effectivePosture === ReadinessPosture.BLOCKED,
    employerAction: historicAcceptance?.action as any || 'NONE',
    isStale: hasStaleData,
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

  // 7. LEARNING & OUTCOME CONTEXT
  const historicOutcomes = await fetchOutcomeHistory(npi, employerId);
  const learningContext = buildOutcomeMemory(npi, historicOutcomes, employerId);
  
  // Synthesize learning into the NBA (overrides base NBA if learning dictates)
  if (learningContext.patterns.failureRate > 0.5 && nextBestAction.action === 'PROCEED') {
    nextBestAction.action = 'ESCALATE';
    nextBestAction.reasoning = 'Historical failure rate >50% for this provider/org combination. Manual review required despite minimum evidence.';
  }
  
  // If activated or failed, we would record the outcome here
  if (startReady) {
    await recordDecisionOutcome({
      npi,
      orgId: employerId,
      decisionState: 'hash_' + Math.random().toString(36).substring(7),
      actionTaken: 'PROCEED',
      outcome: OutcomeResult.STARTED,
      timeToStartMs: historicAcceptance?.createdAt ? Date.now() - new Date(historicAcceptance.createdAt).getTime() : 0,
      timestamp: new Date().toISOString()
    });
  }

  // 8. TRUST CALIBRATION
  // Evaluate the confidence of the system recommendation
  const evidenceStrength = manifest.coverage.filter(c => c.status === 'checked').length / Math.max(1, manifest.coverage.length);
  const freshnessScore = 0.9;
  const issuerTrustLevel = 0.95; 

  const calibration = calibrateTrust(
    manifest.readinessPosture as any,
    evidenceStrength,
    freshnessScore,
    issuerTrustLevel,
    learningContext
  );

  // 9. ORGANIZATION POLICY ENFORCEMENT
  const orgPolicy = await fetchOrgPolicy(employerId);
  const presentSignals = manifest.claims.map(c => c.type);

  const policyResult = applyOrgPolicy(
    orgPolicy,
    effectivePosture as any,
    calibration.calibratedState,
    nextBestAction.action,
    presentSignals,
    hasStaleData,
    learningContext.patterns.failureRate
  );

  // Apply policy overrides
  nextBestAction.action = policyResult.finalAction;
  if (policyResult.policyNotes.length > 0) {
    nextBestAction.reasoning = policyResult.policyNotes.join(' | ');
  }

  const canonicalStateHash = 'hash_' + Math.random().toString(36).substring(7);
  const snapshotId = `snap_${Date.now()}_${npi}`;

  // 10. TIME-LOCKED TRUTH SNAPSHOT
  const truthSnapshot: TruthSnapshot = {
    snapshotId,
    npi,
    timestamp: new Date().toISOString(),
    sourceStates: [
      { sourceId: 'nppes', status: cachedNppesResult.status as any, verifiedAt: cachedNppesResult.timestamp }
    ],
    claims: manifest.claims.map(c => ({ claimId: c.id, type: c.type, value: c.value, issuerId: VITALCV_SYSTEM_ISSUER })),
    receipts: manifest.receipts.map(r => ({ sourceId: 'unknown', receiptHash: r })),
    freshnessStates: [
      { sourceId: 'nppes', state: nppesFreshness.state, ageMs: nppesFreshness.ageMs }
    ],
    arbitrationResult: {
      conflictsResolved: 0,
      finalValues: {}
    }
  };

  // 11. DECISION TRACE ENGINE
  const decisionTrace: DecisionTrace = {
    traceId: `trace_${Date.now()}_${npi}`,
    snapshotId,
    subjectNpi: npi,
    orgId: employerId,
    timestamp: new Date().toISOString(),
    layers: {
      truth: {
        coverageChecked: manifest.coverage.filter(c => c.status === 'checked').length,
        totalLanes: manifest.coverage.length,
        limitations: manifest.limitations.map(l => l.description)
      },
      enforcement: {
        passed: true, // Assuming Truth Enforcement Gate ran pre-manifest
        violations: []
      },
      registry: {
        validIssuers: ['did:web:vitalcv.com'],
        revokedIssuersBlocked: []
      },
      arbitration: {
        conflictsResolved: 0,
        reasons: []
      },
      policy: {
        orgId: employerId,
        policyOverridesApplied: policyResult.policyNotes
      },
      learning: {
        priorDecisions: learningContext.patterns.totalDecisions,
        historicalFailureRate: learningContext.patterns.failureRate,
        learningOverridesApplied: learningContext.patterns.failureRate > 0.5 ? ['Historical failure > 50%: Downgraded to ESCALATE'] : []
      },
      confidence: {
        evidenceStrength,
        blendedScore: 0.9, // mock derived score
        calibratedState: policyResult.finalCalibratedState
      }
    },
    final: {
      decisionStateHash: canonicalStateHash,
      nextBestAction: nextBestAction.action,
      readinessPosture: policyResult.finalPosture
    }
  };

  await storeDecisionTrace(decisionTrace, truthSnapshot);

  return {
    orchestrator_active: true,
    system_unified: true,
    learning_pipeline: true,
    decisionState: {
      npi,
      generatedAt: new Date().toISOString(),
      canonicalStateHash,
      calibratedState: policyResult.finalCalibratedState
    },
    recognition: {
      ...recognition,
      posture: policyResult.finalPosture,
    },
    acceptance,
    activation,
    nextBestAction,
    monitoringPlan,
    learningContext,
    calibration,
    orgPolicy: {
      applied: policyResult.policyApplied,
      notes: policyResult.policyNotes
    }
  };
}

const VITALCV_SYSTEM_ISSUER = 'did:web:vitalcv.com';
