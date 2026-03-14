/**
 * types.ts — Shared types for the AI Verification Agent Swarm
 *
 * Architecture:
 *   Source Systems
 *     ↓
 *   AI Agent (per domain) — queries source, extracts evidence, detects anomalies
 *     ↓
 *   EvidenceBundle — normalized, structured evidence from one agent run
 *     ↓
 *   VerificationArtifact — persisted in Prisma
 *     ↓
 *   TrustState — recomputed from artifacts
 */

export type AgentName =
  | 'license_verification'
  | 'sanctions_monitoring'
  | 'board_certification'
  | 'training_verification'
  | 'privilege_verification';

export type AgentStatus =
  | 'idle'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped';

export type EvidenceConfidence =
  | 'HIGH'    // Live API response, cryptographically anchored
  | 'MEDIUM'  // Derived from multiple sources, consistent
  | 'LOW'     // Single source, no corroboration
  | 'STUB';   // Source not yet integrated (returns structured placeholder)

export type AnomalySeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

/** Structured evidence unit emitted by an agent */
export interface EvidenceBundle {
  agentName: AgentName;
  npi: string;
  source: string;                        // VerificationArtifact.source value
  credentialType: string;
  status: 'ACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'REVOKED' | 'NOT_FOUND' | 'UNKNOWN';
  confidence: EvidenceConfidence;
  rawData: Record<string, unknown>;      // Raw response from source
  normalizedFields: {
    licenseNumber?: string;
    state?: string;
    issuingBody?: string;
    issueDate?: string;
    expiryDate?: string;
    sanctionType?: string;
    programName?: string;
    privilegeType?: string;
    facility?: string;
    specialty?: string;
  };
  extractedAt: string;                   // ISO
  sourceUrl?: string;
  ttlHours: number;                      // How long this evidence is valid before re-check
}

/** Inconsistency detected across two or more evidence sources */
export interface Anomaly {
  id: string;
  npi: string;
  agentName: AgentName;
  severity: AnomalySeverity;
  description: string;
  field: string;
  sourceA: { name: string; value: string };
  sourceB: { name: string; value: string };
  detectedAt: string;
  recommendation: string;
}

/** Result of a single agent run */
export interface AgentRunResult {
  agentName: AgentName;
  npi: string;
  status: AgentStatus;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  evidenceBundles: EvidenceBundle[];
  anomalies: Anomaly[];
  artifactsCreated: number;
  trustStateRefreshed: boolean;
  error?: string;
}

/** Result of a full swarm run (all agents) */
export interface SwarmRunResult {
  npi: string;
  swarmId: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  agentResults: AgentRunResult[];
  totalEvidenceBundles: number;
  totalAnomalies: number;
  totalArtifactsCreated: number;
  anomaliesBySeverity: Record<AnomalySeverity, number>;
  trustStateRefreshed: boolean;
}

/** Monitoring schedule per agent */
export interface AgentScheduleEntry {
  agentName: AgentName;
  intervalHours: number;
  description: string;
  lastRunAt?: string;
  nextRunAt?: string;
}

export const AGENT_SCHEDULES: Record<AgentName, AgentScheduleEntry> = {
  license_verification:   { agentName: 'license_verification',   intervalHours: 24 * 30, description: 'Re-verify state license every 30 days' },
  sanctions_monitoring:   { agentName: 'sanctions_monitoring',   intervalHours: 24,      description: 'Check OIG/LEIE exclusion list daily'   },
  board_certification:    { agentName: 'board_certification',    intervalHours: 24 * 90, description: 'Verify board certification every 90 days' },
  training_verification:  { agentName: 'training_verification',  intervalHours: 24 * 180,description: 'Validate training records every 180 days' },
  privilege_verification: { agentName: 'privilege_verification', intervalHours: 24 * 14, description: 'Re-check hospital privileges every 14 days' },
};
