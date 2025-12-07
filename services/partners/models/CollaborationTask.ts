/**
 * B248B-PARTNER-015: CollaborationTask model
 *
 * Model for tracking tasks within partnerships.
 */

import { z } from 'zod';

export enum TaskStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  BLOCKED = 'blocked',
  DONE = 'done',
}

export const CollaborationTaskSchema = z.object({
  id: z.string().cuid(),
  partnerId: z.string().min(1, 'Partner ID is required'),
  opportunityId: z.string().cuid().nullable().optional(), // Optional link to opportunity
  title: z.string().min(1, 'Task title is required'),
  description: z.string().nullable().optional(),
  dueDate: z.date().nullable().optional(),
  assignedTo: z.string().cuid().nullable().optional(), // User ID
  status: z.nativeEnum(TaskStatus).default(TaskStatus.OPEN),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const CreateCollaborationTaskSchema = CollaborationTaskSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const UpdateCollaborationTaskSchema = CollaborationTaskSchema.partial().omit({
  id: true,
  partnerId: true,
  createdAt: true,
  updatedAt: true,
});

export type CollaborationTask = z.infer<typeof CollaborationTaskSchema>;
export type CreateCollaborationTask = z.infer<typeof CreateCollaborationTaskSchema>;
export type UpdateCollaborationTask = z.infer<typeof UpdateCollaborationTaskSchema>;

export function validateCollaborationTask(data: unknown): CollaborationTask {
  return CollaborationTaskSchema.parse(data);
}

export function validateCreateCollaborationTask(data: unknown): CreateCollaborationTask {
  return CreateCollaborationTaskSchema.parse(data);
}

export function validateUpdateCollaborationTask(data: unknown): UpdateCollaborationTask {
  return UpdateCollaborationTaskSchema.parse(data);
}

