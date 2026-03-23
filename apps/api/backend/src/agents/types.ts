// ── Agent Identity ────────────────────────────────────────────

export type AgentId = 'sanctions' | 'state_board';

// ── Agent Result Types ────────────────────────────────────────

export type SanctionStatus = 'CLEARED' | 'EXCLUDED' | 'UNCERTAIN';

export type SanctionResult = {
  agentId: 'sanctions';
  npi: string;
  status: SanctionStatus;
  source: 'OIG_LEIE';
  receiptHash: string;
  checkedAt: string;
};

export type LicenseStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'SUSPENDED' | 'NOT_FOUND';

export type StateBoardResult = {
  agentId: 'state_board';
  npi: string;
  licenseNumber: string;
  status: LicenseStatus;
  boardName: string;
  state: string;
  expiresAt: string;
  checkedAt: string;
};

/** Discriminated union — narrow on `agentId`. */
export type AgentResult = SanctionResult | StateBoardResult;

// ── Telemetry ─────────────────────────────────────────────────

export type TelemetryEntry = {
  id: string;
  agentId: AgentId;
  action: string;
  npi: string;
  result: AgentResult;
  durationMs: number;
  timestamp: string;
};

// ── Agent Lifecycle ───────────────────────────────────────────

export type AgentStatus = 'idle' | 'running' | 'stopped' | 'error';

export type AgentConfig = {
  id: AgentId;
  intervalMs: number;
  enabled: boolean;
};

// ── Orchestrator Events ───────────────────────────────────────

export type OrchestratorEventMap = {
  verification_completed: [entry: TelemetryEntry];
  sanction_detected: [entry: TelemetryEntry];
};
