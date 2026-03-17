export interface InvestigationWorkbenchAnchorInput {
  npi?: string | null;
  findingId?: string | null;
  storylineId?: string | null;
}

function appendIfPresent(searchParams: URLSearchParams, key: string, value: string | null | undefined) {
  if (typeof value !== 'string') {
    return;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return;
  }

  searchParams.set(key, trimmed);
}

export function buildInvestigationWorkbenchSearchParams(
  input: InvestigationWorkbenchAnchorInput,
): URLSearchParams {
  const searchParams = new URLSearchParams();

  appendIfPresent(searchParams, 'npi', input.npi);
  appendIfPresent(searchParams, 'findingId', input.findingId);
  appendIfPresent(searchParams, 'storylineId', input.storylineId);

  return searchParams;
}

export function buildInvestigationWorkbenchRequestPath(
  input: InvestigationWorkbenchAnchorInput,
): string {
  const searchParams = buildInvestigationWorkbenchSearchParams(input);
  const query = searchParams.toString();

  return query.length > 0
    ? `/api/investigation/workbench?${query}`
    : '/api/investigation/workbench';
}

export const FINDING_STATUS_METHOD = 'PATCH';

export function buildFindingStatusEndpoint(findingId: string): string {
  return `/api/findings/${encodeURIComponent(findingId)}/status`;
}
