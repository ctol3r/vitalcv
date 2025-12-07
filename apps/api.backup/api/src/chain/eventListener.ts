/**
 * Chain Event Listener
 * Tasks 201.20, 201.21, 201.38
 *
 * Listens for chain events and processes them
 */

import { PolkadotService } from './PolkadotService';
import { EventRecord } from '@polkadot/types/interfaces';

export interface ChainEvent {
  section: string;
  method: string;
  data: any;
  blockNumber: number;
  timestamp: number;
  txHash?: string;
}

type EventHandler = (event: ChainEvent) => void | Promise<void>;

export class ChainEventListener {
  private polkadotService: PolkadotService;
  private handlers: Map<string, EventHandler[]> = new Map();
  private isListening = false;

  constructor(polkadotService: PolkadotService) {
    this.polkadotService = polkadotService;
  }

  /**
   * Start listening for chain events
   */
  async startListening(): Promise<void> {
    if (this.isListening) {
      console.log('✅ Already listening to chain events');
      return;
    }

    try {
      const api = this.polkadotService.getApi();

      console.log('👂 Starting chain event listener...');

      // Subscribe to new heads
      await api.rpc.chain.subscribeFinalizedHeads(async (header) => {
        const blockNumber = header.number.toNumber();
        const blockHash = header.hash.toHex();

        // Get events for this block
        const events = await api.query.system.events.at(blockHash);

        // Process each event
        for (const record of events) {
          await this.processEvent(record, blockNumber);
        }
      });

      this.isListening = true;
      console.log('✅ Chain event listener started');
    } catch (error) {
      console.error('❌ Failed to start event listener:', error);
      throw error;
    }
  }

  /**
   * Process a single event record
   */
  private async processEvent(record: EventRecord, blockNumber: number): Promise<void> {
    const { event } = record;
    const section = event.section;
    const method = event.method;
    const eventKey = `${section}.${method}`;

    const chainEvent: ChainEvent = {
      section,
      method,
      data: event.data.toJSON(),
      blockNumber,
      timestamp: Date.now(),
    };

    // Call registered handlers
    const handlers = this.handlers.get(eventKey) || [];

    for (const handler of handlers) {
      try {
        await handler(chainEvent);
      } catch (error) {
        console.error(`Error in handler for ${eventKey}:`, error);
      }
    }

    // Also call wildcard handlers
    const wildcardHandlers = this.handlers.get('*') || [];
    for (const handler of wildcardHandlers) {
      try {
        await handler(chainEvent);
      } catch (error) {
        console.error('Error in wildcard handler:', error);
      }
    }
  }

  /**
   * Task 201.20 - Register handler for CredentialIssued event
   */
  onCredentialIssued(handler: EventHandler): void {
    this.on('credentials.CredentialIssued', handler);
  }

  /**
   * Task 201.21 - Register handler for CredentialRevoked event
   */
  onCredentialRevoked(handler: EventHandler): void {
    this.on('credentials.CredentialRevoked', handler);
  }

  /**
   * Register event handler
   */
  on(eventKey: string, handler: EventHandler): void {
    if (!this.handlers.has(eventKey)) {
      this.handlers.set(eventKey, []);
    }

    this.handlers.get(eventKey)!.push(handler);
    console.log(`📝 Registered handler for ${eventKey}`);
  }

  /**
   * Unregister event handler
   */
  off(eventKey: string, handler?: EventHandler): void {
    if (!handler) {
      // Remove all handlers for this event
      this.handlers.delete(eventKey);
      return;
    }

    const handlers = this.handlers.get(eventKey);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Stop listening for events
   */
  stopListening(): void {
    this.isListening = false;
    console.log('🔇 Stopped listening to chain events');
  }

  /**
   * Get listening status
   */
  isActive(): boolean {
    return this.isListening;
  }
}

/**
 * Task 201.20 - Example: Log and store CredentialIssued events
 */
export async function logCredentialIssuedEvent(event: ChainEvent): Promise<void> {
  console.log('📜 CredentialIssued Event:', {
    credentialId: event.data.credentialId || event.data[0],
    issuer: event.data.issuer || event.data[1],
    blockNumber: event.blockNumber,
    timestamp: new Date(event.timestamp).toISOString(),
  });

  // TODO: Store in audit logs table
  // await db.auditLog.create({
  //   eventType: 'CredentialIssued',
  //   credentialId: event.data.credentialId,
  //   blockNumber: event.blockNumber,
  //   timestamp: event.timestamp,
  //   data: event.data,
  // });
}

/**
 * Task 201.21 - Example: Update DB on CredentialRevoked event
 */
export async function updateOnCredentialRevoked(event: ChainEvent): Promise<void> {
  console.log('🚫 CredentialRevoked Event:', {
    credentialId: event.data.credentialId || event.data[0],
    blockNumber: event.blockNumber,
  });

  // TODO: Update credential status in database
  // await db.credential.update({
  //   where: { id: event.data.credentialId },
  //   data: {
  //     status: 'revoked',
  //     revokedAt: new Date(event.timestamp),
  //   },
  // });
}

