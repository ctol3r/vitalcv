import { VCVApplication, ApplicationBlocker } from '../../domain/entity/vcvApplication';

export type DecisionStatus = 'READY' | 'CONDITIONAL READY' | 'BLOCKED';

export interface ApplicationDecision {
  status: DecisionStatus;
  reasoning: string[];
  blockers: string[];
  nextSteps: string[];
}

export function evaluateDecision(application: Partial<VCVApplication>): ApplicationDecision {
  const blockers: string[] = application.blockers?.map(b => b.type) || [];
  const reasoning: string[] = [];
  const nextSteps: string[] = [];
  
  let status: DecisionStatus = 'READY';
  
  const hasCriticalBlocker = application.blockers?.some(b => b.severity === 'high');
  const oigBlocked = application.blockers?.some(b => b.type.toUpperCase().includes('OIG') || b.type.toUpperCase().includes('EXCLUSION'));
  const revokedLicense = application.blockers?.some(b => b.type.toUpperCase().includes('REVOKED'));
  
  if (oigBlocked || revokedLicense) {
    status = 'BLOCKED';
    reasoning.push('Critical adverse finding detected (Exclusion or Revocation).');
    nextSteps.push('Escalate to compliance team for immediate review.');
  } else if (hasCriticalBlocker || (application.progress && Object.values(application.progress).some(p => p !== 'complete'))) {
    status = 'CONDITIONAL READY';
    reasoning.push('Identity checked, but non-critical gaps exist.');
    nextSteps.push('Collect missing information to achieve READY status.');
  } else {
    status = 'READY';
    reasoning.push('Identity checked, no exclusions, no critical blockers.');
    nextSteps.push('Proceed with onboarding.');
  }
  
  return {
    status,
    reasoning,
    blockers,
    nextSteps
  };
}
