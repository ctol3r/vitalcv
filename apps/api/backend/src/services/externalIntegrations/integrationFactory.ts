/**
 * Integration Factory — Wave X
 *
 * Selects mock or live provider based on environment variables:
 *   - NURSYS_MODE=mock|live  (default: mock)
 *   - PECOS_MODE=mock|live   (default: mock)
 *
 * In live mode:
 *   - Validates API key and base URL are present
 *   - Enforces timeout on all calls
 *   - Logs failures via failureIsolationEngine
 */

import type { IntegrationMode, NursysProvider, PecosProvider } from './types';
import { MockNursysProvider } from './mockNursysProvider';
import { MockPecosProvider } from './mockPecosProvider';
import { LiveNursysProvider } from './liveNursysProvider';
import { log } from '../../obs/logger';

// ── Mode parsing ────────────────────────────────────────────

function parseIntegrationMode(envValue: string | undefined): IntegrationMode {
  const normalized = envValue?.trim().toLowerCase();
  if (normalized === 'live') return 'live';
  return 'mock';
}

export function getNursysMode(): IntegrationMode {
  return parseIntegrationMode(process.env.NURSYS_MODE);
}

export function getPecosMode(): IntegrationMode {
  const requestedMode = parseIntegrationMode(process.env.PECOS_MODE);
  if (requestedMode === 'live') {
    log('warn', 'integration_factory_pecos_live_rejected', {
      event: 'integration_factory_pecos_live_rejected',
      reason: 'PECOS is quarterly snapshot data and cannot be used as a real-time authority feed.',
    });
  }
  return 'mock';
}

// ── Provider singletons ─────────────────────────────────────

let _nursysProvider: NursysProvider | null = null;
let _pecosProvider: PecosProvider | null = null;

export function getNursysProvider(): NursysProvider {
  if (_nursysProvider) return _nursysProvider;

  const mode = getNursysMode();

  if (mode === 'live') {
    log('info', 'integration_factory_nursys_live', {
      event: 'integration_factory_nursys_live',
    });
    _nursysProvider = new LiveNursysProvider();
  } else {
    log('info', 'integration_factory_nursys_mock', {
      event: 'integration_factory_nursys_mock',
    });
    _nursysProvider = new MockNursysProvider();
  }

  return _nursysProvider;
}

export function getPecosProvider(): PecosProvider {
  if (_pecosProvider) return _pecosProvider;

  const mode = getPecosMode();
  log('info', 'integration_factory_pecos_mock', {
    event: 'integration_factory_pecos_mock',
    mode,
  });
  _pecosProvider = new MockPecosProvider();

  return _pecosProvider;
}

// ── Reset (for testing) ─────────────────────────────────────

export function resetProviders(): void {
  _nursysProvider = null;
  _pecosProvider = null;
}
