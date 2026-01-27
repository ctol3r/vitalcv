import type { InstrumentationOption } from '@opentelemetry/instrumentation';
import type { NodeSDK } from '@opentelemetry/sdk-node';
export interface NodeTracingOptions {
    serviceName: string;
    serviceVersion?: string;
    environment?: string;
    instrumentations?: InstrumentationOption[];
    otlpEndpoint?: string;
}
export declare function startNodeTracing(options: NodeTracingOptions): NodeSDK | null;
