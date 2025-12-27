import { EmployerReadinessSummary, RequirementEvidence } from '../employer/models';

function formatRequirement(req: RequirementEvidence): string {
  const statusLabel =
    req.status === 'MET'
      ? 'met'
      : req.status === 'PARTIAL'
        ? 'partially met'
        : 'not met';
  const evidence = req.evidence.length ? ` Evidence: ${req.evidence.join('; ')}` : '';
  const gaps = req.gaps.length ? ` Gaps: ${req.gaps.join('; ')}` : '';
  const remediation = req.remediation ? ` Next step: ${req.remediation}` : '';
  return `${req.label} is ${statusLabel}.${evidence}${gaps}${remediation}`;
}

export function explainReadiness(summary: EmployerReadinessSummary): string[] {
  const headline =
    summary.status === 'READY'
      ? 'Clinician meets the documented requirements for this role.'
      : summary.status === 'ALMOST_READY'
        ? 'Clinician is close to ready; targeted remediation required.'
        : 'Clinician is not ready based on current evidence.';

  const requirementNotes = summary.requirements.map((req) => formatRequirement(req));

  return [headline, ...requirementNotes];
}
