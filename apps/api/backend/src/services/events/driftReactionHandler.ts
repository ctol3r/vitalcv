/**
 * driftReactionHandler.ts
 *
 * Subscribes to drift events on the in-process event bus and persists a
 * Notification row for each HARD_DRIFT_TRIGGERED event. Best-effort:
 * DB failures are logged but never thrown back to the emitter, so a
 * failing reaction handler cannot cascade into the decision path.
 *
 * Does NOT modify the drift engine, decision logic, or Acceptance/Start.
 */

import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import { on, type VcvEvent } from './eventBus';

export const HARD_DRIFT_EVENT = 'HARD_DRIFT_TRIGGERED';
export const SOFT_DRIFT_EVENT = 'SOFT_DRIFT_TRIGGERED';

export function buildDriftMessage(event: VcvEvent): string {
  const severity = event.severity ?? 'UNKNOWN';
  const source = event.source ?? 'drift';
  if (event.type === HARD_DRIFT_EVENT) {
    return `Hard drift detected (${severity}) from ${source}. Review required before acting.`;
  }
  if (event.type === SOFT_DRIFT_EVENT) {
    return `Soft drift detected (${severity}) from ${source}. Additional checks recommended.`;
  }
  return `Drift event: ${event.type} (${severity})`;
}

export async function handleDriftEvent(event: VcvEvent): Promise<void> {
  if (!event.clinicianNpi) return;
  try {
    await prisma.notification.create({
      data: {
        clinicianNpi: event.clinicianNpi,
        eventType: event.type,
        severity: event.severity ?? 'INFO',
        message: buildDriftMessage(event),
      },
    });
  } catch (error) {
    log('warn', 'drift_notification_write_failed', {
      type: event.type,
      message: error instanceof Error ? error.message : 'unknown',
    });
  }
}

let registered = false;
let unsubscribers: Array<() => void> = [];

export function registerDriftReactionHandlers(): void {
  if (registered) return;
  registered = true;
  unsubscribers = [
    on(HARD_DRIFT_EVENT, handleDriftEvent),
    on(SOFT_DRIFT_EVENT, handleDriftEvent),
  ];
}

// Exported for tests.
export function __unregisterDriftReactionHandlersForTests(): void {
  for (const unsub of unsubscribers) unsub();
  unsubscribers = [];
  registered = false;
}
