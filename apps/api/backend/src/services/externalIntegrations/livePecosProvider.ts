/**
 * Live PECOS Provider — Wave X
 *
 * Production provider that calls the real PECOS/NPPES API.
 * Requires:
 *   - PECOS_API_KEY: API key for authentication
 *   - PECOS_BASE_URL: Base URL for the PECOS API
 *
 * Enforces timeout and logs failures via failureIsolationEngine.
 */

import type { PecosCheck, PecosProvider } from './types';
import { logSystemFailure } from '../failureIsolationEngine';
import { log } from '../../obs/logger';

const DEFAULT_TIMEOUT_MS = 10_000;

export class LivePecosProvider implements PecosProvider {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor() {
    const apiKey = process.env.PECOS_API_KEY?.trim();
    const baseUrl = process.env.PECOS_BASE_URL?.trim();

    if (!apiKey) {
      throw new Error('PECOS_API_KEY is required for live PECOS provider.');
    }
    if (!baseUrl) {
      throw new Error('PECOS_BASE_URL is required for live PECOS provider.');
    }

    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.timeoutMs = DEFAULT_TIMEOUT_MS;
  }

  async fetchEnrollmentStatus(npi: string): Promise<PecosCheck> {
    const normalized = npi.trim();
    if (!normalized) {
      throw new Error('npi is required for PECOS check.');
    }

    const url = `${this.baseUrl}/api/v1/enrollment-status?npi=${encodeURIComponent(normalized)}`;
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
        await logSystemFailure('live-pecos-provider', 'error', `PECOS API returned ${response.status}: ${errorText}`);
        return {
          npi: normalized,
          enrolled: false,
          enrollmentType: null,
          checkedAt: new Date(),
          rawPayload: { error: errorText, status: response.status },
        };
      }

      const data = await response.json() as Record<string, unknown>;
      const now = new Date();

      log('info', 'pecos_live_fetch_success', {
        event: 'pecos_live_fetch_success',
        npi: normalized,
        enrolled: Boolean(data.enrolled),
      });

      return {
        npi: normalized,
        enrolled: Boolean(data.enrolled),
        enrollmentType: typeof data.enrollmentType === 'string' ? data.enrollmentType : null,
        checkedAt: now,
        rawPayload: data,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown';
      await logSystemFailure('live-pecos-provider', 'error', `PECOS API call failed: ${message}`);
      return {
        npi: normalized,
        enrolled: false,
        enrollmentType: null,
        checkedAt: new Date(),
        rawPayload: { error: message },
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
