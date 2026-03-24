export interface EmployerDirectoryCountSummaryInput {
  employers: unknown[];
  total: number;
}

export function resolveEmployerDirectoryCountSummary(
  payload: EmployerDirectoryCountSummaryInput,
) {
  const displayed = payload.employers.length;
  const total = Math.max(payload.total, displayed);
  const helperText = total > displayed
    ? `${displayed} shown on this page · ${total} total live directory employers.`
    : 'Organizations currently visible in the public directory.';

  return {
    displayed,
    total,
    helperText,
  } as const;
}
