/**
 * S72-STRETCH-D-003: Schema & storage for embeddings (per clinician & per job)
 *
 * Stores vector embeddings for:
 * - Clinician profiles (specialty, skills, preferences)
 * - Job postings (requirements, description, preferences)
 *
 * Uses pgvector extension for efficient similarity search
 */

import { z } from 'zod';

/**
 * Entity types that can have embeddings
 */
export const EntityTypeSchema = z.enum(['Clinician', 'Job']);

export type EntityType = z.infer<typeof EntityTypeSchema>;

/**
 * Embedding metadata
 */
export interface EmbeddingMetadata {
  model: string; // e.g., 'text-embedding-3-small', 'text-embedding-ada-002'
  dimension: number; // Vector dimension (e.g., 1536 for OpenAI ada-002)
  provider: string; // 'openai', 'vertex', 'stub'
  version: string; // Model version
}

/**
 * Embedding record structure
 */
export interface Embedding {
  id: string;
  entityId: string; // Clinician DID or Job ID
  entityType: EntityType;
  vector: number[]; // Embedding vector
  metadata: EmbeddingMetadata;
  updatedAt: Date;
  createdAt: Date;
}

/**
 * Input for generating embeddings
 */
export interface EmbeddingInput {
  specialty?: string;
  skills?: string[];
  preferences?: Record<string, any>;
  description?: string;
  requirements?: string[];
}

/**
 * Generate text representation for embedding
 */
export function generateEmbeddingText(input: EmbeddingInput): string {
  const parts: string[] = [];

  if (input.specialty) {
    parts.push(`Specialty: ${input.specialty}`);
  }

  if (input.skills && input.skills.length > 0) {
    parts.push(`Skills: ${input.skills.join(', ')}`);
  }

  if (input.description) {
    parts.push(`Description: ${input.description}`);
  }

  if (input.requirements && input.requirements.length > 0) {
    parts.push(`Requirements: ${input.requirements.join(', ')}`);
  }

  if (input.preferences) {
    const prefs = Object.entries(input.preferences)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
    if (prefs) {
      parts.push(`Preferences: ${prefs}`);
    }
  }

  return parts.join('. ');
}

