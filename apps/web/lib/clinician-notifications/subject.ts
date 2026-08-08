/**
 * Resolve the caller's own notification subject from canonical state.
 *
 * The browser never names the NPI it is granting consent for. That is the
 * same rule the agent consent route follows and for the same reason: a
 * client-supplied subject lets a caller authorize contact about someone
 * else's credentials, and a settings screen is exactly where that would go
 * unnoticed.
 *
 * The NPI comes from the caller's own PersonProfile via the backend, keyed
 * by their session. Header identity is sufficient here (the backend profile
 * routes use `requireInternalUserId`), so this works regardless of where the
 * Clerk JWT-verification rollout has reached.
 */
import 'server-only';
import { buildIdentityHeaders } from '@/lib/auth/forwardIdentity';
import { BACKEND_URL as B } from '@/lib/backend-url';

export interface NotificationSubject {
  npi: string;
  hasVerifiedEmail: boolean;
  verifiedEmailDomain: string | null;
}

export type NotificationSubjectResult =
  | { ok: true; subject: NotificationSubject }
  | { ok: false; reason: 'no_npi_on_profile' | 'unavailable' };

export async function resolveNotificationSubject(
  userId: string,
): Promise<NotificationSubjectResult> {
  let payload: unknown;
  try {
    const response = await fetch(`${B}/api/profile/notification-target`, {
      headers: { ...(await buildIdentityHeaders({ userId })) },
      cache: 'no-store',
    });
    if (!response.ok) return { ok: false, reason: 'unavailable' };
    payload = await response.json();
  } catch {
    return { ok: false, reason: 'unavailable' };
  }

  const record = (payload ?? {}) as Record<string, unknown>;
  const npi = typeof record.npi === 'string' ? record.npi : null;
  if (!npi || !/^\d{10}$/.test(npi)) {
    // No NPI bound to this account: there is nothing to consent about, and
    // guessing one would be the exact failure this function exists to avoid.
    return { ok: false, reason: 'no_npi_on_profile' };
  }

  return {
    ok: true,
    subject: {
      npi,
      hasVerifiedEmail: record.hasVerifiedEmail === true,
      verifiedEmailDomain:
        typeof record.verifiedEmailDomain === 'string' ? record.verifiedEmailDomain : null,
    },
  };
}
