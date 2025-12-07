const log = getServiceLogger('matching/embeddings');
/**
 * S72-STRETCH-D-002: Embedding provider integration (OpenAI/Vertex) for job & clinician profiles
 *
 * Functions:
 * - embedProfile(input: {specialty, skills, preferences}) → vector<number[]>
 * - Handles retries
 * - Caches embeddings in DB
 * - Tests with stub provider
 */

import { PrismaClient } from '@prisma/client';
import {
import { getServiceLogger } from '../logging/serviceLogger';
  EmbeddingInput,
  generateEmbeddingText,
  EmbeddingMetadata,
  EntityType,
} from './models/Embeddings';

const prisma = new PrismaClient();

/**
 * Embedding provider interface
 */
export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
  getMetadata(): EmbeddingMetadata;
}

/**
 * Stub embedding provider for testing
 */
export class StubEmbeddingProvider implements EmbeddingProvider {
  private dimension: number;

  constructor(dimension: number = 1536) {
    this.dimension = dimension;
  }

  async embed(text: string): Promise<number[]> {
    // Generate deterministic "fake" embedding based on text hash
    const hash = this.simpleHash(text);
    const vector: number[] = [];
    for (let i = 0; i < this.dimension; i++) {
      // Generate pseudo-random but deterministic values
      const seed = (hash + i) % 1000000;
      vector.push((seed / 1000000) * 2 - 1); // Normalize to [-1, 1]
    }
    // Normalize vector
    const magnitude = Math.sqrt(
      vector.reduce((sum, val) => sum + val * val, 0)
    );
    return vector.map((val) => val / magnitude);
  }

  getMetadata(): EmbeddingMetadata {
    return {
      model: 'stub-embedding-v1',
      dimension: this.dimension,
      provider: 'stub',
      version: '1.0.0',
    };
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}

/**
 * OpenAI embedding provider
 */
export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  private apiKey: string;
  private model: string;
  private dimension: number;

  constructor(
    apiKey: string,
    model: string = 'text-embedding-3-small',
    dimension: number = 1536
  ) {
    this.apiKey = apiKey;
    this.model = model;
    this.dimension = dimension;
  }

  async embed(text: string, retries: number = 3): Promise<number[]> {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const response = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.model,
            input: text,
          }),
        });

        if (!response.ok) {
          if (response.status === 429 && attempt < retries - 1) {
            // Rate limit - wait and retry
            await this.delay(Math.pow(2, attempt) * 1000);
            continue;
          }
          throw new Error(
            `OpenAI API error: ${response.status} ${response.statusText}`
          );
        }

        const data = await response.json();
        return data.data[0].embedding;
      } catch (error) {
        if (attempt === retries - 1) {
          throw error;
        }
        await this.delay(Math.pow(2, attempt) * 1000);
      }
    }
    throw new Error('Failed to get embedding after retries');
  }

  getMetadata(): EmbeddingMetadata {
    return {
      model: this.model,
      dimension: this.dimension,
      provider: 'openai',
      version: '1.0.0',
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Vertex AI embedding provider (Google Cloud)
 */
export class VertexEmbeddingProvider implements EmbeddingProvider {
  private projectId: string;
  private location: string;
  private model: string;
  private dimension: number;

  constructor(
    projectId: string,
    location: string = 'us-central1',
    model: string = 'textembedding-gecko@003',
    dimension: number = 768
  ) {
    this.projectId = projectId;
    this.location = location;
    this.model = model;
    this.dimension = dimension;
  }

  async embed(text: string, retries: number = 3): Promise<number[]> {
    // Note: This is a placeholder. Real implementation would use
    // Google Cloud Vertex AI SDK
    throw new Error('Vertex AI provider not yet implemented');
  }

  getMetadata(): EmbeddingMetadata {
    return {
      model: this.model,
      dimension: this.dimension,
      provider: 'vertex',
      version: '1.0.0',
    };
  }
}

/**
 * Get embedding provider based on environment
 */
export function getEmbeddingProvider(): EmbeddingProvider {
  const provider = process.env.EMBEDDING_PROVIDER || 'stub';

  if (provider === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      log.warn('OPENAI_API_KEY not set, falling back to stub provider');
      return new StubEmbeddingProvider();
    }
    return new OpenAIEmbeddingProvider(apiKey);
  }

  if (provider === 'vertex') {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    if (!projectId) {
      log.warn(
        'GOOGLE_CLOUD_PROJECT_ID not set, falling back to stub provider'
      );
      return new StubEmbeddingProvider();
    }
    return new VertexEmbeddingProvider(projectId);
  }

  // Default to stub
  return new StubEmbeddingProvider();
}

/**
 * Embed a profile (clinician or job) and cache in database
 */
export async function embedProfile(
  input: EmbeddingInput,
  entityId: string,
  entityType: EntityType,
  forceRefresh: boolean = false
): Promise<number[]> {
  // Check cache first
  if (!forceRefresh) {
    const cached = await prisma.embedding.findUnique({
      where: {
        entityId_entityType: {
          entityId,
          entityType,
        },
      },
    });

    if (cached) {
      // Check if cache is still valid (e.g., less than 30 days old)
      const cacheAge = Date.now() - cached.updatedAt.getTime();
      const maxCacheAge = 30 * 24 * 60 * 60 * 1000; // 30 days

      if (cacheAge < maxCacheAge) {
        return cached.vector as number[];
      }
    }
  }

  // Generate embedding
  const provider = getEmbeddingProvider();
  const text = generateEmbeddingText(input);
  const vector = await provider.embed(text);
  const metadata = provider.getMetadata();

  // Store in database
  await prisma.embedding.upsert({
    where: {
      entityId_entityType: {
        entityId,
        entityType,
      },
    },
    create: {
      entityId,
      entityType,
      vector,
      metadata,
    },
    update: {
      vector,
      metadata,
      updatedAt: new Date(),
    },
  });

  return vector;
}

/**
 * Get cached embedding for an entity
 */
export async function getCachedEmbedding(
  entityId: string,
  entityType: EntityType
): Promise<number[] | null> {
  const cached = await prisma.embedding.findUnique({
    where: {
      entityId_entityType: {
        entityId,
        entityType,
      },
    },
  });

  if (!cached) {
    return null;
  }

  return cached.vector as number[];
}

/**
 * Batch embed multiple profiles
 */
export async function batchEmbedProfiles(
  inputs: Array<{ input: EmbeddingInput; entityId: string; entityType: EntityType }>
): Promise<Map<string, number[]>> {
  const results = new Map<string, number[]>();

  // Process in parallel (with rate limiting consideration)
  const batchSize = 10;
  for (let i = 0; i < inputs.length; i += batchSize) {
    const batch = inputs.slice(i, i + batchSize);
    const promises = batch.map(({ input, entityId, entityType }) =>
      embedProfile(input, entityId, entityType)
    );
    const vectors = await Promise.all(promises);

    batch.forEach(({ entityId }, index) => {
      results.set(entityId, vectors[index]);
    });

    // Small delay between batches to avoid rate limits
    if (i + batchSize < inputs.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return results;
}

