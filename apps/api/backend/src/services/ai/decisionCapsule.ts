/**
 * decisionCapsule.ts — Wave 47: Cryptographic Decision Capsule
 *
 * When document extraction matches primary source verification,
 * mints a decision capsule: a cryptographically anchored proof of
 * WHY the AI approved (or rejected) the credential.
 */

import { randomUUID } from 'node:crypto';
import prisma, { Prisma } from '../../graphql/prisma_client';
import { sha256ForPayload, sha256Hex } from '../../utils/deterministic';
import { log } from '../../obs/logger';
import type { DocumentExtractionResult } from './documentPipeline';
import type { SourceVerificationResult } from './sourceVerifier';

// ── Types ──────────────────────────────────────────────────────────

export type DecisionOutcome = 'APPROVED' | 'REJECTED' | 'ESCALATED';

export interface DecisionCapsule {
  capsuleId: string;
  npi: string;
  decision: DecisionOutcome;
  reasoning: string[];
  documentHash: string;
  boardResponseHash: string;
  merkleLeafHash: string;
  confidence: number;
  createdAt: string;
}

// ── Decision Logic ─────────────────────────────────────────────────

function buildReasoning(
  extraction: DocumentExtractionResult,
  verification: SourceVerificationResult,
): { decision: DecisionOutcome; reasoning: string[] } {
  const reasoning: string[] = [];

  if (!verification.boardRecord) {
    reasoning.push('No board record found for the extracted license.');
    return { decision: 'REJECTED', reasoning };
  }

  if (verification.boardRecord.status !== 'ACTIVE') {
    reasoning.push(`Board record status is ${verification.boardRecord.status}, not ACTIVE.`);
    return { decision: 'REJECTED', reasoning };
  }

  if (verification.discrepancies.length > 0) {
    for (const d of verification.discrepancies) {
      reasoning.push(
        `Field "${d.fieldName}" mismatch: extracted="${d.extractedValue}", board="${d.boardValue}".`,
      );
    }
    reasoning.push('Discrepancies detected — escalating to human review.');
    return { decision: 'ESCALATED', reasoning };
  }

  if (extraction.overallConfidence < 0.95) {
    reasoning.push(
      `OCR confidence ${extraction.overallConfidence.toFixed(3)} is below 0.95 threshold.`,
    );
    reasoning.push('Low confidence — escalating to human review.');
    return { decision: 'ESCALATED', reasoning };
  }

  reasoning.push('All fields match the authoritative board record.');
  reasoning.push(`Board status: ${verification.boardRecord.status}.`);
  reasoning.push(`OCR confidence: ${extraction.overallConfidence.toFixed(3)}.`);
  reasoning.push('Decision: APPROVED — no human review required.');
  return { decision: 'APPROVED', reasoning };
}

// ── Mint ────────────────────────────────────────────────────────────

async function mintDecisionCapsule(
  extraction: DocumentExtractionResult,
  verification: SourceVerificationResult,
  npi: string,
): Promise<DecisionCapsule> {
  const { decision, reasoning } = buildReasoning(extraction, verification);

  const documentHash = sha256ForPayload(extraction);
  const boardResponseHash = verification.boardRecord
    ? sha256ForPayload(verification.boardRecord.rawResponse)
    : sha256Hex('no_board_record');
  const merkleLeafHash = sha256Hex(`${documentHash}:${boardResponseHash}`);

  const capsuleId = randomUUID();
  const createdAt = new Date().toISOString();

  const capsule: DecisionCapsule = {
    capsuleId,
    npi,
    decision,
    reasoning,
    documentHash,
    boardResponseHash,
    merkleLeafHash,
    confidence: extraction.overallConfidence,
    createdAt,
  };

  // Persist audit event
  await prisma.auditEvent.create({
    data: {
      type: 'AI_DECISION_CAPSULE',
      hash: merkleLeafHash,
      referenceId: capsuleId,
      clinicianId: npi,
      metadata: capsule as unknown as Prisma.InputJsonValue,
      anchored: false,
      merkleRoot: null,
    },
  });

  // If approved, create a VerificationArtifact
  if (decision === 'APPROVED' && verification.boardRecord) {
    await prisma.verificationArtifact.create({
      data: {
        npi,
        source: `AI_PSV:${verification.boardRecord.boardName}`,
        status: verification.boardRecord.status,
        rawPayload: capsule as unknown as Prisma.InputJsonValue,
        checksum: merkleLeafHash,
        merkleRoot: merkleLeafHash,
        claimHashes: [documentHash, boardResponseHash],
        lifecycleState: 'active',
        trustState: 'verified',
        verifiedAt: new Date(),
      },
    });
  }

  // If escalated, create an HITL escalation event
  if (decision === 'ESCALATED') {
    await prisma.auditEvent.create({
      data: {
        type: 'AI_HITL_ESCALATION',
        hash: sha256Hex(`hitl:${capsuleId}`),
        referenceId: capsuleId,
        clinicianId: npi,
        metadata: {
          capsuleId,
          npi,
          decision,
          reasoning,
          confidence: extraction.overallConfidence,
          discrepancies: verification.discrepancies,
          status: 'pending',
        } as unknown as Prisma.InputJsonValue,
        anchored: false,
      },
    });
  }

  log('info', 'decision_capsule_minted', {
    capsuleId,
    npi,
    decision,
    confidence: extraction.overallConfidence,
    reasoningCount: reasoning.length,
  });

  return capsule;
}

export const decisionCapsule = { mintDecisionCapsule };
