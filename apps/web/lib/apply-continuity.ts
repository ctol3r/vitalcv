const APPLY_CONTINUITY_PATHS = new Set([
  '/explore',
  '/holder/opportunities',
]);

export function buildApplyContinuationHref(input: {
  pathname?: string | null;
  search?: URLSearchParams | string | null;
  opportunityId?: string | null;
}): string {
  const requestedPath = typeof input.pathname === 'string' ? input.pathname.trim() : '';
  const pathname = APPLY_CONTINUITY_PATHS.has(requestedPath) ? requestedPath : '/explore';
  const params = new URLSearchParams(
    typeof input.search === 'string'
      ? input.search
      : input.search?.toString() ?? '',
  );

  if (typeof input.opportunityId === 'string' && input.opportunityId.trim().length > 0) {
    params.set('apply', input.opportunityId.trim());
  } else {
    params.delete('apply');
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
