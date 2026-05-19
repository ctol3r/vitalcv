/**
 * VitalCV · Trust Surfaces · Route group layout
 *
 * The (trust) route group is the only place in apps/web that imports
 * trust.css. The CSS lives entirely under the `.trust-scope`
 * selector so it does not leak into the rest of the app.
 *
 * Every child route renders inside the .trust-scope wrapper. The
 * required demo banner is the route's own responsibility; the
 * layout intentionally does NOT inject it globally so a future
 * non-fixture page (when it ever ships) can choose its own
 * disclaimer.
 */

import * as React from 'react';

import '@/styles/trust.css';

export const metadata = {
  title: 'VitalCV · Trust Surfaces (demo fixtures)',
  description:
    'Demo trust surfaces — canonical reading order, controlled-document headers, signed receipt fixtures. Not a real credentialing decision.',
};

export default function TrustGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="trust-scope" data-testid="trust-scope-root">
      <div className="t-page">{children}</div>
    </div>
  );
}
