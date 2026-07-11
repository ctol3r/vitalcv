'use client';

/**
 * DevKeysNotice — kills the silent local-auth failure mode.
 *
 * Clerk production keys (pk_live_…) are domain-bound: off their bound domain
 * ClerkJS refuses to initialize and the sign-in/sign-up widgets render but
 * silently do nothing. That reads as "auth is broken" on localhost when the
 * real cause is prod keys in .env.local. When the inlined publishable key is
 * a live key and the page host isn't the key's domain, say so loudly and give
 * the fix. Renders nothing in production or with pk_test keys.
 */

import { useEffect, useState } from 'react';

function decodeBase64(value: string): string | null {
  try {
    if (typeof atob === 'function') return atob(value);
  } catch {
    return null;
  }
  try {
    return Buffer.from(value, 'base64').toString('utf8');
  } catch {
    return null;
  }
}

/** The apex domain a pk_live key is bound to (null for pk_test/invalid keys). */
export function liveKeyDomain(publishableKey: string | undefined): string | null {
  if (!publishableKey?.startsWith('pk_live_')) return null;
  const decoded = decodeBase64(publishableKey.slice('pk_live_'.length));
  if (!decoded) return null;
  const host = decoded.replace(/\$+$/, '').trim().toLowerCase();
  if (!host.includes('.')) return null;
  return host.replace(/^clerk\./, '');
}

/** True when live keys are being served from a host they can never work on. */
export function shouldWarnAboutLiveKeys(
  publishableKey: string | undefined,
  hostname: string,
): boolean {
  const domain = liveKeyDomain(publishableKey);
  if (!domain) return false;
  const host = hostname.trim().toLowerCase();
  return host !== domain && !host.endsWith(`.${domain}`);
}

export function DevKeysNotice() {
  const [warn, setWarn] = useState(false);

  useEffect(() => {
    setWarn(
      shouldWarnAboutLiveKeys(
        process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
        window.location.hostname,
      ),
    );
  }, []);

  if (!warn) return null;

  const domain = liveKeyDomain(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) ?? 'its bound domain';

  return (
    <div
      role="alert"
      data-testid="dev-keys-notice"
      className="mx-auto mb-6 w-full max-w-md rounded-lg border-2 px-4 py-3 text-sm"
      style={{ borderColor: '#b45309', background: 'rgba(180,83,9,0.08)', color: 'inherit' }}
    >
      <p className="font-semibold">Sign-in can&apos;t work on this host</p>
      <p className="mt-1">
        This build is using <code>pk_live</code> Clerk keys, which only run on{' '}
        <strong>{domain}</strong>. On {typeof window !== 'undefined' ? window.location.hostname : 'this host'}{' '}
        the auth widget renders but every attempt is silently refused.
      </p>
      <p className="mt-2">
        Fix for local development: put the <strong>Development instance</strong>{' '}
        keys (<code>pk_test_…</code> / <code>sk_test_…</code>) from the Clerk
        dashboard into <code>apps/web/.env.local</code>, then restart the dev
        server. Production on {domain} is unaffected.
      </p>
    </div>
  );
}

export default DevKeysNotice;
