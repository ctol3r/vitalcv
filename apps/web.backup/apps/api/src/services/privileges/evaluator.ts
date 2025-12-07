export interface ClinicianCredentialNode {
  code: string;
  label?: string;
  status?: 'active' | 'expired' | 'pending';
  jurisdiction?: string;
  expiresAt?: string | null;
  verified?: boolean;
}

export interface ClinicianCredentialGraph {
  clinicianId: string;
  boardCertifications: ClinicianCredentialNode[];
  licenses: ClinicianCredentialNode[];
  trainings: ClinicianCredentialNode[];
  experienceYears?: number;
  compactStates?: string[];
}

export interface PrivilegePackRules {
  requires?: string[];
  anyOf?: string[];
  minExperienceYears?: number;
  allowCompactSubstitution?: boolean;
}

export interface PrivilegeEvaluationResult {
  eligible: boolean;
  missingRequirements: string[];
  satisfied: string[];
}

type PrivilegeRulesInput = string[] | PrivilegePackRules | null | undefined;

type ParsedRule =
  | { type: 'experience'; minYears: number }
  | { type: 'board' }
  | { type: 'training'; code: string }
  | { type: 'license'; jurisdiction?: string }
  | { type: 'compact' }
  | { type: 'custom'; token: string };

export class PrivilegeEvaluator {
  evaluate(graph: ClinicianCredentialGraph, rulesInput: PrivilegeRulesInput): PrivilegeEvaluationResult {
    const parsed = normalizeRules(rulesInput);
    if (parsed.length === 0) {
      return {
        eligible: true,
        missingRequirements: [],
        satisfied: [],
      };
    }

    const satisfied: string[] = [];
    const missing: string[] = [];

    for (const rule of parsed) {
      switch (rule.type) {
        case 'experience': {
          const experience = Math.max(0, graph.experienceYears ?? 0);
          if (experience >= rule.minYears) {
            satisfied.push(`Experience >= ${rule.minYears} years`);
          } else {
            missing.push(`Needs ${rule.minYears} years experience`);
          }
          break;
        }
        case 'board': {
          if (graph.boardCertifications.some((cert) => isActive(cert))) {
            satisfied.push('Active board certification');
          } else {
            missing.push('Board certification required');
          }
          break;
        }
        case 'training': {
          if (hasTraining(graph, rule.code)) {
            satisfied.push(`${rule.code} credential`);
          } else {
            missing.push(`${rule.code} credential missing`);
          }
          break;
        }
        case 'license': {
          if (hasLicense(graph, rule.jurisdiction)) {
            satisfied.push(
              rule.jurisdiction ? `License ${rule.jurisdiction}` : 'Active unrestricted license',
            );
          } else {
            missing.push(
              rule.jurisdiction
                ? `Requires ${rule.jurisdiction} license`
                : 'Active license requirement unmet',
            );
          }
          break;
        }
        case 'compact': {
          if ((graph.compactStates ?? []).length > 0) {
            satisfied.push('Compact eligible');
          } else {
            missing.push('Compact eligibility required');
          }
          break;
        }
        case 'custom': {
          if (hasTraining(graph, rule.token) || hasLicense(graph, rule.token)) {
            satisfied.push(`${rule.token} requirement met`);
          } else {
            missing.push(`${rule.token} requirement not satisfied`);
          }
          break;
        }
        default:
          missing.push('Unsupported rule encountered');
          break;
      }
    }

    return {
      eligible: missing.length === 0,
      missingRequirements: missing,
      satisfied,
    };
  }
}

function normalizeRules(rulesInput: PrivilegeRulesInput): ParsedRule[] {
  if (!rulesInput) return [];
  if (Array.isArray(rulesInput)) {
    return rulesInput.map(parseRule).filter(Boolean) as ParsedRule[];
  }

  const parsed: ParsedRule[] = [];
  if (typeof rulesInput.minExperienceYears === 'number') {
    parsed.push({ type: 'experience', minYears: rulesInput.minExperienceYears });
  }

  const list = [...(rulesInput.requires ?? []), ...(rulesInput.anyOf ?? [])];
  parsed.push(...list.map(parseRule).filter(Boolean) as ParsedRule[]);

  if (rulesInput.allowCompactSubstitution) {
    parsed.push({ type: 'compact' });
  }

  return parsed;
}

function parseRule(token: string): ParsedRule | null {
  if (!token) return null;
  const normalized = token.trim();
  if (!normalized) return null;

  if (normalized.toLowerCase().startsWith('experience>')) {
    const minYears = Number(normalized.split('>').pop());
    if (Number.isFinite(minYears)) {
      return { type: 'experience', minYears };
    }
    return null;
  }

  if (normalized.toLowerCase().startsWith('license')) {
    const [, state] = normalized.split(':');
    return { type: 'license', jurisdiction: state?.toUpperCase() };
  }

  if (normalized.toLowerCase() === 'boardcert') {
    return { type: 'board' };
  }

  if (normalized.toLowerCase() === 'compact') {
    return { type: 'compact' };
  }

  if (/^(acls|bls|pals|atls)$/i.test(normalized)) {
    return { type: 'training', code: normalized.toUpperCase() };
  }

  return { type: 'custom', token: normalized };
}

function hasTraining(graph: ClinicianCredentialGraph, code: string) {
  const target = code.toLowerCase();
  return graph.trainings.some((training) => {
    const trainingCode = training.code ?? training.label;
    return trainingCode?.toLowerCase() === target && isActive(training);
  });
}

function hasLicense(graph: ClinicianCredentialGraph, jurisdiction?: string) {
  return graph.licenses.some((license) => {
    if (!isActive(license)) return false;
    if (!jurisdiction) return true;
    return license.jurisdiction?.toUpperCase() === jurisdiction.toUpperCase();
  });
}

function isActive(node: ClinicianCredentialNode) {
  if (node.status && node.status.toLowerCase() !== 'active') {
    return false;
  }
  if (node.expiresAt) {
    const expiry = new Date(node.expiresAt).getTime();
    return expiry > Date.now();
  }
  return true;
}










