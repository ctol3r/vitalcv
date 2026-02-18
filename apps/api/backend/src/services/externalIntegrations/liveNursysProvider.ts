/**
 * Live Nursys Provider — Wave X
 *
 * Production provider that calls the real Nursys API.
 * Requires:
 *   - NURSYS_API_KEY: API key for authentication
 *   - NURSYS_BASE_URL: Base URL for the Nursys API
 *
 * Enforces timeout and logs failures via failureIsolationEngine.
 */

import type { NursysEvent, NursysProvider } from './types';
import { logSystemFailure } from '../failureIsolationEngine';
import { log } from '../../obs/logger';

const DEFAULT_TIMEOUT_MS = 10_000;

export class LiveNursysProvider implements NursysProvider {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor() {
    const apiKey = process.env.NURSYS_API_KEY?.trim();
    const baseUrl = process.env.NURSYS_BASE_URL?.trim();

    if (!apiKey) {
      throw new Error('NURSYS_API_KEY is required for live Nursys provider.');
    }
    if (!baseUrl) {
      throw new Error('NURSYS_BASE_URL is required for live Nursys provider.');
    }

    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.timeoutMs = DEFAULT_TIMEOUT_MS;
  }

  async fetchLicenseStatus(npi: string): Promise<NursysEvent[]> {
    const normalized = npi.trim();
    if (!normalized) {
      return [];
    }

    const url = `${this.baseUrl}/api/v1/license-status?npi=${encodeURIComponent(normalized)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'unknown');
        await logSystemFailure('live-nursys-provider', 'error', `Nursys API returned ${response.status}: ${errorText}`);
        return [];
      }

      const data = await response.json() as { events?: Array<Record<string, unknown>> };
      const events: NursysEvent[] = [];

      if (Array.isArray(data.events)) {
        for (const raw of data.events) {
          events.push({
            npi: normalized,
            licenseNumber: String(raw.licenseNumber ?? ''),
            state: String(raw.state ?? ''),
            eventType: String(raw.eventType ?? ''),
            rawPayload: raw,
            receivedAt: new Date(),
          });
        }
      }

      log('info', 'nursys_live_fetch_success', {
        event: 'nursys_live_fetch_success',
        npi: normalized,
        eventCount: events.length,
      });

      return events;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown';
      await logSystemFailure('live-nursys-provider', 'error', `Nursys API call failed: ${message}`);
      return [];
    } finally {
      clearTimeout(timeout);
    }
  }
}
