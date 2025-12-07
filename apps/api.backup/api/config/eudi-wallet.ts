/**
 * EUDI Wallet Configuration
 * B112B-EUDI-019: Server toggle: Accept EUDI Wallets (hard-enforce)
 *
 * This module provides server-side configuration for EUDI wallet acceptance.
 * When enabled, non-EUDI wallet presentations are blocked with 403 Forbidden
 * and audit reasons are logged.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface EudiWalletConfig {
  /**
   * Accept only EUDI wallets (hard-enforce)
   * When enabled, non-EUDI presentations are blocked with 403 Forbidden
   * Default: false
   */
  acceptEudiWalletsOnly: boolean;

  /**
   * Audit reason template for blocked presentations
   */
  auditReasonTemplate: string;
}

/**
 * Load EUDI wallet configuration from database or environment variables
 */
export async function loadEudiWalletConfig(): Promise<EudiWalletConfig> {
  try {
    // Try to load from database first
    const dbConfig = await prisma.serverConfig.findUnique({
      where: { key: 'eudi_wallet_acceptance' },
    });

    if (dbConfig && dbConfig.value && typeof dbConfig.value === 'object') {
      const value = dbConfig.value as { acceptEudiWalletsOnly?: boolean };
      return {
        acceptEudiWalletsOnly: value.acceptEudiWalletsOnly ?? false,
        auditReasonTemplate: 'Non-EUDI presentation blocked: EUDI-only mode enabled',
      };
    }
  } catch (error) {
    // Fallback to environment variable if database unavailable
    console.warn('Failed to load EUDI config from database, using env var:', error);
  }

  // Fallback to environment variable
  const acceptEudiWalletsOnly = process.env.ACCEPT_EUDI_WALLETS_ONLY === 'true' ||
                                 process.env.ACCEPT_EUDI_WALLETS_ONLY === '1';

  return {
    acceptEudiWalletsOnly,
    auditReasonTemplate: 'Non-EUDI presentation blocked: EUDI-only mode enabled',
  };
}

/**
 * Global configuration instance
 */
let _config: EudiWalletConfig | null = null;
let _configPromise: Promise<EudiWalletConfig> | null = null;

/**
 * Get EUDI wallet configuration (cached)
 */
export async function getEudiWalletConfig(): Promise<EudiWalletConfig> {
  if (!_config) {
    if (!_configPromise) {
      _configPromise = loadEudiWalletConfig();
    }
    _config = await _configPromise;
    _configPromise = null;
  }
  return _config;
}

/**
 * Check if EUDI-only mode is enabled
 */
export async function isEudiOnlyModeEnabled(): Promise<boolean> {
  const config = await getEudiWalletConfig();
  return config.acceptEudiWalletsOnly;
}

/**
 * Reset configuration (for testing)
 */
export function resetEudiWalletConfig(): void {
  _config = null;
  _configPromise = null;
}

/**
 * Update EUDI wallet configuration with database persistence
 */
export async function updateEudiWalletConfig(
  config: Partial<EudiWalletConfig>,
  updatedBy?: string
): Promise<EudiWalletConfig> {
  const currentConfig = await getEudiWalletConfig();
  const newConfig: EudiWalletConfig = {
    ...currentConfig,
    ...config,
  };

  // Persist to database
  try {
    await prisma.serverConfig.upsert({
      where: { key: 'eudi_wallet_acceptance' },
      create: {
        key: 'eudi_wallet_acceptance',
        value: { acceptEudiWalletsOnly: newConfig.acceptEudiWalletsOnly },
        description: 'EUDI wallet acceptance policy (hard-enforce)',
        updatedBy: updatedBy || 'system',
      },
      update: {
        value: { acceptEudiWalletsOnly: newConfig.acceptEudiWalletsOnly },
        updatedBy: updatedBy || 'system',
      },
    });
  } catch (error) {
    console.error('Failed to persist EUDI config to database:', error);
    // Fallback to environment variable
    if (config.acceptEudiWalletsOnly !== undefined) {
      process.env.ACCEPT_EUDI_WALLETS_ONLY = config.acceptEudiWalletsOnly ? 'true' : 'false';
    }
  }

  // Update in-memory cache
  _config = newConfig;

  return newConfig;
}

/**
 * Get audit reason for blocked presentation
 */
export async function getAuditReason(): Promise<string> {
  const config = await getEudiWalletConfig();
  return config.auditReasonTemplate;
}

