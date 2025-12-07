export function can(
  user: { role?: string } | undefined,
  perm: 'manage_billing' | 'view_invoices' | 'manage_org' = 'view_invoices'
) {
  const r = user?.role || 'viewer';
  if (perm === 'manage_billing') return r === 'admin';
  if (perm === 'manage_org') return r === 'admin';
  return true;
}

