import { ValidationIssue } from './validator';

export type OperationOutcomeSeverity = 'fatal' | 'error' | 'warning' | 'information';

export interface OperationOutcomeIssue {
  severity: OperationOutcomeSeverity;
  code: string;
  diagnostics?: string;
  expression?: string[];
  details?: {
    text?: string;
  };
}

export interface OperationOutcome {
  resourceType: 'OperationOutcome';
  issue: OperationOutcomeIssue[];
}

export function buildOperationOutcome(issues: OperationOutcomeIssue[]): OperationOutcome {
  return {
    resourceType: 'OperationOutcome',
    issue: issues,
  };
}

function formatPath(path?: string): string | undefined {
  if (!path) {
    return undefined;
  }
  const trimmed = path.replace(/^\//, '');
  return trimmed.replace(/\//g, '.');
}

export function outcomeFromValidation(
  resourceType: string,
  issues: ValidationIssue[],
  severity: OperationOutcomeSeverity = 'error'
): OperationOutcome {
  if (issues.length === 0) {
    return buildOperationOutcome([
      {
        severity: 'information',
        code: 'informational',
        diagnostics: `${resourceType} validated successfully`,
      },
    ]);
  }

  return buildOperationOutcome(
    issues.map(issue => ({
      severity,
      code: 'invalid',
      diagnostics: issue.message,
      expression: formatPath(issue.path) ? [formatPath(issue.path)!] : undefined,
    }))
  );
}


