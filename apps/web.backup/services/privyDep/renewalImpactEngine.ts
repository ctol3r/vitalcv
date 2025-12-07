import { buildPrivilegeGraph } from './graph';
import { buildClinicianPrivilegeSnapshot } from './clinicianSnapshot';
import { normalizePrivilegeCode } from './types';
import { emitPrivilegeGraphChange } from './events/emitter';
import { CredentialRiskFactors } from '../credentialRisk/enums';

export type RenewalAction = 'RENEWED' | 'EXPIRED' | 'REVOKED';

export interface RenewalImpactDetail {
  privilegeCode: string;
  impact: 'UNLOCKED' | 'BLOCKED' | 'REVIEW';
  reason: string;
  depth: number;
  grantId?: string;
  status?: string;
}

export interface PrivilegeRenewalImpactResult {
  clinicianId: string;
  privilegeCode: string;
  action: RenewalAction;
  impacted: RenewalImpactDetail[];
  requiresManualReview: boolean;
  evaluatedAt: Date;
}

export interface PrivilegeRenewalImpactInput {
  clinicianId: string;
  privilegeCode: string;
  action: RenewalAction;
  orgId?: string;
  broadcast?: boolean;
}

function collectDownstream(graph: ReturnType<typeof buildPrivilegeGraph>, rootCode: string): Map<string, number> {
  const queue: Array<{ code: string; depth: number }> = [{ code: rootCode, depth: 0 }];
  const depths = new Map<string, number>();
  const visited = new Set<string>();

  while (queue.length > 0) {
    const { code, depth } = queue.shift()!;
    if (visited.has(code)) continue;
    visited.add(code);
    depths.set(code, depth);
    const dependents = graph.downstream.get(code);
    if (!dependents) continue;
    for (const dependent of dependents) {
      if (!visited.has(dependent)) {
        queue.push({ code: dependent, depth: depth + 1 });
      }
    }
  }

  depths.delete(rootCode);
  return depths;
}

export async function evaluateRenewalImpact(
  input: PrivilegeRenewalImpactInput
): Promise<PrivilegeRenewalImpactResult> {
  const normalizedCode = normalizePrivilegeCode(input.privilegeCode);
  const [snapshot, graph] = await Promise.all([
    buildClinicianPrivilegeSnapshot(input.clinicianId),
    buildPrivilegeGraph(normalizedCode, { maxDepth: 5 }),
  ]);

  const downstreamDepths = collectDownstream(graph, normalizedCode);
  const impacted: RenewalImpactDetail[] = [];

  for (const grant of snapshot.grants) {
    for (const code of grant.privilegeCodes) {
      if (!downstreamDepths.has(code)) continue;
      const depth = downstreamDepths.get(code)!;
      if (input.action === 'RENEWED') {
        if (grant.status !== 'ACTIVE') {
          impacted.push({
            privilegeCode: code,
            impact: 'UNLOCKED',
            reason: `Upstream privilege ${normalizedCode} renewed`,
            depth,
            grantId: grant.privilegeGrantedId,
            status: grant.status,
          });
        }
      } else {
        impacted.push({
          privilegeCode: code,
          impact: 'BLOCKED',
          reason: `Upstream privilege ${normalizedCode} ${input.action.toLowerCase()}`,
          depth,
          grantId: grant.privilegeGrantedId,
          status: grant.status,
        });
      }
    }
  }

  for (const request of snapshot.pendingRequests) {
    for (const code of request.privilegeCodes) {
      if (!downstreamDepths.has(code)) continue;
      impacted.push({
        privilegeCode: code,
        impact: 'REVIEW',
        reason: `Pending request blocked by ${normalizedCode} ${input.action.toLowerCase()}`,
        depth: downstreamDepths.get(code)!,
        grantId: undefined,
        status: request.status,
      });
    }
  }

  const requiresManualReview = impacted.some((detail) => detail.impact !== 'UNLOCKED');
  const result: PrivilegeRenewalImpactResult = {
    clinicianId: snapshot.clinicianId,
    privilegeCode: normalizedCode,
    action: input.action,
    impacted,
    requiresManualReview,
    evaluatedAt: new Date(),
  };

  if (input.broadcast && impacted.length > 0) {
    await emitPrivilegeGraphChange({
      clinicianId: snapshot.clinicianId,
      clinicianDid: snapshot.clinicianDid,
      orgId: input.orgId,
      changeType: 'PRIVILEGE_RENEWAL_IMPACT',
      privilegeCode: normalizedCode,
      reason: `Privilege ${normalizedCode} ${input.action.toLowerCase()}`,
      impactedPrivileges: impacted,
      riskFactorsToAdd:
        input.action === 'RENEWED'
          ? []
          : [CredentialRiskFactors.PRIVILEGE_GRAPH_DRIFT],
      riskFactorsToRemove: input.action === 'RENEWED' ? [CredentialRiskFactors.PRIVILEGE_GRAPH_DRIFT] : [],
      metadata: {
        requiresManualReview,
        impactedCount: impacted.length,
      },
    });
  }

  return result;
}

