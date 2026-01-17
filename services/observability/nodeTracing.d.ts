import type { Instrumentation } from '@opentelemetry/instrumentation';
import type { NodeSDK } from '@opentelemetry/sdk-node';
export interface NodeTracingOptions {
  serviceName: string;
  serviceVersion?: string;
  environment?: string;
  instrumentations?: Instrumentation[];
  otlpEndpoint?: string;
}
export declare function startNodeTracing(options: NodeTracingOptions): NodeSDK | null;
