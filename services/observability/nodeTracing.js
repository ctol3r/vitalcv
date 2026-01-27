"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startNodeTracing = startNodeTracing;
const tracing_1 = require("../../infra/observability/tracing");
const startedSdks = new Map();
function isTracingDisabled() {
    if (process.env.OTEL_SDK_DISABLED === '1') {
        return true;
    }
    if (process.env.OTEL_TRACING_DISABLED === '1') {
        return true;
    }
    if (process.env.NODE_ENV === 'test') {
        return true;
    }
    return false;
}
function startNodeTracing(options) {
    if (isTracingDisabled()) {
        return null;
    }
    if (startedSdks.has(options.serviceName)) {
        return startedSdks.get(options.serviceName);
    }
    const tracingConfig = {
        serviceName: options.serviceName,
        serviceVersion: options.serviceVersion ||
            process.env.RELEASE ||
            process.env.GIT_SHA ||
            process.env.COMMIT_SHA ||
            'unknown',
        environment: options.environment || process.env.NODE_ENV || 'development',
        otlpEndpoint: options.otlpEndpoint || process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
        additionalInstrumentations: options.instrumentations,
    };
    const sdk = (0, tracing_1.initializeTracing)(tracingConfig);
    startedSdks.set(options.serviceName, sdk);
    return sdk;
}
