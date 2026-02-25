'use client';

import { useMemo, useState } from 'react';
import { ROLE_TEMPLATES, RoleKey } from '@/lib/catalog/credentialCatalog';

type ItemState = 'missing' | 'added' | 'verified';

export default function RoleChecklist() {
  const [role, setRole] = useState<RoleKey>('physician');
  const [state, setState] = useState<Record<string, ItemState>>({});

  const tmpl = ROLE_TEMPLATES[role];

  const stats = useMemo(() => {
    const total = tmpl.items.length;
    const verified = tmpl.items.filter((i) => state[i.key] === 'verified').length;
    const added = tmpl.items.filter((i) => state[i.key] === 'added').length;
    const done = verified + added;
    const pct = total ? Math.round((done / total) * 100) : 0;
    return { total, verified, added, pct };
  }, [tmpl.items, state]);

  function cycle(key: string) {
    setState((s) => {
      const cur = s[key] || 'missing';
      const next: ItemState = cur === 'missing' ? 'added' : cur === 'added' ? 'verified' : 'missing';
      return { ...s, [key]: next };
    });
  }

  return (
    <section className="px-6 py-12">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div>
            <h1 className="text-4xl font-semibold">Credential Checklist</h1>
            <p className="mt-2 text-muted-foreground text-lg">
              Contextual "pre-loaded" requirements for your wallet — without CIM-style centralization.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as RoleKey)}
              className="px-4 py-3 rounded-2xl border bg-background"
              aria-label="Select role"
            >
              {Object.entries(ROLE_TEMPLATES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-8 p-6 border rounded-3xl">
          <div className="flex items-center justify-between gap-6">
            <div className="text-xl font-semibold">Completion</div>
            <div className="text-muted-foreground">
              {stats.pct}% • {stats.verified} verified • {stats.added} added • {stats.total - (stats.verified + stats.added)} missing
            </div>
          </div>
          <div className="mt-4 h-3 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-foreground" style={{ width: `${stats.pct}%` }} />
          </div>
        </div>

        <div className="mt-8 grid md:grid-cols-2 gap-6">
          {tmpl.items.map((i) => {
            const s = state[i.key] || 'missing';
            return (
              <button
                key={i.key}
                onClick={() => cycle(i.key)}
                className="text-left p-8 border rounded-3xl hover:shadow-xl transition"
                title="Click to cycle: missing → added → verified"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-2xl font-semibold">{i.label}</div>
                    <div className="mt-2 text-muted-foreground text-lg">{i.description}</div>
                    <div className="mt-4 text-sm text-muted-foreground">
                      {i.required ? 'Required' : 'Optional'} • Status: <span className="font-medium text-foreground">{s.toUpperCase()}</span>
                    </div>
                  </div>
                  <div className="px-3 py-1 rounded-full border text-sm">
                    {s.toUpperCase()}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <p className="mt-8 text-sm text-muted-foreground">
          Next wave can wire this checklist into real trust-state + artifact generation.
        </p>
      </div>
    </section>
  );
}
