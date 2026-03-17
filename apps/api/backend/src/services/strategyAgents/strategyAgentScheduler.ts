import * as cron from 'node-cron';
import { isAutomatedTestRuntime } from '../../config/runtimeMode';
import type { StrategyAgentType } from './contracts';
import { STRATEGY_AGENT_SPECS, runStrategyAgents } from './strategyAgentService';

type StrategySchedulerState = Record<StrategyAgentType, {
  inProgress: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastError: string | null;
}>;

const STRATEGY_CRON_SPECS: Record<StrategyAgentType, string> = {
  NETWORK_EVOLUTION: '0 4 * * *',
  PROVIDER_TRAJECTORY: '0 6 * * 1',
  INSTITUTION_MOMENTUM: '30 6 * * 1',
  SPECIALTY_PRESSURE: '0 7 1 * *',
};

const STRATEGY_TIMEZONE = 'America/Los_Angeles';

let tasks = new Map<StrategyAgentType, cron.ScheduledTask>();

const state = STRATEGY_AGENT_SPECS.reduce<StrategySchedulerState>((acc, spec) => {
  acc[spec.agentType] = {
    inProgress: false,
    lastRunAt: null,
    nextRunAt: null,
    lastError: null,
  };
  return acc;
}, {} as StrategySchedulerState);

function nextRunAt(agentType: StrategyAgentType, fromIso = new Date().toISOString()): string {
  const from = new Date(fromIso);
  const next = new Date(from);

  switch (agentType) {
    case 'NETWORK_EVOLUTION':
      next.setUTCDate(next.getUTCDate() + 1);
      next.setUTCHours(11, 0, 0, 0);
      break;
    case 'PROVIDER_TRAJECTORY':
      next.setUTCDate(next.getUTCDate() + 7);
      next.setUTCHours(13, 0, 0, 0);
      break;
    case 'INSTITUTION_MOMENTUM':
      next.setUTCDate(next.getUTCDate() + 7);
      next.setUTCHours(13, 30, 0, 0);
      break;
    case 'SPECIALTY_PRESSURE':
      next.setUTCMonth(next.getUTCMonth() + 1, 1);
      next.setUTCHours(14, 0, 0, 0);
      break;
  }

  return next.toISOString();
}

async function runScheduledAgent(agentType: StrategyAgentType): Promise<void> {
  const agentState = state[agentType];
  if (!agentState || agentState.inProgress) {
    return;
  }

  agentState.inProgress = true;
  agentState.lastError = null;

  try {
    await runStrategyAgents({
      agentTypes: [agentType],
      trigger: 'scheduled',
      refreshPredictions: true,
    });
    agentState.lastRunAt = new Date().toISOString();
  } catch (error) {
    agentState.lastError = error instanceof Error ? error.message : String(error);
  } finally {
    agentState.inProgress = false;
    agentState.nextRunAt = nextRunAt(agentType, agentState.lastRunAt ?? new Date().toISOString());
  }
}

export function startStrategyAgentScheduler(): void {
  const enabled = !isAutomatedTestRuntime() && process.env.STRATEGY_AGENTS_ENABLED !== 'false';
  if (!enabled || tasks.size > 0) {
    return;
  }

  for (const spec of STRATEGY_AGENT_SPECS) {
    state[spec.agentType].nextRunAt = nextRunAt(spec.agentType);
    tasks.set(spec.agentType, cron.schedule(
      STRATEGY_CRON_SPECS[spec.agentType],
      () => {
        void runScheduledAgent(spec.agentType);
      },
      {
        timezone: STRATEGY_TIMEZONE,
      },
    ));
  }
}

export function stopStrategyAgentScheduler(): void {
  for (const task of tasks.values()) {
    task.stop();
  }
  tasks = new Map();
}

export function getStrategyAgentSchedulerState(): StrategySchedulerState {
  return state;
}

export function getStrategyAgentSchedulerSummary(): {
  running: boolean;
  agentCount: number;
} {
  return {
    running: tasks.size > 0,
    agentCount: tasks.size,
  };
}
