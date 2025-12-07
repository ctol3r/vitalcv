/**
 * Chain Health Monitor
 * Tasks 201.32, 201.40, 201.41
 *
 * Monitors chain health and compatibility
 */

import { PolkadotService } from './PolkadotService';
import { ChainHealth } from './types';

export class ChainHealthMonitor {
  private polkadotService: PolkadotService;
  private intervalId: NodeJS.Timeout | null = null;
  private lastHealthStatus: ChainHealth | null = null;

  constructor(polkadotService: PolkadotService) {
    this.polkadotService = polkadotService;
  }

  /**
   * Task 201.32 - Start heartbeat monitoring
   */
  startHeartbeat(intervalMs: number = 30000): void {
    if (this.intervalId) {
      console.log('❌ Heartbeat already running');
      return;
    }

    console.log(`💓 Starting chain heartbeat (${intervalMs}ms interval)...`);

    this.intervalId = setInterval(async () => {
      const health = await this.checkHealth();

      if (!health.connected) {
        console.error('🚨 Chain heartbeat failed - connection lost');
        // TODO: Trigger alert
      }

      if (health.syncing) {
        console.warn('⚠️  Chain is syncing');
      }
    }, intervalMs);
  }

  /**
   * Stop heartbeat monitoring
   */
  stopHeartbeat(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('💔 Stopped chain heartbeat');
    }
  }

  /**
   * Check chain health
   */
  async checkHealth(): Promise<ChainHealth> {
    try {
      const api = this.polkadotService.getApi();

      const health = await api.rpc.system.health();
      const header = await api.rpc.chain.getHeader();

      this.lastHealthStatus = {
        connected: true,
        peers: health.peers.toNumber(),
        syncing: health.isSyncing.isTrue,
        blockNumber: header.number.toNumber(),
        timestamp: Date.now(),
      };

      return this.lastHealthStatus;
    } catch (error) {
      console.error('Health check failed:', error);

      this.lastHealthStatus = {
        connected: false,
        peers: 0,
        syncing: false,
        blockNumber: 0,
        timestamp: Date.now(),
      };

      return this.lastHealthStatus;
    }
  }

  /**
   * Get last health status
   */
  getLastHealth(): ChainHealth | null {
    return this.lastHealthStatus;
  }

  /**
   * Task 201.40 - Check pallet version compatibility
   */
  async checkPalletCompatibility(): Promise<{
    compatible: boolean;
    warnings: string[];
  }> {
    const warnings: string[] = [];

    try {
      const api = this.polkadotService.getApi();
      const metadata = api.runtimeMetadata;

      // Check for required pallets
      const requiredPallets = ['credentials', 'trustRegistry'];

      for (const palletName of requiredPallets) {
        // @ts-ignore
        const pallet = metadata.asLatest.pallets.find(
          (p: any) => p.name.toString().toLowerCase() === palletName.toLowerCase()
        );

        if (!pallet) {
          warnings.push(`Missing required pallet: ${palletName}`);
        }
      }

      // Check runtime version
      const runtimeVersion = api.runtimeVersion;
      const specVersion = runtimeVersion.specVersion.toNumber();

      // Expected minimum version
      const minSpecVersion = 100;

      if (specVersion < minSpecVersion) {
        warnings.push(
          `Runtime spec version ${specVersion} is below minimum ${minSpecVersion}`
        );
      }

      if (warnings.length > 0) {
        console.warn('⚠️  Pallet compatibility warnings:', warnings);
      } else {
        console.log('✅ Pallet compatibility check passed');
      }

      return {
        compatible: warnings.length === 0,
        warnings,
      };
    } catch (error) {
      warnings.push(`Compatibility check failed: ${error}`);
      return {
        compatible: false,
        warnings,
      };
    }
  }

  /**
   * Task 201.41 - Validate chain types alignment
   */
  async checkTypesAlignment(): Promise<{
    aligned: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    try {
      const api = this.polkadotService.getApi();

      // Test type decoding for critical types
      const testTypes = [
        'CredentialId',
        'CredentialHash',
        'CredentialStatus',
      ];

      for (const typeName of testTypes) {
        try {
          // @ts-ignore
          const typeInfo = api.registry.getDefinition(typeName);

          if (!typeInfo) {
            issues.push(`Type ${typeName} not found in registry`);
          }
        } catch (error) {
          issues.push(`Failed to validate type ${typeName}: ${error}`);
        }
      }

      if (issues.length > 0) {
        console.warn('⚠️  Type alignment issues:', issues);
      } else {
        console.log('✅ Types alignment check passed');
      }

      return {
        aligned: issues.length === 0,
        issues,
      };
    } catch (error) {
      issues.push(`Types alignment check failed: ${error}`);
      return {
        aligned: false,
        issues,
      };
    }
  }

  /**
   * Run all startup checks
   */
  async runStartupChecks(): Promise<boolean> {
    console.log('🔍 Running chain startup checks...');

    const compatibility = await this.checkPalletCompatibility();
    const alignment = await this.checkTypesAlignment();

    if (!compatibility.compatible || !alignment.aligned) {
      console.error('❌ Startup checks failed');
      return false;
    }

    console.log('✅ All startup checks passed');
    return true;
  }
}

