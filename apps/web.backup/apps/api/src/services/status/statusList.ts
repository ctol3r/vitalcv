import { EventEmitter } from 'events';
import { createHash } from 'crypto';
import { credentialOfferService } from '../oidc4vci/offer';

export type CredentialStatusCode = 'valid' | 'revoked' | 'suspended' | 'expired' | 'unknown';

interface StatusRecordInternal {
  status: CredentialStatusCode;
  reason?: string;
  updatedAt: number;
  listId: string;
  index: number;
  expiryAt?: number;
  hash: string;
}

export interface CredentialStatusRecord {
  credentialId: string;
  status: CredentialStatusCode;
  reason?: string;
  updatedAt: string;
  statusListId: string;
  statusListCredential: string;
  statusListIndex: number;
  expiresAt?: string;
  credentialHash: string;
}

export interface StatusListSnapshot {
  listId: string;
  encodedList: string;
  updatedAt: string;
  length: number;
  hash: string;
  leafHashes: Record<number, string>;
}

export interface StatusListUpdateEvent {
  credentialId?: string;
  listId: string;
  status?: CredentialStatusCode;
  updatedAt: string;
  expiresAt?: string;
  credentialHash?: string;
}

export const STATUS_LIST_EVENTS = {
  UPDATED: 'UpdatedStatusList',
} as const;

const DEFAULT_STATUS_LIST_ID = 'status-list-1';

class StatusListService extends EventEmitter {
  private readonly records = new Map<string, StatusRecordInternal>();

  markStatus(
    credentialId: string,
    status: CredentialStatusCode,
    options: { reason?: string; index?: number; listId?: string; expiresAt?: Date } = {},
  ): void {
    const index = options.index ?? 0;
    const listId = options.listId ?? DEFAULT_STATUS_LIST_ID;
    const expiryAt = options.expiresAt ? options.expiresAt.getTime() : undefined;
    const credentialHash = options.hash ?? hashCredentialId(credentialId);
    this.records.set(credentialId, {
      status,
      reason: options.reason,
      updatedAt: Date.now(),
      listId,
      index,
      expiryAt,
      hash: credentialHash,
    });

    this.emit(STATUS_LIST_EVENTS.UPDATED, this.buildUpdateEvent(credentialId));
  }

  expireEntries(now = Date.now()): number {
    let expired = 0;
    for (const [credentialId, record] of this.records) {
      if (record.expiryAt && record.expiryAt <= now && record.status !== 'expired') {
        record.status = 'expired';
        record.updatedAt = now;
        expired += 1;
        this.emit(STATUS_LIST_EVENTS.UPDATED, this.buildUpdateEvent(credentialId));
      }
    }
    return expired;
  }

  getStatus(credentialId: string): CredentialStatusRecord {
    const metadata = credentialOfferService.getIssuerMetadata();
    const record = this.records.get(credentialId);
    const status: CredentialStatusCode = record?.status ?? 'valid';

    return {
      credentialId,
      status,
      reason: record?.reason,
      updatedAt: new Date(record?.updatedAt ?? Date.now()).toISOString(),
      statusListId: record?.listId ?? DEFAULT_STATUS_LIST_ID,
      statusListCredential: `${metadata.credential_issuer}/status/${record?.listId ?? DEFAULT_STATUS_LIST_ID}`,
      statusListIndex: record?.index ?? 0,
      expiresAt: record?.expiryAt ? new Date(record.expiryAt).toISOString() : undefined,
      credentialHash: record?.hash ?? hashCredentialId(credentialId),
    };
  }

  isRevoked(credentialId: string): boolean {
    const record = this.records.get(credentialId);
    return record?.status === 'revoked' || record?.status === 'suspended';
  }

  snapshot(listId = DEFAULT_STATUS_LIST_ID): StatusListSnapshot {
    const maxIndex = Math.max(
      0,
      ...[...this.records.values()].filter((record) => record.listId === listId).map((record) => record.index),
    );
    const length = Math.max(256, roundUpToMultiple(maxIndex + 1, 256));
    const bits = new Array(length).fill(false);
    const leafHashes: Record<number, string> = {};

    for (const record of this.records.values()) {
      if (record.listId !== listId) continue;
      bits[record.index] = record.status === 'revoked' || record.status === 'suspended';
      leafHashes[record.index] = record.hash;
    }

    const encodedList = encodeBitset(bits);
    const hash = createHash('sha256').update(encodedList).digest('hex');

    return {
      listId,
      encodedList,
      updatedAt: new Date().toISOString(),
      length,
      hash,
      leafHashes,
    };
  }

  private buildUpdateEvent(credentialId: string): StatusListUpdateEvent {
    const state = this.getStatus(credentialId);
    return {
      credentialId,
      listId: state.statusListId,
      status: state.status,
      updatedAt: state.updatedAt,
      expiresAt: state.expiresAt,
      credentialHash: state.credentialHash,
    };
  }
}

function hashCredentialId(credentialId: string): string {
  return createHash('sha256').update(credentialId).digest('hex');
}

function encodeBitset(bits: boolean[]): string {
  const byteLength = Math.ceil(bits.length / 8);
  const buffer = Buffer.alloc(byteLength);
  bits.forEach((bit, index) => {
    if (bit) {
      const byteIndex = Math.floor(index / 8);
      const bitIndex = 7 - (index % 8);
      buffer[byteIndex] |= 1 << bitIndex;
    }
  });
  return buffer.toString('base64url');
}

function roundUpToMultiple(value: number, multiple: number): number {
  if (value % multiple === 0) return value;
  return value + multiple - (value % multiple);
}

export const statusListService = new StatusListService();


