/**
 * Pure parsing + trigger-decision for the Railway deploy webhook.
 *
 * Railway (Project → Webhooks) POSTs a deployment-status payload on each deploy.
 * The payload shape has drifted across Railway versions (status/service can sit
 * at the top level or nested under `deployment`), so the parser is deliberately
 * tolerant and normalizes to one shape. No I/O — the receiver route does the
 * auth + the GitHub dispatch; this module only decides *whether* to dispatch.
 */

export interface RailwayDeployEvent {
  /** e.g. 'DEPLOY' — may be absent in some payloads. */
  type: string | null;
  /** e.g. 'SUCCESS' | 'FAILED' | 'CRASHED' | 'BUILDING' | 'DEPLOYING'. */
  status: string | null;
  serviceName: string | null;
  environmentName: string | null;
  deploymentId: string | null;
  /** Deployed commit hash, when the payload carries deploy meta. */
  commit: string | null;
  projectId: string | null;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}

/**
 * Normalize a raw Railway webhook body into a RailwayDeployEvent, or null when
 * the body is not a recognizable deploy notification (neither a type nor a
 * status is present).
 */
export function parseRailwayDeployEvent(payload: unknown): RailwayDeployEvent | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = obj(payload);
  const deployment = obj(p.deployment);
  const meta = obj(deployment.meta);
  const service = Object.keys(obj(p.service)).length ? obj(p.service) : obj(deployment.service);
  const environment = obj(p.environment);
  const project = obj(p.project);

  const type = str(p.type) ?? str(deployment.type);
  const status = str(p.status) ?? str(deployment.status);
  if (!type && !status) return null;

  return {
    type,
    status,
    serviceName: str(service.name) ?? str(p.serviceName),
    environmentName: str(environment.name) ?? str(p.environmentName),
    deploymentId: str(deployment.id) ?? str(p.deploymentId),
    commit: str(meta.commitHash) ?? str(meta.commit) ?? str(deployment.commitHash),
    projectId: str(project.id) ?? str(p.projectId),
  };
}

export interface TriggerOptions {
  /** Railway service name of the web app. Default 'vitalcv-web'. */
  webServiceName?: string;
  /** Railway environment to gate on. Default 'production'. */
  environmentName?: string;
}

export interface TriggerDecision {
  trigger: boolean;
  reason: string;
}

/**
 * Decide whether a parsed event should kick a release verification.
 *
 * Fires only on a **web-service SUCCESS deploy** in the target environment.
 * Bias-to-run on ambiguity: a missing service name (payload drift) still
 * triggers — over-running is safe (the verify run just re-confirms web and the
 * scheduled net runs anyway), whereas missing a real web deploy is the failure
 * we're guarding against. A present-but-mismatched service/env always skips.
 */
export function shouldTriggerVerification(
  event: RailwayDeployEvent | null,
  opts: TriggerOptions = {},
): TriggerDecision {
  if (!event) return { trigger: false, reason: 'unparseable payload' };

  const status = (event.status ?? '').toUpperCase();
  if (status !== 'SUCCESS') return { trigger: false, reason: `status ${status || '∅'} is not SUCCESS` };

  if (event.type && !/DEPLOY/i.test(event.type)) {
    return { trigger: false, reason: `type ${event.type} is not a deploy` };
  }

  const wantService = (opts.webServiceName ?? 'vitalcv-web').toLowerCase();
  const svc = (event.serviceName ?? '').toLowerCase();
  if (svc && svc !== wantService) {
    return { trigger: false, reason: `service ${event.serviceName} is not ${opts.webServiceName ?? 'vitalcv-web'}` };
  }

  const wantEnv = (opts.environmentName ?? 'production').toLowerCase();
  const env = (event.environmentName ?? '').toLowerCase();
  if (env && env !== wantEnv) {
    return { trigger: false, reason: `environment ${event.environmentName} is not ${opts.environmentName ?? 'production'}` };
  }

  return { trigger: true, reason: 'web SUCCESS deploy' };
}
