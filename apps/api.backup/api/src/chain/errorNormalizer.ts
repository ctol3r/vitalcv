/**
 * Chain Result Error Normalizer
 * Task 201.16 - Parse dispatchError, module errors, and decoding issues
 */

import { DispatchError } from '@polkadot/types/interfaces';
import { ApiPromise } from '@polkadot/api';

export interface NormalizedChainError {
  code: string;
  message: string;
  details?: any;
  isRecoverable: boolean;
}

/**
 * Task 201.16 - Normalize chain errors to consistent format
 */
export function normalizeChainError(
  error: any,
  api?: ApiPromise
): NormalizedChainError {
  // Handle DispatchError
  if (error?.isModule && api) {
    return normalizeModuleError(error, api);
  }

  // Handle specific error types
  if (error?.isInvalid) {
    return {
      code: 'INVALID_TRANSACTION',
      message: 'Transaction is invalid',
      isRecoverable: false,
    };
  }

  if (error?.isBadProof) {
    return {
      code: 'BAD_PROOF',
      message: 'Transaction has invalid proof',
      isRecoverable: false,
    };
  }

  if (error?.isCannotLookup) {
    return {
      code: 'CANNOT_LOOKUP',
      message: 'Cannot lookup transaction',
      isRecoverable: false,
    };
  }

  // Handle generic errors
  if (error instanceof Error) {
    return {
      code: 'GENERIC_ERROR',
      message: error.message,
      details: error.stack,
      isRecoverable: false,
    };
  }

  // Handle string errors
  if (typeof error === 'string') {
    return {
      code: 'STRING_ERROR',
      message: error,
      isRecoverable: false,
    };
  }

  // Unknown error format
  return {
    code: 'UNKNOWN_ERROR',
    message: 'An unknown error occurred',
    details: JSON.stringify(error),
    isRecoverable: false,
  };
}

/**
 * Normalize module error (pallet error)
 */
function normalizeModuleError(
  error: DispatchError,
  api: ApiPromise
): NormalizedChainError {
  try {
    const decoded = error.asModule;
    const { docs, name, section } = api.registry.findMetaError(decoded);

    return {
      code: `${section.toUpperCase()}_${name.toUpperCase()}`,
      message: docs.join(' ').trim() || `${section}.${name}`,
      details: {
        section,
        name,
        docs,
      },
      isRecoverable: isRecoverableModuleError(section, name),
    };
  } catch (decodeError) {
    return {
      code: 'MODULE_ERROR_DECODE_FAILED',
      message: 'Failed to decode module error',
      details: { originalError: error.toString(), decodeError },
      isRecoverable: false,
    };
  }
}

/**
 * Determine if a module error is recoverable
 */
function isRecoverableModuleError(section: string, name: string): boolean {
  const recoverableErrors = [
    'system.ExtrinsicFailed',
    'balances.InsufficientBalance',
    'credentials.AlreadyIssued',
    'credentials.NotFound',
  ];

  const errorKey = `${section}.${name}`;
  return recoverableErrors.includes(errorKey);
}

/**
 * Check if error indicates connection issue
 */
export function isConnectionError(error: any): boolean {
  const message = error?.message || error?.toString() || '';
  const connectionKeywords = [
    'connection',
    'disconnect',
    'timeout',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'network',
  ];

  return connectionKeywords.some(keyword =>
    message.toLowerCase().includes(keyword.toLowerCase())
  );
}

/**
 * Check if error indicates insufficient balance
 */
export function isInsufficientBalanceError(error: NormalizedChainError): boolean {
  return error.code === 'BALANCES_INSUFFICIENTBALANCE';
}

/**
 * Check if credential already anchored
 */
export function isAlreadyAnchoredError(error: NormalizedChainError): boolean {
  return error.code === 'CREDENTIALS_ALREADYISSUED';
}

/**
 * Format error for logging
 */
export function formatErrorForLog(error: NormalizedChainError): string {
  let log = `[${error.code}] ${error.message}`;

  if (error.details) {
    log += `\nDetails: ${JSON.stringify(error.details, null, 2)}`;
  }

  return log;
}

