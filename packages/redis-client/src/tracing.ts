import { RedisInstrumentation } from '@opentelemetry/instrumentation-redis-4';
import type { RedisInstrumentationConfig } from '@opentelemetry/instrumentation-redis-4';

export function createRedisInstrumentation(
  config: RedisInstrumentationConfig = {}
): RedisInstrumentation {
  return new RedisInstrumentation({
    enabled: true,
    dbStatementSerializer: (cmdName, cmdArgs) => {
      const serialized = [cmdName, ...cmdArgs.map((arg) => String(arg))].join(' ');
      return serialized.length > 256 ? `${serialized.slice(0, 253)}...` : serialized;
    },
    requireParentforOutgoingSpans: false,
    ...config,
  });
}

