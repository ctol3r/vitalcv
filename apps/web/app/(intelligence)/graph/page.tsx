import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { GraphWorkspacePage } from './GraphWorkspacePage';
import {
  buildAuthFailurePayload,
  resolveIntelligenceAuthContext,
} from '@/app/api/intelligence/_shared';
import { OperationsShell } from '@/components/intelligence-ops/shell';
import { OpsCard } from '@/components/intelligence-ops/primitives';

export const metadata: Metadata = {
  title: 'Relationship Graph | VitalCV',
  description: 'Dedicated trust and evidence relationship graph workspace.',
};

export default async function GraphPage() {
  const authContext = await resolveIntelligenceAuthContext();

  if (authContext.status === 'missing_session') {
    const payload = buildAuthFailurePayload(authContext) as { signInHref?: string };
    redirect(`${payload.signInHref ?? '/sign-in'}?redirect_url=${encodeURIComponent('/graph')}`);
  }

  if (authContext.status === 'missing_org') {
    const payload = buildAuthFailurePayload(authContext) as { workspaceSwitchHref?: string };

    return (
      <OperationsShell
        activeHref="/graph"
        activeNavKey="graph"
        title="Relationship Graph"
        description="Investigation graph access requires an organization workspace before any provider, finding, or storyline context can be resolved."
      >
        <OpsCard className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--vt-text-3)]">Workspace required</p>
            <h2 className="text-xl font-semibold text-[var(--vt-text-1)]">Switch to an organization workspace</h2>
            <p className="max-w-2xl text-sm leading-6 text-[var(--vt-text-2)]">
              The investigative graph uses organization-scoped findings, storylines, and evidence context.
              Choose a workspace first, then reopen this route.
            </p>
          </div>

          <div>
            <Link
              className="inline-flex items-center rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface-2)] px-4 py-2 text-sm font-medium text-[var(--vt-text-1)] transition hover:border-[var(--vt-text-3)]/40 hover:text-[var(--vt-text-1)]"
              href={payload.workspaceSwitchHref ?? '/workspace/switch'}
            >
              Open workspace switcher
            </Link>
          </div>
        </OpsCard>
      </OperationsShell>
    );
  }

  return <GraphWorkspacePage />;
}
