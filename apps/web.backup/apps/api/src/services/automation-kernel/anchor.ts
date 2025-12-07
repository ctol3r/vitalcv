import { anchorEvent } from '../audit/anchor';

/**
 * Anchor automation kernel event to blockchain
 */
export function anchorAutomationKernelEvent(
  taskType: string,
  clinicianId: string,
  status: string,
  metadata?: Record<string, unknown>,
) {
  return anchorEvent('automationKernelAnchored', {
    taskType,
    clinicianId,
    status,
    metadata: metadata ?? {},
    timestamp: new Date().toISOString(),
  });
}

