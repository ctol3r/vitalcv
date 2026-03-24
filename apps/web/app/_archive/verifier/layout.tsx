import type { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'VitalCV — Verifier Workspace',
  description: 'Review, verify, and accept clinician credentials.',
};

/**
 * Verifier Layout — shell boundary for /verifier/* routes.
 *
 * Provides:
 *  1. Auth gate (Clerk) — unauthenticated users redirected to sign-in.
 *  2. Consistent ops-dark chrome so individual pages don't need to
 *     self-apply min-h-screen / bg-ops-gradient / text-white.
 *
 * Keeps it minimal. Pages still own their own content layout.
 * See docs/VCV_UI_DOCTRINE.md §1 (Verifier / Employer surface).
 */
export default async function VerifierLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session.userId) {
    redirect('/sign-in?redirect_url=/verifier/home');
  }

  return (
    <div className="flex min-h-screen flex-col bg-ops-gradient text-white selection:bg-vt-info/30">
      <div className="flex-1">{children}</div>
    </div>
  );
}
