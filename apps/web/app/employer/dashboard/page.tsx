import React from 'react';
import Link from 'next/link';

import { EmployerWorkflowDashboard } from '@/components/employer/EmployerWorkflowDashboard';
import { LaneHealthMount } from '@/components/source-health/LaneHealthMount';

export const dynamic = 'force-dynamic';

/**
 * Employer workspace landing (`ROLE_LANDING.VERIFIER`).
 *
 * W0.3: this route previously rendered hard-coded application counts, a
 * "4.2 days avg" time-to-credential figure, and invented application IDs
 * (#1029/#1030) — to anonymous visitors, because `/employer/*` carried no
 * route guard. Simulated operations presented as live customer data is the
 * exact trust failure the product sells against.
 *
 * Every number below now comes from `/api/employer/applications/dashboard`,
 * which is session-authorized and 401s without one. Zero applications render
 * as an empty state, never as sample data.
 */
export default function EmployerDashboardPage() {
  return (
    <div className="p-8 text-foreground bg-background">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Employer Dashboard</h1>
        <Link
          href="/employer/post"
          className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background transition hover:bg-foreground/90"
        >
          Post a job
        </Link>
      </div>

      <div className="mb-8">
        <LaneHealthMount heading="Source operational state (employer view)" />
      </div>

      <EmployerWorkflowDashboard />
    </div>
  );
}
