/**
 * Batch Credential Verification
 * Tagged: cursor-batch-1107 (Task 0002)
 * Agent: CODEX • BACKEND • chai-vc-platform
 *
 * Implements multi-credential bundle verification for batched VP
 * Enables bulk verify for ATS ingest with per-item results
 */

import { verifySDJWT, VerificationResult } from './sdjwt-verifier';
import { log } from '../../lib/logging';

// ============================================================================
// TYPES
// ============================================================================

export interface BatchVerificationRequest {
  presentations: Array<{
    id: string; // Unique identifier for this presentation
    credential: string; // SD-JWT credential
    disclosures?: string[]; // Optional selective disclosures
  }>;
  options?: {
    continueOnError?: boolean; // Continue verification if one fails
    parallelism?: number; // Max parallel verifications (default: 5)
  };
}

export interface BatchVerificationResult {
  totalCount: number;
  successCount: number;
  failureCount: number;
  results: Array<{
    id: string;
    status: 'success' | 'error';
    code?: string; // Error code if failed
    message?: string; // Error message if failed
    result?: VerificationResult; // Full result if successful
    duration: number; // Verification time in ms
  }>;
  totalDuration: number; // Total batch verification time in ms
}

// ============================================================================
// ERROR CODES
// ============================================================================

export const BATCH_ERROR_CODES = {
  E_BATCH_EMPTY: 'E_BATCH_EMPTY',
  E_BATCH_TOO_LARGE: 'E_BATCH_TOO_LARGE',
  E_BATCH_INVALID_FORMAT: 'E_BATCH_INVALID_FORMAT',
} as const;

// ============================================================================
// CONFIGURATION
// ============================================================================

const MAX_BATCH_SIZE = 100; // Maximum presentations per batch
const DEFAULT_PARALLELISM = 5; // Default concurrent verifications
const MAX_PARALLELISM = 20; // Maximum allowed parallelism

// ============================================================================
// BATCH VERIFICATION
// ============================================================================

/**
 * Verify multiple credentials in batch
 * Processes presentations with controlled parallelism and per-item error handling
 *
 * @param request - Batch verification request
 * @returns Batch verification results with per-item status
 */
export async function verifyBatch(
  request: BatchVerificationRequest,
): Promise<BatchVerificationResult> {
  const startTime = Date.now();
  const { presentations, options = {} } = request;
  const { continueOnError = true, parallelism = DEFAULT_PARALLELISM } = options;

  // Validate batch
  if (!presentations || presentations.length === 0) {
    throw new Error(BATCH_ERROR_CODES.E_BATCH_EMPTY);
  }

  if (presentations.length > MAX_BATCH_SIZE) {
    throw new Error(
      `${BATCH_ERROR_CODES.E_BATCH_TOO_LARGE}: Maximum ${MAX_BATCH_SIZE} presentations allowed`,
    );
  }

  // Clamp parallelism
  const actualParallelism = Math.min(parallelism, MAX_PARALLELISM);

  log.info('Starting batch verification', {
    totalCount: presentations.length,
    parallelism: actualParallelism,
    continueOnError,
  });

  // Process in chunks with controlled concurrency
  const results: BatchVerificationResult['results'] = [];
  const chunks = chunkArray(presentations, actualParallelism);

  for (const chunk of chunks) {
    const chunkResults = await Promise.all(
      chunk.map(async (presentation) => {
        const itemStart = Date.now();

        try {
          // Verify single presentation
          const result = await verifySinglePresentation(
            presentation.credential,
            presentation.disclosures,
          );

          const duration = Date.now() - itemStart;

          return {
            id: presentation.id,
            status: 'success' as const,
            result,
            duration,
          };
        } catch (error: any) {
          const duration = Date.now() - itemStart;

          log.warn('Batch item verification failed', {
            id: presentation.id,
            error: error.message,
            code: error.code || 'E_VERIFICATION_FAILED',
          });

          // If continueOnError is false, propagate the error
          if (!continueOnError) {
            throw error;
          }

          return {
            id: presentation.id,
            status: 'error' as const,
            code: error.code || 'E_VERIFICATION_FAILED',
            message: error.message,
            duration,
          };
        }
      }),
    );

    results.push(...chunkResults);
  }

  // Compute summary statistics
  const successCount = results.filter((r) => r.status === 'success').length;
  const failureCount = results.filter((r) => r.status === 'error').length;
  const totalDuration = Date.now() - startTime;

  log.info('Batch verification complete', {
    totalCount: results.length,
    successCount,
    failureCount,
    totalDuration,
    avgDuration: totalDuration / results.length,
  });

  return {
    totalCount: results.length,
    successCount,
    failureCount,
    results,
    totalDuration,
  };
}

/**
 * Verify a single presentation (SD-JWT with optional disclosures)
 *
 * @param credential - SD-JWT credential string
 * @param disclosures - Optional selective disclosures
 * @returns Verification result
 */
async function verifySinglePresentation(
  credential: string,
  disclosures?: string[],
): Promise<VerificationResult> {
  // Delegate to existing SD-JWT verifier
  // This assumes sdjwt-verifier.ts exports a verifySDJWT function
  return await verifySDJWT(credential, disclosures);
}

/**
 * Chunk array into smaller arrays of specified size
 */
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

// ============================================================================
// PERFORMANCE METRICS
// ============================================================================

/**
 * Calculate performance metrics for batch verification
 */
export function calculateBatchMetrics(result: BatchVerificationResult) {
  const itemDurations = result.results.map((r) => r.duration);
  const avgDuration = itemDurations.reduce((a, b) => a + b, 0) / itemDurations.length;
  const maxDuration = Math.max(...itemDurations);
  const minDuration = Math.min(...itemDurations);

  // Calculate p95 (95th percentile)
  const sorted = [...itemDurations].sort((a, b) => a - b);
  const p95Index = Math.floor(sorted.length * 0.95);
  const p95Duration = sorted[p95Index] || maxDuration;

  return {
    avgDuration,
    maxDuration,
    minDuration,
    p95Duration,
    totalDuration: result.totalDuration,
    throughput: result.totalCount / (result.totalDuration / 1000), // items per second
  };
}

