/**
 * B242A-ACC-006: SemanticLabel model
 *
 * Type definitions for semantic labels (ARIA labels and descriptions).
 */

export interface SemanticLabelData {
  id: string;
  componentId: string;
  defaultLabel: string;
  locale: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSemanticLabelInput {
  componentId: string;
  defaultLabel: string;
  locale?: string;
  description?: string;
}

export interface UpdateSemanticLabelInput {
  defaultLabel?: string;
  description?: string;
}

