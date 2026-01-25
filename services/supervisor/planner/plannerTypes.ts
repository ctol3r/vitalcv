import type { SupervisorTaskType } from '@prisma/client';

export interface PlannedTask {
  taskType: SupervisorTaskType;
  priority: number;
  triggeredBy: string;
  metadata?: Record<string, unknown>;
}
