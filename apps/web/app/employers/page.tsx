import { redirect } from 'next/navigation';

/**
 * /employers — Wave LIVE-100C P0-B rescue.
 *
 * The previous /employers route depended on `fetchLaunchEmployers()`
 * hitting a marketplace directory endpoint that was surfacing as a
 * production 404 under certain deploy conditions. For the current
 * wedge, "For Employers" means "request a pilot" — not "browse a
 * directory" — so we redirect to /pilot unconditionally.
 *
 * Keeping this as a server-side redirect (not a client <meta>
 * refresh) so search engines + nav clicks both resolve the same
 * way, and so there is never a flash of empty content.
 *
 * The "For Employers" nav label in components/layout/Navbar.tsx
 * continues to point at /employers; this file makes that target
 * safe permanently.
 */
export default function EmployersPage(): never {
  redirect('/pilot');
}
