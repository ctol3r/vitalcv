'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import * as React from 'react';

/**
 * 3-role segmented control above Clerk's SignIn/SignUp form.
 *
 * Reads/writes the `role` URL query param. Clerk's redirect-after-auth
 * handler is configured separately; this component's job is purely
 * "remember what role the user said they were" so the post-auth landing
 * can compute the right destination.
 *
 * chat22 fix #5/#6:
 *   - 3 roles, NOT 2 — matches the 3 role-doors on `/`, no phantom card.
 *   - Each tab has min-height 64px + 14/12px padding so labels never clip
 *     (enforced in CSS, but specified here too for clarity).
 */

export type SignRole = 'clinician' | 'reviewer' | 'operator';

const ROLES: Array<{ value: SignRole; name: string; ds: string }> = [
  { value: 'clinician', name: 'A clinician', ds: 'Reading my own passport' },
  { value: 'reviewer', name: 'A reviewer', ds: 'Reading on behalf of an institution' },
  { value: 'operator', name: 'An operator', ds: 'Connector health · console' },
];

export function RoleSegment({
  label = 'You are',
  defaultRole = 'clinician',
}: {
  label?: string;
  defaultRole?: SignRole;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleFromUrl = searchParams.get('role') as SignRole | null;
  const role: SignRole = roleFromUrl && isValidRole(roleFromUrl) ? roleFromUrl : defaultRole;

  function setRole(next: SignRole) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('role', next);
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="vs-field-grp">
      <label>{label}</label>
      <div className="vs-seg-roles" role="tablist" aria-label={label}>
        {ROLES.map((r) => (
          <button
            key={r.value}
            type="button"
            role="tab"
            aria-selected={role === r.value}
            className={role === r.value ? 'active' : undefined}
            onClick={() => setRole(r.value)}
          >
            <span className="vs-nm">{r.name}</span>
            <span className="vs-ds">{r.ds}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function isValidRole(value: string): value is SignRole {
  return value === 'clinician' || value === 'reviewer' || value === 'operator';
}
