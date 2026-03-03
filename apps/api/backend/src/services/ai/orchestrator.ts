/**
 * orchestrator.ts — Wave 47: Zero-Manual-Lift Orchestrator
 *
 * The main entry point for the autonomous credentialing pipeline.
 * Receives a document, runs extraction → verification → decision → mint/escalate.
 */

import { log } from '../../obs/logger';
import { documentPipeline } from './documentPipeline';
import type { DocumentExtractionResult } from './documentPipeline';
import { sourceVerifier } from './sourceVerifier';
import type { SourceVerificationResult } from './sourceVerifier';
import { decisionCapsule } from './decisionCapsule';
import type { DecisionCapsule } from './decisionCapsule';

// ── Types ──────────────────────────────────────────────────────────

export interface PipelineStep {
  step: string;
  status: 'success' | 'failure';
  durationMs: number;
  detail: string;
}

export interface OrchestratorResult {
  npi: string;
  extraction: DocumentExtractionResult;
  verification: SourceVerificationResult;
  capsule: DecisionCapsule;
  pipelineSteps: PipelineStep[];
  totalDurationMs: number;
}

// ── Pipeline ───────────────────────────────────────────────────────

async function processCredentialDocument(
  fileBuffer: Buffer,
  mimeType: string,
  npi: string,
): Promise<OrchestratorResult> {
  const pipelineStart = Date.now();
  const steps: PipelineStep[] = [];

  log('info', 'orchestrator_pipeline_start', { npi, mimeType, bufferSize: fileBuffer.length });

  // Step 1: Document extraction
  let extraction: DocumentExtractionResult;
  const extractStart = Date.now();
  try {
    extraction = await documentPipeline.extractFromDocument(fileBuffer, mimeType);
    steps.push({
      step: 'document_extraction',
      status: 'success',
      durationMs: Date.now() - extractStart,
      detail: `Extracted ${extraction.extractedFields.filter((f) => f.value).length} fields, type=${extraction.documentType}, confidence=${extraction.overallConfidence.toFixed(3)}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown extraction error';
    steps.push({ step: 'document_extraction', status: 'failure', durationMs: Date.now() - extractStart, detail: message });
    log('error', 'orchestrator_extraction_failed', { npi, error: message });
    throw new Error(`Document extraction failed: ${message}`);
  }

  // Step 2: Primary source verification
  let verification: SourceVerificationResult;
  const verifyStart = Date.now();
  try {
    verification = await sourceVerifier.verifyDocument(extraction);
    steps.push({
      step: 'source_verification',
      status: 'success',
      durationMs: Date.now() - verifyStart,
      detail: `verified=${verification.verified}, overallMatch=${verification.overallMatch}, discrepancies=${verification.discrepancies.length}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown verification error';
    steps.push({ step: 'source_verification', status: 'failure', durationMs: Date.now() - verifyStart, detail: message });
    log('error', 'orchestrator_verification_failed', { npi, error: message });
    throw new Error(`Source verification failed: ${message}`);
  }

  // Step 3: Decision capsule — mint/escalate
  let capsule: DecisionCapsule;
  const decisionStart = Date.now();
  try {
    capsule = await decisionCapsule.mintDecisionCapsule(extraction, verification, npi);
    steps.push({
      step: 'decision_capsule',
      status: 'success',
      durationMs: Date.now() - decisionStart,
      detail: `decision=${capsule.decision}, capsuleId=${capsule.capsuleId}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown decision error';
    steps.push({ step: 'decision_capsule', status: 'failure', durationMs: Date.now() - decisionStart, detail: message });
    log('error', 'orchestrator_decision_failed', { npi, error: message });
    throw new Error(`Decision capsule minting failed: ${message}`);
  }

  const totalDurationMs = Date.now() - pipelineStart;

  log('info', 'orchestrator_pipeline_complete', {
    npi,
    decision: capsule.decision,
    capsuleId: capsule.capsuleId,
    totalDurationMs,
    stepCount: steps.length,
  });

  return {
    npi,
    extraction,
    verification,
    capsule,
    pipelineSteps: steps,
    totalDurationMs,
  };
}

export const orchestrator = { processCredentialDocument };
