/**
 * /admin/platform — Founder Dashboard.
 *
 * ADMIN-gated, server-rendered initial Deployment Integrity report, then the
 * client view auto-refreshes. Every production service shows green when it
 * agrees with the canonical config (repo / branch / commit / age / health /
 * env); any drift turns a card red. Detect-only — never mutates infrastructure.
 */
import type { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { buildIntegrityReport } from '@/lib/platform/deployment-integrity';
import PlatformDashboardClient from '@/components/platform/PlatformDashboardClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Platform · VitalCV',
  description: 'Production deployment integrity — Founder Dashboard.',
};

export default async function PlatformDashboardPage() {
  const session = await auth();
  if (!session.userId) {
    redirect('/sign-in?redirect_url=/admin/platform');
  }
  const role = (session.sessionClaims as { vitalcv?: { role?: string } } | null)?.vitalcv?.role;
  if (role !== 'ADMIN') {
    redirect('/');
  }

  const report = await buildIntegrityReport({ railwayToken: process.env.RAILWAY_API_TOKEN });

  return (
    <div className="mz mz-paper mz-persona-admin min-h-screen">
      <PlatformDashboardClient initialReport={report} />
    </div>
  );
}
