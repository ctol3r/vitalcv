/**
 * B169B-REV-001: RevalidationTask model & validation schema
 */

import { z } from 'zod';

export enum RevalidationTaskType {
  PECOS = 'PECOS',
  MEDICAID = 'MEDICAID',
  PAYER = 'PAYER',
  CREDENTIALING = 'CREDENTIALING',
}

export enum RevalidationTaskStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  OVERDUE = 'OVERDUE',
}

export enum RevalidationTaskSource {
  SYSTEM = 'SYSTEM',
  USER = 'USER',
  INTEGRATION = 'INTEGRATION',
  IMPORT = 'IMPORT',
}

export interface RevalidationTaskMetadata {
  category?: 'PECOS' | 'STATE_LICENSE' | 'DEA' | 'BOARD' | 'MEDICAID' | 'PAYER' | 'CREDENTIALING';
  referenceId?: string;
  payerName?: string;
  state?: string;
  specialty?: string;
  evidenceUrl?: string;
  details?: Record<string, unknown>;
}

export interface RevalidationTask {
  id: string;
  clinicianId: string;
  type: RevalidationTaskType;
  dueDate: Date;
  status: RevalidationTaskStatus;
  source: RevalidationTaskSource;
  notes?: string | null;
  metadata?: RevalidationTaskMetadata | null;
  completedAt?: Date | null;
  lastNotifiedAt?: Date | null;
  notificationCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export const CreateRevalidationTaskSchema = z.object({
  clinicianId: z.string().min(1),
  type: z.nativeEnum(RevalidationTaskType),
  dueDate: z.date(),
  status: z.nativeEnum(RevalidationTaskStatus).default(RevalidationTaskStatus.OPEN),
  source: z.nativeEnum(RevalidationTaskSource).default(RevalidationTaskSource.SYSTEM),
  notes: z.string().max(2000).optional(),
  metadata: z
    .object({
      category: z
        .enum(['PECOS', 'STATE_LICENSE', 'DEA', 'BOARD', 'MEDICAID', 'PAYER', 'CREDENTIALING'])
        .optional(),
      referenceId: z.string().optional(),
      payerName: z.string().optional(),
      state: z.string().optional(),
      specialty: z.string().optional(),
      evidenceUrl: z.string().url().optional(),
      details: z.record(z.any()).optional(),
    })
    .optional(),
});

export type CreateRevalidationTaskInput = z.infer<typeof CreateRevalidationTaskSchema>;

export const UpdateRevalidationTaskSchema = CreateRevalidationTaskSchema.partial().extend({
  completedAt: z.date().nullable().optional(),
  lastNotifiedAt: z.date().nullable().optional(),
  notificationCount: z.number().int().nonnegative().optional(),
});

export type UpdateRevalidationTaskInput = z.infer<typeof UpdateRevalidationTaskSchema>;

export interface RevalidationTaskFilters {
  clinicianId?: string;
  status?: RevalidationTaskStatus | RevalidationTaskStatus[];
  type?: RevalidationTaskType | RevalidationTaskType[];
  dueBefore?: Date;
  dueAfter?: Date;
  includeCompleted?: boolean;
}

export const NOTIFICATION_WINDOW_DAYS = 30;
export const NOTIFICATION_COOLDOWN_HOURS = 20;
