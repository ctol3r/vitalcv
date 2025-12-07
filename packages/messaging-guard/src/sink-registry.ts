/**
 * B95B-SEC-001: Sink ID Registry
 *
 * Centralized registry of all sink IDs used across the platform.
 * Sink IDs follow the pattern: {type}.{service-name}
 *
 * Types:
 * - svc.* - Microservice endpoints
 * - etl.* - ETL/transformation services
 * - job.* - Background job processors
 * - db.* - Database sinks
 * - queue.* - Message queue sinks
 */

export interface SinkRegistryEntry {
  /** Sink ID */
  id: string;
  /** Human-readable description */
  description: string;
  /** Service type */
  type: 'svc' | 'etl' | 'job' | 'db' | 'queue';
  /** Environment availability */
  environments: ('development' | 'staging' | 'production')[];
  /** Owner team/service */
  owner: string;
  /** Related documentation */
  docs?: string;
}

/**
 * Official sink ID registry
 */
export const SINK_REGISTRY: SinkRegistryEntry[] = [
  {
    id: 'svc.issuer-api',
    description: 'OIDC4VCI issuer service for credential issuance',
    type: 'svc',
    environments: ['development', 'staging', 'production'],
    owner: 'identity-team',
    docs: 'https://docs.vitalcv.com/services/issuer-api',
  },
  {
    id: 'svc.verifier-api',
    description: 'OIDC4VP verifier service for credential verification',
    type: 'svc',
    environments: ['development', 'staging', 'production'],
    owner: 'identity-team',
    docs: 'https://docs.vitalcv.com/services/verifier-api',
  },
  {
    id: 'svc.trust-registry',
    description: 'Trust registry service for DID and issuer management',
    type: 'svc',
    environments: ['development', 'staging', 'production'],
    owner: 'identity-team',
    docs: 'https://docs.vitalcv.com/services/trust-registry',
  },
  {
    id: 'svc.audit-log',
    description: 'Audit logging service for compliance and audit trails',
    type: 'svc',
    environments: ['development', 'staging', 'production'],
    owner: 'security-team',
    docs: 'https://docs.vitalcv.com/services/audit-log',
  },
  {
    id: 'svc.compliance-api',
    description: 'Compliance API for NCQA and regulatory reporting',
    type: 'svc',
    environments: ['development', 'staging', 'production'],
    owner: 'compliance-team',
    docs: 'https://docs.vitalcv.com/services/compliance-api',
  },
  {
    id: 'svc.privileges-api',
    description: 'Privileging API for ABAC and role-based access',
    type: 'svc',
    environments: ['development', 'staging', 'production'],
    owner: 'security-team',
    docs: 'https://docs.vitalcv.com/services/privileges-api',
  },
  {
    id: 'svc.router',
    description: 'Message router service for inter-service communication',
    type: 'svc',
    environments: ['development', 'staging', 'production'],
    owner: 'platform-team',
    docs: 'https://docs.vitalcv.com/services/router',
  },
  {
    id: 'etl.fhir-gateway',
    description: 'FHIR gateway ETL service for healthcare data transformation',
    type: 'etl',
    environments: ['development', 'staging', 'production'],
    owner: 'data-team',
    docs: 'https://docs.vitalcv.com/services/fhir-gateway',
  },
  {
    id: 'job.psv',
    description: 'Professional Services Verification background job processor',
    type: 'job',
    environments: ['development', 'staging', 'production'],
    owner: 'compliance-team',
    docs: 'https://docs.vitalcv.com/jobs/psv',
  },
  {
    id: 'queue.dlq',
    description: 'Dead-letter queue for failed message processing',
    type: 'queue',
    environments: ['development', 'staging', 'production'],
    owner: 'platform-team',
    docs: 'https://docs.vitalcv.com/queues/dlq',
  },
];

/**
 * Get sink registry entry by ID
 */
export function getSinkById(id: string): SinkRegistryEntry | undefined {
  return SINK_REGISTRY.find(sink => sink.id === id);
}

/**
 * Get all sinks by type
 */
export function getSinksByType(type: SinkRegistryEntry['type']): SinkRegistryEntry[] {
  return SINK_REGISTRY.filter(sink => sink.type === type);
}

/**
 * Get all sinks for an environment
 */
export function getSinksByEnvironment(env: SinkRegistryEntry['environments'][0]): SinkRegistryEntry[] {
  return SINK_REGISTRY.filter(sink => sink.environments.includes(env));
}

/**
 * Validate sink ID format
 */
export function isValidSinkId(id: string): boolean {
  // Pattern: {type}.{service-name}
  const pattern = /^(svc|etl|job|db|queue)\.[a-z0-9-]+$/;
  return pattern.test(id);
}

/**
 * Get all registered sink IDs
 */
export function getAllSinkIds(): string[] {
  return SINK_REGISTRY.map(sink => sink.id);
}

