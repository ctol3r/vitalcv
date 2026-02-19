/**
 * Phase 1D — PSV Artifact Builder.
 *
 * Transforms a NormalizedCredentialPayload into a fully signed PsvArtifact.
 *
 * Pipeline:
 *   1. Canonicalize rawPayload → hash → rawPayloadHashSha256
 *   2. Generate artifactId (crypto.randomUUID)
 *   3. Calculate DecisionWindow (120-day NCQA default)
 *   4. Build partial artifact (all fields except evidenceIntegrity)
 *   5. Canonicalize + hash the partial artifact → artifactHash
 *   6. Sign artifactHash via ES256
 *   7. Attach EvidenceIntegrity
 *   8. Return complete PsvArtifact
 */

import { randomUUID } from 'node:crypto';
import { canonicalizeJson, sha256Hex } from './canonicalize';
import { signArtifactHash } from './signingService';
import type {
  PsvArtifact,
  EvidenceIntegrity,
  DecisionWindow,
  Monitoring,
  EnrollmentContext,
  WindowStatus,
} from '../../../types/psv';

// Re-export the adapter types so callers can import from one place.
export type { NormalizedCredentialPayload } from '../../../adapters/types';

const ARTIFACT_VERSION = '1.0' as const;
const NCQA_WINDOW_DAYS = 120;
const SYSTEM_ID = 'vitalcv-psv-engine';
const AGENT_VERSION = '1.0.0';

// ── Decision Window ──────────────────────────────────────────

function computeDecisionWindow(retrievedAtUtc: string): DecisionWindow {
  const retrievedDate = new Date(retrievedAtUtc);
  const now = new Date();
  const daysSinceRetrieval = Math.floor(
    (now.getTime() - retrievedDate.getTime()) / (1000 * 60 * 60 * 24),
  );
  const daysRemaining = NCQA_WINDOW_DAYS - daysSinceRetrieval;

  let windowStatus: WindowStatus;
  if (daysRemaining <= 0) {
    windowStatus = 'Out_of_Window';
  } else if (daysRemaining <= 30) {
    windowStatus = 'Approaching';
  } else {
    windowStatus = 'Compliant';
  }

  return {
    daysSinceRetrieval,
    ncqaWindowDays: NCQA_WINDOW_DAYS,
    withinNcqaWindow: daysSinceRetrieval <= NCQA_WINDOW_DAYS,
    nextExpirationWarningDays: Math.max(0, daysRemaining),
    windowStatus,
  };
}

// ── Builder ──────────────────────────────────────────────────

interface BuilderInput {
  provider: {
    npi: string;
    taxonomyCode: string;
    providerType: import('../../../types/psv').ProviderType;
    fullName: string;
    dateOfBirth?: string;
    stateOfPractice: string;
  };
  credential: {
    credentialType: import('../../../types/psv').CredentialType;
    credentialIdentifier: string;
    issuingStateOrBody: string;
    status: import('../../../types/psv').CredentialStatus;
    issueDate?: string;
    expirationDate?: string;
    compactStatus?: {
      participating: boolean;
      compactName: import('../../../types/psv').CompactName;
    };
  };
  source: {
    sourceName: string;
    sourceType: import('../../../types/psv').SourceType;
    sourceEndpoint?: string;
    sourceRecognition: 'PrimarySource' | 'ContractedAgent';
  };
  retrieval: {
    retrievedAtUtc: string;
    retrievalMethod: import('../../../types/psv').RetrievalMethod;
    rawPayload: unknown;
  };
}

export async function buildPsvArtifact(
  payload: BuilderInput,
): Promise<PsvArtifact> {
  // Step 1: Canonicalize + hash the raw payload
  const rawCanonical = canonicalizeJson(payload.retrieval.rawPayload as object);
  const rawPayloadHash = sha256Hex(rawCanonical);

  // Step 2: Generate unique artifact ID
  const artifactId = randomUUID();

  // Step 3: Decision window
  const decisionWindow = computeDecisionWindow(payload.retrieval.retrievedAtUtc);

  // Step 4: Build initial monitoring state
  const monitoring: Monitoring = {
    monitoringEnabled: true,
    lastCheckedAt: new Date().toISOString(),
    changeDetected: false,
    deltaLog: [],
  };

  // Step 5: Enrollment context defaults
  const enrollmentContext: EnrollmentContext = {
    cmsRelevant: true,
    pecosAttachmentReady: false,
    exportFormats: ['JSON', 'PDF'],
    attestation: {
      statement:
        'This artifact was generated from primary source data and has not been manually altered.',
      attestedAt: new Date().toISOString(),
    },
  };

  // Step 6: Build partial artifact (without evidenceIntegrity)
  const environment =
    process.env.NODE_ENV === 'production' ? 'production' as const :
    process.env.NODE_ENV === 'staging' ? 'staging' as const :
    'development' as const;

  const partialArtifact = {
    artifactVersion: ARTIFACT_VERSION,
    artifactId,
    provider: payload.provider,
    credential: payload.credential,
    primarySource: {
      sourceName: payload.source.sourceName,
      sourceType: payload.source.sourceType,
      sourceEndpoint: payload.source.sourceEndpoint,
      sourceRecognition: payload.source.sourceRecognition,
    },
    retrievalEvent: {
      retrievedAtUtc: payload.retrieval.retrievedAtUtc,
      retrievalMethod: payload.retrieval.retrievalMethod,
      retrievedBy: {
        systemId: SYSTEM_ID,
        environment,
        agentVersion: AGENT_VERSION,
      },
      rawPayloadStorageRef: `artifacts/${artifactId}.json`,
      rawPayloadHashSha256: rawPayloadHash,
    },
    decisionWindow,
    monitoring,
    enrollmentContext,
  };

  // Step 7: Canonicalize + hash the partial artifact
  const partialCanonical = canonicalizeJson(partialArtifact);
  const artifactHash = sha256Hex(partialCanonical);

  // Step 8: Sign the artifact hash
  const signature = await signArtifactHash(artifactHash, artifactId);

  // Step 9: Assemble evidence integrity
  const evidenceIntegrity: EvidenceIntegrity = {
    hashAlgorithm: 'SHA-256',
    artifactHash,
    signatureAlgorithm: 'ES256',
    artifactSignature: signature,
    signatureIssuedAt: new Date().toISOString(),
  };

  // Step 10: Return full artifact
  return {
    ...partialArtifact,
    evidenceIntegrity,
  } as PsvArtifact;
}
