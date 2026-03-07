/**
 * connectorFactory.ts — Wave 127: Connector Mode Factory
 *
 * Selects sandbox or live mode for each provider connector
 * based on environment variables:
 *   - STATE_BOARD_MODE=sandbox|live  (default: sandbox)
 *   - OIG_MODE=sandbox|live          (default: sandbox)
 *   - ABMS_MODE=sandbox|live         (default: sandbox)
 *   - CAQH_MODE=sandbox|live         (default: sandbox)
 *   - NPDB_MODE=sandbox|live         (default: sandbox)
 *
 * Sandbox mode: deterministic results derived from NPI hash — no external calls
 * Live mode: real HTTP/CSV integration with external source
 */

import { log } from '../../../obs/logger';

export type ConnectorMode = 'sandbox' | 'live';
export type ConnectorName = 'STATE_BOARD' | 'OIG' | 'ABMS' | 'CAQH' | 'NPDB';

const ENV_KEYS: Record<ConnectorName, string> = {
  STATE_BOARD: 'STATE_BOARD_MODE',
  OIG: 'OIG_MODE',
  ABMS: 'ABMS_MODE',
  CAQH: 'CAQH_MODE',
  NPDB: 'NPDB_MODE',
};

function parseMode(envValue: string | undefined): ConnectorMode {
  const normalized = envValue?.trim().toLowerCase();
  if (normalized === 'live') return 'live';
  return 'sandbox';
}

export function getConnectorMode(connector: ConnectorName): ConnectorMode {
  return parseMode(process.env[ENV_KEYS[connector]]);
}

export function getAllConnectorModes(): Record<ConnectorName, ConnectorMode> {
  const result = {} as Record<ConnectorName, ConnectorMode>;
  for (const name of Object.keys(ENV_KEYS) as ConnectorName[]) {
    result[name] = getConnectorMode(name);
  }
  return result;
}

/** Reset for tests — clears any cached state. */
export function resetConnectors(): void {
  log('info', 'connector_factory: reset');
}
