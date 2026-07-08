import React from 'react';
import Link from 'next/link';

import { LaneHealthMount } from '@/components/source-health/LaneHealthMount';

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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 border rounded-lg shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Applications by State</h2>
          <ul className="space-y-2">
            <li className="flex justify-between"><span>New</span> <span className="font-bold">12</span></li>
            <li className="flex justify-between"><span>Under Review</span> <span className="font-bold">5</span></li>
            <li className="flex justify-between"><span>Waiting for Docs</span> <span className="font-bold">3</span></li>
            <li className="flex justify-between"><span>Approved</span> <span className="font-bold">8</span></li>
            <li className="flex justify-between"><span>Rejected</span> <span className="font-bold">2</span></li>
          </ul>
        </div>

        <div className="p-6 border rounded-lg shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Workflow Bottlenecks</h2>
          <div className="p-4 bg-amber-500/10 text-amber-600 rounded">
            <strong>Time to Credential:</strong> 4.2 days avg
          </div>
          <div className="p-4 bg-destructive/10 text-destructive rounded mt-4">
            <strong>OIG Checks Delayed:</strong> 2 applications stuck
          </div>
        </div>

        <div className="p-6 border rounded-lg shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Missing Data Requests</h2>
          <ul className="space-y-3">
            <li className="p-3 border rounded text-sm">
              <strong>App #1029</strong> - License copy missing (Pending 2 days)
            </li>
            <li className="p-3 border rounded text-sm">
              <strong>App #1030</strong> - Missing NPI state (Pending 1 day)
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
