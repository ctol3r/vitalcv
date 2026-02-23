import type { Prisma } from "../generated/prisma";
import { prisma } from "./prisma";

export type VerifierRef = 'demo' | 'yc' | 'direct';

export function normalizeVerifierRef(value: unknown): VerifierRef | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'demo' || normalized === 'yc' || normalized === 'direct') {
    return normalized;
  }

  return null;
}

export type EventType =
  | "npi_lookup"
  | "share_link_created"
  | "artifact_viewed"
  | "artifact_exported"
  | "verifier_page_view"
  | "verify_api_call"
  | "pilot_activation_click"
  | "pilot_activation_success";

/**
 * Persist a traction event to the EventLog table.
 * Fire-and-forget: errors are logged, never thrown to callers.
 */
export async function logEvent(
  eventType: EventType,
  npi: string,
  metadata?: Record<string, unknown>,
  organizationId?: string,
): Promise<void> {
  try {
    await prisma.eventLog.create({
      data: {
        eventType,
        npi,
        metadata: (metadata as Prisma.InputJsonValue) ?? undefined,
        ...(organizationId ? { organizationId } : {}),
      },
    });
  } catch (err) {
    console.error(`[events] Failed to log ${eventType}:`, err);
  }
}
