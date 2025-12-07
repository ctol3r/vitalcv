import type { JobQueueType } from './models/JobQueue.js';

export type PrecedenceGraph = Partial<Record<JobQueueType, JobQueueType[]>>;

export const DEFAULT_PRECEDENCE_GRAPH: PrecedenceGraph = {
  PRIVILEGE_ISSUE: ['PSV_RUN'],
  EHR_SYNC: ['PRIVILEGE_ISSUE'],
  DRIFT_SWEEP: ['PSV_RUN'],
};

export class OrderRulesEngine {
  constructor(private readonly graph: PrecedenceGraph = DEFAULT_PRECEDENCE_GRAPH) {}

  getPredecessors(type: JobQueueType): JobQueueType[] {
    return this.graph[type] ?? [];
  }

  canRun(type: JobQueueType, earlierTypes: Set<JobQueueType>): boolean {
    const blockers = this.getPredecessors(type);
    if (!blockers.length) {
      return true;
    }

    return blockers.every((blocker) => !earlierTypes.has(blocker));
  }
}

export const orderRulesEngine = new OrderRulesEngine();

