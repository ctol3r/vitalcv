/**
 * Polkadot Service - Substrate Connection Management
 * Tasks 201.2, 201.3, 201.6, 201.7, 201.8
 *
 * Singleton service for managing Substrate API connection with:
 * - Auto-reconnect on disconnect
 * - Exponential backoff retry logic
 * - Connection health monitoring
 * - Chain metadata logging
 */

import { ApiPromise, WsProvider } from '@polkadot/api';
import { VITALCV_TYPES, ChainMetadata } from './types';

interface ConnectionConfig {
  wsUrl: string;
  retryAttempts?: number;
  retryDelay?: number;
  maxRetryDelay?: number;
  reconnectOnDisconnect?: boolean;
}

export class PolkadotService {
  private static instance: PolkadotService;
  private api: ApiPromise | null = null;
  private provider: WsProvider | null = null;
  private config: ConnectionConfig;
  private _isConnected = false;
  private connectionAttempts = 0;
  private reconnecting = false;
  private metadata: ChainMetadata | null = null;

  private constructor(config: ConnectionConfig) {
    this.config = {
      retryAttempts: 5,
      retryDelay: 1000,
      maxRetryDelay: 30000,
      reconnectOnDisconnect: true,
      ...config
    };
  }

  static getInstance(config?: ConnectionConfig): PolkadotService {
    if (!PolkadotService.instance && config) {
      PolkadotService.instance = new PolkadotService(config);
    }
    return PolkadotService.instance;
  }

  /**
   * Task 201.3 - Initialize and connect to Substrate chain
   */
  async connect(): Promise<void> {
    if (this._isConnected && this.api) {
      console.log('✅ Already connected to Substrate chain');
      return;
    }

    console.log(`🔗 Connecting to Substrate chain at ${this.config.wsUrl}...`);

    try {
      await this.attemptConnection();
    } catch (error) {
      console.error('❌ Initial connection failed:', error);
      if (this.config.retryAttempts! > 0) {
        await this.retryConnection();
      } else {
        throw error;
      }
    }
  }

  /**
   * Task 201.6 - Exponential backoff retry logic
   */
  private async retryConnection(): Promise<void> {
    while (this.connectionAttempts < this.config.retryAttempts!) {
      this.connectionAttempts++;

      const delay = Math.min(
        this.config.retryDelay! * Math.pow(2, this.connectionAttempts - 1),
        this.config.maxRetryDelay!
      );

      console.log(
        `🔄 Retry attempt ${this.connectionAttempts}/${this.config.retryAttempts} in ${delay}ms...`
      );

      await this.sleep(delay);

      try {
        await this.attemptConnection();
        this.connectionAttempts = 0; // Reset on success
        return;
      } catch (error) {
        console.error(`❌ Retry ${this.connectionAttempts} failed:`, error);

        if (this.connectionAttempts >= this.config.retryAttempts!) {
          throw new Error(
            `Failed to connect after ${this.config.retryAttempts} attempts`
          );
        }
      }
    }
  }

  /**
   * Task 201.2 - Create ApiPromise connection
   */
  private async attemptConnection(): Promise<void> {
    this.provider = new WsProvider(this.config.wsUrl);

    this.api = await ApiPromise.create({
      provider: this.provider,
      types: VITALCV_TYPES
    });

    // Task 201.7 - Setup auto-reconnect listener
    this.setupReconnectListener();

    // Task 201.8 - Log chain metadata
    await this.logChainMetadata();

    this._isConnected = true;
    console.log('✅ Successfully connected to Substrate chain');
  }

  /**
   * Task 201.7 - Auto-reconnect on disconnect
   */
  private setupReconnectListener(): void {
    if (!this.provider) return;

    this.provider.on('disconnected', async () => {
      console.warn('⚠️  Substrate connection lost');
      this._isConnected = false;

      if (this.config.reconnectOnDisconnect && !this.reconnecting) {
        this.reconnecting = true;
        console.log('🔄 Attempting to reconnect...');

        try {
          await this.retryConnection();
          this.reconnecting = false;
        } catch (error) {
          console.error('❌ Reconnection failed:', error);
          this.reconnecting = false;
        }
      }
    });

    this.provider.on('connected', () => {
      console.log('✅ Substrate connection established');
      this._isConnected = true;
    });

    this.provider.on('error', (error) => {
      console.error('❌ Substrate connection error:', error);
    });
  }

  /**
   * Task 201.8 - Log chain metadata on connection
   */
  private async logChainMetadata(): Promise<void> {
    if (!this.api) return;

    const chain = await this.api.rpc.system.chain();
    const version = await this.api.rpc.system.version();
    const genesisHash = this.api.genesisHash.toHex();
    const runtimeVersion = this.api.runtimeVersion;

    this.metadata = {
      chainName: chain.toString(),
      genesisHash,
      runtimeVersion: {
        specName: runtimeVersion.specName.toString(),
        specVersion: runtimeVersion.specVersion.toNumber(),
        transactionVersion: runtimeVersion.transactionVersion.toNumber()
      }
    };

    console.log('📋 Chain Metadata:');
    console.log(`   Chain: ${this.metadata.chainName}`);
    console.log(`   Genesis Hash: ${this.metadata.genesisHash}`);
    console.log(`   Runtime: ${this.metadata.runtimeVersion.specName} v${this.metadata.runtimeVersion.specVersion}`);
    console.log(`   Node Version: ${version.toString()}`);
  }

  /**
   * Task 201.3 - Get API instance
   */
  getApi(): ApiPromise {
    if (!this.api || !this._isConnected) {
      throw new Error('Substrate API not connected. Call connect() first.');
    }
    return this.api;
  }

  /**
   * Task 201.3 - Check connection status
   */
  isConnected(): boolean {
    return this._isConnected && this.api !== null;
  }

  /**
   * Get chain metadata
   */
  getMetadata(): ChainMetadata | null {
    return this.metadata;
  }

  /**
   * Disconnect from chain
   */
  async disconnect(): Promise<void> {
    if (this.api) {
      await this.api.disconnect();
      this.api = null;
      this._isConnected = false;
      console.log('🔌 Disconnected from Substrate chain');
    }
  }

  /**
   * Test connection with lightweight RPC call
   */
  async testConnection(): Promise<boolean> {
    try {
      if (!this.api) return false;
      const health = await this.api.rpc.system.health();
      return health.peers.toNumber() >= 0;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Reset singleton (for testing)
   */
  static reset(): void {
    if (PolkadotService.instance) {
      PolkadotService.instance.disconnect();
      // @ts-ignore
      PolkadotService.instance = null;
    }
  }
}

