import { serializeError } from '@chai-vc/logging-core';

export interface FormattedQueueError {
  name: string;
  message: string;
  stack?: string;
  type: string;
}

function getErrorType(error: unknown): string {
  if (error instanceof Error) {
    return error.constructor.name || 'Error';
  }

  if (typeof error === 'object' && error !== null) {
    const ctorName = (error as Record<string, unknown>).constructor?.name;
    if (typeof ctorName === 'string' && ctorName.length) {
      return ctorName;
    }
    return 'Object';
  }

  return typeof error;
}

export function formatHandlerError(error: unknown): FormattedQueueError {
  const serialized = serializeError(error);

  return {
    name: serialized.name,
    message: serialized.message,
    stack: serialized.stack,
    type: getErrorType(error),
  };
}

