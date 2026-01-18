/**
 * Domain Credentials - Trust Infrastructure
 *
 * Pure TypeScript domain logic for credential validity checking.
 *
 * PRINCIPLES:
 * - Revocation-first: Always check revocation before temporal validity
 * - Time-bound truth: All validity is relative to evaluation time
 * - Pure functions: No side effects, no network calls
 * - Fail loudly: Throw errors on ambiguity
 */

// Core Types
export * from './types';

// Revocation Logic
export * from './revocation';

// Freshness & Temporal Logic
export * from './freshness';

// Validity Checking (combines revocation + temporal + freshness)
export * from './validity';
