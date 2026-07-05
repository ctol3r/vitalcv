/**
 * /admin/leads — Wave Q. Minimal internal list of captured commercial leads
 * (PilotLead rows). ADMIN-gated with the same pattern as /admin/platform.
 * Read-only; the durable trail is the paired AuditEvent per lead.
 * Deploy-order safe: renders an honest empty state until the PilotLead
 * migration deploys.
 */
import type { Metadata } from 'next';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Leads · VitalCV',
  description: 'Captured pilot leads — internal.',
};

interface LeadRow {
  id: string;
  source: string;
  persona: string | null;
  organization: string;
  contactName: string | null;
  email: string;
  workflowTarget: string | null;
  sourceContext: string | null;
  slackDelivered: boolean;
  createdAt: Date;
}

export default async function AdminLeadsPage() {
  const session = await auth();
  if (!session.userId) {
    redirect('/sign-in?redirect_url=/admin/leads');
  }
  const role = (session.sessionClaims as { vitalcv?: { role?: string } } | null)?.vitalcv?.role;
  if (role !== 'ADMIN') {
    redirect('/');
  }

  let leads: LeadRow[] = [];
  let tablePending = false;
  try {
    leads = await prisma.pilotLead.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        source: true,
        persona: true,
        organization: true,
        contactName: true,
        email: true,
        workflowTarget: true,
        sourceContext: true,
        slackDelivered: true,
        createdAt: true,
      },
    });
  } catch {
    tablePending = true;
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-6">
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">Internal</p>
        <h1 className="mt-1 text-2xl font-semibold text-foreground">Captured leads</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Durable pilot-request and pilot-intake submissions, newest first. Each row has a paired
          audit event; Slack delivery status is operational only.
        </p>
      </header>

      {tablePending ? (
        <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
          The PilotLead table is not deployed yet (migration pending). Leads keep flowing to Slack
          and the server log in the meantime.
        </p>
      ) : leads.length === 0 ? (
        <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
          No captured leads yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Persona</th>
                <th className="px-3 py-2">Organization</th>
                <th className="px-3 py-2">Contact</th>
                <th className="px-3 py-2">Target</th>
                <th className="px-3 py-2">Slack</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-b border-border/60 align-top">
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                    {lead.createdAt.toISOString().slice(0, 16).replace('T', ' ')}
                  </td>
                  <td className="px-3 py-2">{lead.source}</td>
                  <td className="px-3 py-2">{lead.persona ?? '—'}</td>
                  <td className="px-3 py-2 font-medium text-foreground">{lead.organization}</td>
                  <td className="px-3 py-2">
                    {lead.contactName ? `${lead.contactName} · ` : ''}
                    {lead.email}
                  </td>
                  <td className="px-3 py-2">{lead.workflowTarget ?? lead.sourceContext ?? '—'}</td>
                  <td className="px-3 py-2">{lead.slackDelivered ? 'delivered' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
