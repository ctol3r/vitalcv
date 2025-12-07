export interface SerializedError {
  name: string;
  message: string;
  stack?: string;
  cause?: SerializedError | string;
  details?: Record<string, unknown>;
}

const DEFAULT_STACK_LINES = 15;

function trimStack(stack: string | undefined, maxLines: number): string | undefined {
  if (!stack) {
    return undefined;
  }
  const lines = stack.split('\n');
  if (lines.length <= maxLines) {
    return stack;
  }
  return lines.slice(0, maxLines).join('\n');
}

function serializeUnknownCause(cause: unknown, maxLines: number): SerializedError | string | undefined {
  if (!cause) {
    return undefined;
  }

  if (cause instanceof Error) {
    return serializeError(cause, { maxStackLines: maxLines });
  }

  if (typeof cause === 'object') {
    return JSON.stringify(cause);
  }

  return String(cause);
}

export interface SerializeErrorOptions {
  maxStackLines?: number;
}

export function serializeError(
  error: unknown,
  options: SerializeErrorOptions = {},
): SerializedError {
  const maxStackLines = options.maxStackLines ?? DEFAULT_STACK_LINES;

  if (error instanceof Error) {
    const serialized: SerializedError = {
      name: error.name,
      message: error.message,
      stack: trimStack(error.stack, maxStackLines),
    };

    const cause = (error as Error & { cause?: unknown }).cause;
    if (cause) {
      serialized.cause = serializeUnknownCause(cause, maxStackLines);
    }

    const remainingKeys = Object.getOwnPropertyNames(error).filter(
      (key) => !['name', 'message', 'stack', 'cause'].includes(key),
    );

    if (remainingKeys.length) {
      serialized.details = remainingKeys.reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = (error as Record<string, unknown>)[key];
        return acc;
      }, {});
    }

    return serialized;
  }

  return {
    name: 'Error',
    message: typeof error === 'string' ? error : JSON.stringify(error),
  };
}

