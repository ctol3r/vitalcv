'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

type Band = 'GREEN' | 'YELLOW' | 'RED';
type Item = {
  id: string;
  clinician: string;
  role: string;
  band: Band;
  updatedAt: string;
  summary: string;
};

const SEED: Item[] = [
  { id: 'art:001', clinician: 'NPI 1003000126', role: 'Physician', band: 'GREEN', updatedAt: 'Just now', summary: 'License + board current. Sanctions clear.' },
  { id: 'art:002', clinician: 'NPI 1999999999', role: 'NP', band: 'YELLOW', updatedAt: '2h ago', summary: 'License current. DEA missing.' },
  { id: 'art:003', clinician: 'NPI 1888888888', role: 'PA', band: 'RED', updatedAt: '1d ago', summary: 'License expired. Requires remediation.' },
];

function bandPill(b: Band) {
  const base = 'inline-flex items-center px-3 py-1 rounded-full border text-sm font-medium';
  if (b === 'GREEN') return <span className={base}>GREEN</span>;
  if (b === 'YELLOW') return <span className={base}>YELLOW</span>;
  return <span className={base}>RED</span>;
}

export default function VerifierInbox() {
  const [q, setQ] = useState('');
  const [activeId, setActiveId] = useState(SEED[0].id);
  const [decision, setDecision] = useState<Record<string, 'Accepted' | 'Conditional' | 'Requested' | 'None'>>({});

  const list = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return SEED.filter((i) => !qq || (i.clinician + ' ' + i.role + ' ' + i.summary).toLowerCase().includes(qq));
  }, [q]);

  const active = useMemo(() => list.find((i) => i.id === activeId) || list[0], [list, activeId]);

  function act(kind: 'Accepted' | 'Conditional' | 'Requested') {
    if (!active) return;
    setDecision((d) => ({ ...d, [active.id]: kind }));
  }

  return (
    <main className="min-h-screen bg-background text-foreground px-6 py-12">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div>
            <h1 className="text-4xl font-semibold">Verifier Inbox</h1>
            <p className="mt-2 text-muted-foreground text-lg">
              Validate artifacts, accept faster, and stop restarting verification loops.
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/verifier" className="px-5 py-3 rounded-2xl border hover:bg-muted transition">
              Back to Verifier
            </Link>
            <Link href="/demo" className="px-5 py-3 rounded-2xl bg-primary text-primary-foreground hover:opacity-90 transition">
              Try Demo Flow
            </Link>
          </div>
        </div>

        <div className="mt-10 grid lg:grid-cols-3 gap-6">
          <section className="lg:col-span-1 p-6 border rounded-3xl">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xl font-semibold">Incoming</div>
              <div className="text-sm text-muted-foreground">{list.length} items</div>
            </div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by NPI, role, status…"
              className="mt-4 w-full px-4 py-3 border rounded-2xl bg-background"
            />
            <div className="mt-5 space-y-3">
              {list.map((i) => (
                <button
                  key={i.id}
                  onClick={() => setActiveId(i.id)}
                  className={[
                    'w-full text-left p-4 rounded-2xl border hover:bg-muted transition',
                    active?.id === i.id ? 'bg-muted' : '',
                  ].join(' ')}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold">{i.clinician}</div>
                    {bandPill(i.band)}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">{i.role} • {i.updatedAt}</div>
                  <div className="mt-2 text-sm text-muted-foreground">{i.summary}</div>
                </button>
              ))}
            </div>
          </section>

          <section className="lg:col-span-2 p-8 border rounded-3xl">
            {!active ? (
              <div className="text-muted-foreground">Select an artifact to review.</div>
            ) : (
              <>
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                  <div>
                    <div className="text-sm text-muted-foreground">Artifact</div>
                    <div className="text-3xl font-semibold mt-1">{active.id}</div>
                    <div className="mt-2 text-muted-foreground text-lg">
                      {active.clinician} • {active.role}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {bandPill(active.band)}
                    <span className="text-sm text-muted-foreground">
                      Decision: {decision[active.id] || 'None'}
                    </span>
                  </div>
                </div>

                <div className="mt-10 grid md:grid-cols-2 gap-6">
                  <div className="p-6 rounded-2xl border bg-muted/30">
                    <div className="text-xl font-semibold">What you're validating</div>
                    <ul className="mt-4 space-y-2 text-muted-foreground">
                      <li>• Timestamped artifact bundle</li>
                      <li>• Provenance + source links</li>
                      <li>• Clear audit narrative</li>
                      <li>• Verifier actions + receipt</li>
                    </ul>
                  </div>
                  <div className="p-6 rounded-2xl border">
                    <div className="text-xl font-semibold">Actions</div>
                    <div className="mt-4 flex flex-col sm:flex-row gap-3">
                      <button
                        onClick={() => act('Accepted')}
                        className="px-5 py-3 rounded-2xl bg-primary text-primary-foreground hover:opacity-90 transition"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => act('Conditional')}
                        className="px-5 py-3 rounded-2xl border hover:bg-muted transition"
                      >
                        Conditional Accept
                      </button>
                      <button
                        onClick={() => act('Requested')}
                        className="px-5 py-3 rounded-2xl border hover:bg-muted transition"
                      >
                        Request Missing Items
                      </button>
                    </div>
                    <p className="mt-4 text-sm text-muted-foreground">
                      Next wave can wire these actions into real trust-state updates + audit logs.
                    </p>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
