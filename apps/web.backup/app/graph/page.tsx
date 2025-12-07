'use client';

import type { Viewport } from 'next';
import VitalGraph from '@/components/graph/VitalGraph';

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0B0B0B' },
    { media: '(prefers-color-scheme: light)', color: '#FFFFFF' },
  ],
  width: 'device-width',
  initialScale: 1,
};

// Force dynamic rendering to prevent SSG crashes
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const data = {
  nodes: [
    { id: 'NPI:1234567890', group: 'holder' as const, label: 'Dr Rivera' },
    { id: 'CA-Med-Board', group: 'issuer' as const, label: 'CA Board' },
    { id: 'MD-License#MD12345', group: 'cred' as const, label: 'MD License' },
    { id: 'Stanford Health', group: 'verifier' as const, label: 'Stanford' },
    { id: 'Cardiology-Job#42', group: 'job' as const, label: 'Cardio Attending' },
    { id: 'NPI:9876543210', group: 'holder' as const, label: 'Dr Chen' },
    { id: 'DEA-Registration#DEA123', group: 'cred' as const, label: 'DEA Reg' },
    { id: 'Kaiser-Permanente', group: 'verifier' as const, label: 'Kaiser' },
    { id: 'Board-Cert#BC456', group: 'cred' as const, label: 'Board Cert' },
  ],
  links: [
    { source: 'CA-Med-Board', target: 'MD-License#MD12345', weight: 2 },
    { source: 'NPI:1234567890', target: 'MD-License#MD12345', weight: 2 },
    { source: 'Stanford Health', target: 'NPI:1234567890', weight: 1 },
    { source: 'Cardiology-Job#42', target: 'Stanford Health', weight: 1 },
    { source: 'NPI:9876543210', target: 'DEA-Registration#DEA123', weight: 2 },
    { source: 'CA-Med-Board', target: 'DEA-Registration#DEA123', weight: 1 },
    { source: 'Kaiser-Permanente', target: 'NPI:9876543210', weight: 1 },
    { source: 'NPI:1234567890', target: 'Board-Cert#BC456', weight: 2 },
  ],
};

export default function GraphPage() {
  return (
    <main className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Network View</h1>
        <p className="text-muted-foreground mt-2">
          Visualize the connections between holders, issuers, verifiers, credentials, and jobs
        </p>
      </div>
      <VitalGraph data={data} />
    </main>
  );
}

