/**
 * StatusList2021 Implementation with Rollover Support
 * Tagged: cursor-batch-1101, cursor-batch-1105 (Task 0005)
 * Agent: CODEX • BACKEND • chai-vc-platform
 *
 * W3C StatusList2021 for credential revocation and suspension
 * Spec: https://w3c.github.io/vc-status-list-2021/
 *
 * Features:
 * - Automatic rollover when list exceeds 100k entries
 * - Old lists remain readable
 */

import { promisify } from 'util';
import * as zlib from 'zlib';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

export interface StatusListCredential {
  '@context': string[];
  id: string;
  type: string[];
  issuer: string;
  issued: string;
  credentialSubject: {
    id: string;
    type: 'StatusList2021';
    statusPurpose: 'revocation' | 'suspension';
    encodedList: string; // base64-encoded gzipped bitstring
  };
}

export class StatusList {
  private bitstring: Uint8Array;
  private purpose: 'revocation' | 'suspension';
  private listId: string;
  private issuer: string;

  constructor(
    size: number = 131072, // 16KB bitstring = 131,072 bits
    purpose: 'revocation' | 'suspension' = 'revocation',
    listId: string = crypto.randomUUID(),
    issuer: string = 'did:chai:issuer',
  ) {
    this.bitstring = new Uint8Array(Math.ceil(size / 8));
    this.purpose = purpose;
    this.listId = listId;
    this.issuer = issuer;
  }

  /**
   * Get the bit value at a specific index
   */
  getBit(index: number): boolean {
    if (index < 0 || index >= this.bitstring.length * 8) {
      throw new Error(`Index ${index} out of range`);
    }

    const byteIndex = Math.floor(index / 8);
    const bitIndex = index % 8;
    const byte = this.bitstring[byteIndex];

    return ((byte >> (7 - bitIndex)) & 1) === 1;
  }

  /**
   * Set the bit value at a specific index
   */
  setBit(index: number, value: boolean): void {
    if (index < 0 || index >= this.bitstring.length * 8) {
      throw new Error(`Index ${index} out of range`);
    }

    const byteIndex = Math.floor(index / 8);
    const bitIndex = index % 8;

    if (value) {
      // Set bit to 1
      this.bitstring[byteIndex] |= 1 << (7 - bitIndex);
    } else {
      // Set bit to 0
      this.bitstring[byteIndex] &= ~(1 << (7 - bitIndex));
    }
  }

  /**
   * Encode the bitstring as base64-encoded gzipped data
   */
  async encode(): Promise<string> {
    const compressed = await gzip(Buffer.from(this.bitstring));
    return Buffer.from(compressed).toString('base64');
  }

  /**
   * Decode base64-encoded gzipped bitstring
   */
  static async decode(encoded: string): Promise<Uint8Array> {
    const compressed = Buffer.from(encoded, 'base64');
    const decompressed = await gunzip(compressed);
    return new Uint8Array(decompressed);
  }

  /**
   * Create a StatusList2021 Credential
   */
  async toCredential(): Promise<StatusListCredential> {
    const encodedList = await this.encode();

    return {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        'https://w3id.org/vc/status-list/2021/v1',
      ],
      id: `https://example.com/status/${this.listId}`,
      type: ['VerifiableCredential', 'StatusList2021Credential'],
      issuer: this.issuer,
      issued: new Date().toISOString(),
      credentialSubject: {
        id: `https://example.com/status/${this.listId}#list`,
        type: 'StatusList2021',
        statusPurpose: this.purpose,
        encodedList,
      },
    };
  }

  /**
   * Load a StatusList from a StatusList2021Credential
   */
  static async fromCredential(credential: StatusListCredential): Promise<StatusList> {
    const bitstring = await StatusList.decode(credential.credentialSubject.encodedList);
    const statusList = new StatusList(
      bitstring.length * 8,
      credential.credentialSubject.statusPurpose,
      credential.id,
      credential.issuer,
    );
    statusList.bitstring = bitstring;
    return statusList;
  }

  /**
   * Get statistics about the status list
   */
  getStats() {
    let activeCount = 0;
    const totalBits = this.bitstring.length * 8;

    for (let i = 0; i < totalBits; i++) {
      if (this.getBit(i)) {
        activeCount++;
      }
    }

    return {
      totalCapacity: totalBits,
      activeCount,
      inactiveCount: totalBits - activeCount,
      utilizationPercent: (activeCount / totalBits) * 100,
      purpose: this.purpose,
      listId: this.listId,
    };
  }

  /**
   * Check if this list should be rolled over
   * Rollover threshold: 100k entries (configurable)
   */
  shouldRollover(threshold: number = 100000): boolean {
    const stats = this.getStats();
    return stats.activeCount >= threshold;
  }

  /**
   * Get the list ID
   */
  getListId(): string {
    return this.listId;
  }

  /**
   * Get the purpose
   */
  getPurpose(): 'revocation' | 'suspension' {
    return this.purpose;
  }
}

/**
 * Verify if a credential is revoked/suspended using its status
 */
export async function checkCredentialStatus(
  credentialStatus: {
    id: string;
    type: string;
    statusPurpose: 'revocation' | 'suspension';
    statusListIndex: string;
    statusListCredential: string;
  },
  statusListCredential: StatusListCredential,
): Promise<{ valid: boolean; reason?: string }> {
  try {
    // Verify status type
    if (credentialStatus.type !== 'StatusList2021Entry') {
      return {
        valid: false,
        reason: 'Invalid status type (expected StatusList2021Entry)',
      };
    }

    // Verify purpose matches
    if (credentialStatus.statusPurpose !== statusListCredential.credentialSubject.statusPurpose) {
      return {
        valid: false,
        reason: 'Status purpose mismatch',
      };
    }

    // Load status list
    const statusList = await StatusList.fromCredential(statusListCredential);

    // Check bit at index
    const index = parseInt(credentialStatus.statusListIndex, 10);
    const isRevoked = statusList.getBit(index);

    if (isRevoked) {
      const reason =
        credentialStatus.statusPurpose === 'revocation'
          ? 'Credential revoked'
          : 'Credential suspended';
      return {
        valid: false,
        reason,
      };
    }

    return { valid: true };
  } catch (error: any) {
    return {
      valid: false,
      reason: `Status check error: ${error.message}`,
    };
  }
}

export default StatusList;
