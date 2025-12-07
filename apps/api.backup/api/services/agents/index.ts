/**
 * Agent Orchestration System - Main Export
 * B140B Implementation
 *
 * Exports all agent system components for easy importing
 */

// Registry
export {
  registry,
  AgentRegistry,
  AgentProvider,
  AgentType,
  AgentScope,
  RiskTier,
  type AgentRecord,
} from './registry';

// Router
export {
  router,
  AgentRouter,
  type TaskSpec,
  type RoutingResult,
  type RoutingPolicy,
} from './router';

// Workflow Engine
export {
  workflowEngine,
  WorkflowEngine,
  WorkflowStep,
  WorkflowStatus,
  type WorkflowDefinition,
  type WorkflowStepConfig,
  type WorkflowStepResult,
  type WorkflowExecution,
} from './workflowEngine';

// Shared Signals
export {
  sharedSignalsAdapter,
  SharedSignalsAdapter,
  SignalType,
  SignalSeverity,
  SignalSource,
  type RiskSignal,
  type SignalEvent,
} from './sharedSignalsAdapter';

// Risk Scoring
export {
  riskScoringAdapter,
  RiskScoringAdapter,
  RiskCategory,
  RiskLevel,
  type ActionInput,
  type RiskScoreResult,
} from './riskScoring';

// Transcript Store
export {
  transcriptStore,
  TranscriptStore,
  TranscriptType,
  TranscriptStatus,
  type Transcript,
  type TranscriptEntry,
  type TranscriptAccessLog,
} from './transcriptStore';

// OpenAI Adapter
export {
  openaiAdapter,
  OpenAIAdapter,
  type OpenAIAgentConfig,
  type GuardrailConfig,
  type AgentRequest,
  type AgentResponse,
} from './openaiAdapter';

// Copilot Adapter
export {
  copilotAdapter,
  CopilotAdapter,
  type RefactorRequest,
  type RefactorResult,
  type CodeAnalysis,
} from './copilotAdapter';

// OpenCode Adapter
export {
  opencodeAdapter,
  OpenCodeAdapter,
  type AutomationTask,
  type AutomationResult,
  type RepoSyncConfig,
} from './opencodeAdapter';

