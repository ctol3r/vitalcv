"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRedisInstrumentation = createRedisInstrumentation;
const instrumentation_redis_4_1 = require("@opentelemetry/instrumentation-redis-4");
function createRedisInstrumentation(config = {}) {
    return new instrumentation_redis_4_1.RedisInstrumentation({
        enabled: true,
        dbStatementSerializer: (cmdName, cmdArgs) => {
            const serialized = [cmdName, ...cmdArgs.map((arg) => String(arg))].join(' ');
            return serialized.length > 256 ? `${serialized.slice(0, 253)}...` : serialized;
        },
        requireParentforOutgoingSpans: false,
        ...config,
    });
}
