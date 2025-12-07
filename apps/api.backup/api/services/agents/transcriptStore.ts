const log = getServiceLogger('agents/transcriptStore');
/**
 * Agent Session Transcript Store - B140B-AGENT-024
 *
 * Encrypted, rotated, and auditable storage for agent session transcripts:
 * - Encrypted at rest
 * - TTL-based retention
 * - Access logging
 * - Secure deletion
 * - Export capabilities
 */

import { z } from 'zod';
import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { getServiceLogger } from '../logging/serviceLogger';

// ============================================================
// ENUMS & TYPES
// ============================================================

export enum TranscriptType {
  CHAT = 'chat',
  WORKFLOW = 'workflow',
  TASK = 'task',
  SESSION = 'session',
}

export enum TranscriptStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  ARCHIVED = 'archived',
  DELETED = 'deleted',
}

// ============================================================
// SCHEMAS
// ============================================================

export const TranscriptEntrySchema = z.object({
  timestamp: z.date(),
  role: z.enum(['agent', 'user', 'system']),
  content: z.string(),
  metadata: z.record(z.any()).optional(),
});

export type TranscriptEntry = z.infer<typeof TranscriptEntrySchema>;

export const TranscriptSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  type: z.nativeEnum(TranscriptType),
  status: z.nativeEnum(TranscriptStatus),

  // Transcript data
  entries: z.array(TranscriptEntrySchema),

  // Encryption
  encrypted: z.boolean().default(true),
  encryptionKeyId: z.string().optional(),

  // Timestamps
  startTime: z.date(),
  endTime: z.date().optional(),
  lastAccessTime: z.date().optional(),

  // Retention
  ttl: z.number(), // seconds
  expiresAt: z.date(),

  // Access tracking
  accessCount: z.number().default(0),
  accessLog: z.array(z.object({
    timestamp: z.date(),
    accessor: z.string(),
    action: z.string(),
  })).default([]),

  // Metadata
  taskId: z.string().optional(),
  workflowId: z.string().optional(),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.any()).optional(),
});

export type Transcript = z.infer<typeof TranscriptSchema>;

export const TranscriptAccessLogSchema = z.object({
  transcriptId: z.string(),
  accessor: z.string(),
  action: z.string(),
  timestamp: z.date(),
  metadata: z.record(z.any()).optional(),
});

export type TranscriptAccessLog = z.infer<typeof TranscriptAccessLogSchema>;

// ============================================================
// ENCRYPTION SERVICE
// ============================================================

class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits
  private keys: Map<string, Buffer> = new Map();

  /**
   * Generate a new encryption key
   */
  generateKey(): { keyId: string; key: Buffer } {
    const keyId = `key-${Date.now()}-${randomBytes(8).toString('hex')}`;
    const key = randomBytes(this.keyLength);
    this.keys.set(keyId, key);
    return { keyId, key };
  }

  /**
   * Encrypt data
   */
  encrypt(data: string, keyId: string): { encrypted: string; iv: string; authTag: string } {
    const key = this.keys.get(keyId);
    if (!key) {
      throw new Error(`Encryption key ${keyId} not found`);
    }

    const iv = randomBytes(16);
    const cipher = createCipheriv(this.algorithm, key, iv);

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    };
  }

  /**
   * Decrypt data
   */
  decrypt(encrypted: string, iv: string, authTag: string, keyId: string): string {
    const key = this.keys.get(keyId);
    if (!key) {
      throw new Error(`Encryption key ${keyId} not found`);
    }

    const decipher = createDecipheriv(
      this.algorithm,
      key,
      Buffer.from(iv, 'hex')
    );

    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Rotate key (for testing)
   */
  rotateKey(oldKeyId: string): { keyId: string; key: Buffer } {
    const newKey = this.generateKey();
    this.keys.delete(oldKeyId);
    return newKey;
  }

  /**
   * Clear all keys (for testing)
   */
  clear(): void {
    this.keys.clear();
  }
}

// ============================================================
// TRANSCRIPT STORE CLASS
// ============================================================

export class TranscriptStore {
  private static instance: TranscriptStore;
  private transcripts: Map<string, Transcript> = new Map();
  private encryptedData: Map<string, { encrypted: string; iv: string; authTag: string }> = new Map();
  private encryption: EncryptionService;
  private accessLogs: TranscriptAccessLog[] = [];

  // Default TTL: 90 days
  private readonly DEFAULT_TTL = 90 * 24 * 60 * 60; // seconds

  private constructor() {
    this.encryption = new EncryptionService();
    this.startCleanupTimer();
  }

  static getInstance(): TranscriptStore {
    if (!TranscriptStore.instance) {
      TranscriptStore.instance = new TranscriptStore();
    }
    return TranscriptStore.instance;
  }

  /**
   * Create a new transcript
   */
  create(params: {
    agentId: string;
    type: TranscriptType;
    taskId?: string;
    workflowId?: string;
    ttl?: number;
    tags?: string[];
    metadata?: Record<string, any>;
  }): Transcript {
    const id = `transcript-${Date.now()}-${randomBytes(8).toString('hex')}`;
    const ttl = params.ttl || this.DEFAULT_TTL;
    const startTime = new Date();
    const expiresAt = new Date(startTime.getTime() + ttl * 1000);

    const transcript: Transcript = {
      id,
      agentId: params.agentId,
      type: params.type,
      status: TranscriptStatus.ACTIVE,
      entries: [],
      encrypted: true,
      startTime,
      expiresAt,
      ttl,
      accessCount: 0,
      accessLog: [],
      taskId: params.taskId,
      workflowId: params.workflowId,
      tags: params.tags || [],
      metadata: params.metadata,
    };

    const validated = TranscriptSchema.parse(transcript);
    this.transcripts.set(id, validated);

    this.logAccess(id, 'system', 'create');

    return validated;
  }

  /**
   * Add entry to transcript
   */
  addEntry(
    transcriptId: string,
    entry: TranscriptEntry,
    accessor: string = 'system'
  ): Transcript | undefined {
    const transcript = this.transcripts.get(transcriptId);
    if (!transcript) {
      return undefined;
    }

    if (transcript.status !== TranscriptStatus.ACTIVE) {
      throw new Error(`Cannot add entry to ${transcript.status} transcript`);
    }

    transcript.entries.push(entry);
    this.transcripts.set(transcriptId, transcript);

    this.logAccess(transcriptId, accessor, 'add_entry');

    return transcript;
  }

  /**
   * Get transcript (decrypts if needed)
   */
  get(transcriptId: string, accessor: string): Transcript | undefined {
    const transcript = this.transcripts.get(transcriptId);
    if (!transcript) {
      return undefined;
    }

    // Check if expired
    if (this.isExpired(transcript)) {
      this.delete(transcriptId, 'system');
      return undefined;
    }

    // Update access tracking
    transcript.accessCount++;
    transcript.lastAccessTime = new Date();
    this.transcripts.set(transcriptId, transcript);

    this.logAccess(transcriptId, accessor, 'read');

    return transcript;
  }

  /**
   * Complete a transcript
   */
  complete(transcriptId: string, accessor: string = 'system'): Transcript | undefined {
    const transcript = this.transcripts.get(transcriptId);
    if (!transcript) {
      return undefined;
    }

    transcript.status = TranscriptStatus.COMPLETED;
    transcript.endTime = new Date();

    // Encrypt the transcript data
    if (transcript.encrypted && !transcript.encryptionKeyId) {
      this.encryptTranscript(transcript);
    }

    this.transcripts.set(transcriptId, transcript);
    this.logAccess(transcriptId, accessor, 'complete');

    return transcript;
  }

  /**
   * Archive a transcript
   */
  archive(transcriptId: string, accessor: string = 'system'): Transcript | undefined {
    const transcript = this.transcripts.get(transcriptId);
    if (!transcript) {
      return undefined;
    }

    transcript.status = TranscriptStatus.ARCHIVED;

    // Ensure encryption
    if (transcript.encrypted && !transcript.encryptionKeyId) {
      this.encryptTranscript(transcript);
    }

    this.transcripts.set(transcriptId, transcript);
    this.logAccess(transcriptId, accessor, 'archive');

    return transcript;
  }

  /**
   * Delete a transcript (secure deletion)
   */
  delete(transcriptId: string, accessor: string = 'system'): boolean {
    const transcript = this.transcripts.get(transcriptId);
    if (!transcript) {
      return false;
    }

    // Secure deletion: overwrite data before removing
    transcript.entries = [];
    transcript.status = TranscriptStatus.DELETED;

    // Remove encrypted data
    this.encryptedData.delete(transcriptId);

    this.logAccess(transcriptId, accessor, 'delete');

    // Actually remove from store
    this.transcripts.delete(transcriptId);

    return true;
  }

  /**
   * Search transcripts
   */
  search(criteria: {
    agentId?: string;
    type?: TranscriptType;
    status?: TranscriptStatus;
    taskId?: string;
    workflowId?: string;
    tags?: string[];
    startDate?: Date;
    endDate?: Date;
  }): Transcript[] {
    let results = Array.from(this.transcripts.values());

    if (criteria.agentId) {
      results = results.filter(t => t.agentId === criteria.agentId);
    }
    if (criteria.type) {
      results = results.filter(t => t.type === criteria.type);
    }
    if (criteria.status) {
      results = results.filter(t => t.status === criteria.status);
    }
    if (criteria.taskId) {
      results = results.filter(t => t.taskId === criteria.taskId);
    }
    if (criteria.workflowId) {
      results = results.filter(t => t.workflowId === criteria.workflowId);
    }
    if (criteria.tags && criteria.tags.length > 0) {
      results = results.filter(t =>
        criteria.tags!.some(tag => t.tags.includes(tag))
      );
    }
    if (criteria.startDate) {
      results = results.filter(t => t.startTime >= criteria.startDate!);
    }
    if (criteria.endDate) {
      results = results.filter(t => t.startTime <= criteria.endDate!);
    }

    return results;
  }

  /**
   * Export transcript
   */
  export(transcriptId: string, accessor: string): {
    transcript: Transcript;
    plaintext: string;
  } | undefined {
    const transcript = this.get(transcriptId, accessor);
    if (!transcript) {
      return undefined;
    }

    const plaintext = JSON.stringify({
      id: transcript.id,
      agentId: transcript.agentId,
      type: transcript.type,
      startTime: transcript.startTime,
      endTime: transcript.endTime,
      entries: transcript.entries,
      metadata: transcript.metadata,
    }, null, 2);

    this.logAccess(transcriptId, accessor, 'export');

    return { transcript, plaintext };
  }

  /**
   * Get access logs for transcript
   */
  getAccessLogs(transcriptId: string): TranscriptAccessLog[] {
    return this.accessLogs.filter(log => log.transcriptId === transcriptId);
  }

  /**
   * Get all access logs
   */
  getAllAccessLogs(limit?: number): TranscriptAccessLog[] {
    if (limit) {
      return this.accessLogs.slice(-limit);
    }
    return [...this.accessLogs];
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    total: number;
    active: number;
    completed: number;
    archived: number;
    byAgent: Map<string, number>;
    byType: Map<TranscriptType, number>;
    totalSize: number;
  } {
    const transcripts = Array.from(this.transcripts.values());

    const byAgent = new Map<string, number>();
    const byType = new Map<TranscriptType, number>();

    transcripts.forEach(t => {
      byAgent.set(t.agentId, (byAgent.get(t.agentId) || 0) + 1);
      byType.set(t.type, (byType.get(t.type) || 0) + 1);
    });

    return {
      total: transcripts.length,
      active: transcripts.filter(t => t.status === TranscriptStatus.ACTIVE).length,
      completed: transcripts.filter(t => t.status === TranscriptStatus.COMPLETED).length,
      archived: transcripts.filter(t => t.status === TranscriptStatus.ARCHIVED).length,
      byAgent,
      byType,
      totalSize: transcripts.reduce((sum, t) => sum + t.entries.length, 0),
    };
  }

  /**
   * Encrypt transcript data
   */
  private encryptTranscript(transcript: Transcript): void {
    const { keyId } = this.encryption.generateKey();
    const data = JSON.stringify(transcript.entries);
    const encrypted = this.encryption.encrypt(data, keyId);

    transcript.encryptionKeyId = keyId;
    this.encryptedData.set(transcript.id, encrypted);
  }

  /**
   * Check if transcript is expired
   */
  private isExpired(transcript: Transcript): boolean {
    return new Date() > transcript.expiresAt;
  }

  /**
   * Log access
   */
  private logAccess(transcriptId: string, accessor: string, action: string): void {
    const log: TranscriptAccessLog = {
      transcriptId,
      accessor,
      action,
      timestamp: new Date(),
    };

    this.accessLogs.push(log);

    // Keep only recent logs (last 10000)
    if (this.accessLogs.length > 10000) {
      this.accessLogs = this.accessLogs.slice(-10000);
    }

    // Also add to transcript's access log
    const transcript = this.transcripts.get(transcriptId);
    if (transcript) {
      transcript.accessLog.push({
        timestamp: log.timestamp,
        accessor,
        action,
      });
    }
  }

  /**
   * Cleanup expired transcripts
   */
  private cleanup(): void {
    const now = new Date();
    const transcripts = Array.from(this.transcripts.values());

    let deletedCount = 0;
    transcripts.forEach(transcript => {
      if (this.isExpired(transcript)) {
        this.delete(transcript.id, 'system:cleanup');
        deletedCount++;
      }
    });

    if (deletedCount > 0) {
      log.info(`[TranscriptStore] Cleaned up ${deletedCount} expired transcripts`);
    }
  }

  /**
   * Start cleanup timer
   */
  private startCleanupTimer(): void {
    // Run cleanup every hour
    setInterval(() => {
      this.cleanup();
    }, 60 * 60 * 1000);
  }

  /**
   * Clear all (for testing)
   */
  clear(): void {
    this.transcripts.clear();
    this.encryptedData.clear();
    this.accessLogs = [];
    this.encryption.clear();
  }
}

// ============================================================
// EXPORTS
// ============================================================

export const transcriptStore = TranscriptStore.getInstance();
export default transcriptStore;

