/**
 * Autopilot Engine Types
 * Type definitions for the Autopilot Engine system
 */

export enum AutopilotStatus {
  Idle = 'idle',
  Running = 'running',
  Ready = 'ready',
  AttentionNeeded = 'attentionNeeded',
}

export interface AutopilotIssue {
  id: string;
  task: string;
  error: Error;
  timestamp: Date;
  isCritical?: boolean;
}

export interface AutopilotTask {
  id: string;
  name: string;
  priority: number;
  execute: () => Promise<void>;
  description?: string;
  category?: string;
}

export interface AutopilotHealthSummary {
  status: AutopilotStatus;
  lastRun: Date | null;
  pendingIssues: number;
  totalTasks: number;
  completedTasks: number;
  confidence: number;
}

export interface AutopilotConfig {
  enabled: boolean;
  trustCheckIntervalHours: number;
  compactSyncIntervalHours: number;
  quietModeEnabled: boolean;
  batterySaverMode: boolean;
}

export interface AutopilotSnapshot {
  hasCriticalIssues: boolean;
  trustScore: number;
  compliance: number;
  credentials: Array<{
    id: string;
    status: 'active' | 'expiring' | 'expired';
    expirationDate?: string;
  }>;
  chainAnchors: Array<{
    id: string;
    status: 'active' | 'stale' | 'missing';
    lastUpdated: string;
  }>;
}

