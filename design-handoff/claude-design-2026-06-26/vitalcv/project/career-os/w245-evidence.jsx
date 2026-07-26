// W245 · D2 — Evidence experience (/career/evidence)
// Verified · Expiring · Missing · Recent. The evidence behind the career, by status.

function EvidenceStat({ value, label, tone, Icon: I }) {
  const t = { emerald: 'text-emerald-700', amber: 'text-amber-700', indigo: 'text-indigo-700', slate: 'text-slate-900' }[tone];
  return (
    <div className="flex items-center gap-3 px-5 py-4 border-r border-slate-200 last:border-r-0 flex-1 min-w-[140px]">
      <I size={18} className={cn('flex-shrink-0', t)} />
      <div>
        <div className="text-[22px] font-semibold text-slate-900 leading-none tabular-nums">{value}</div>
        <div className="mono text-[9px] uppercase tracking-[0.12em] text-slate-400 mt-1">{label}</div>
      </div>
    </div>
  );
}

const STATUS_META = {
  current:   { label: 'Current',   chip: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', bar: 'bg-emerald-500' },
  expiring:  { label: 'Expiring',  chip: 'bg-amber-50 text-amber-800 ring-amber-600/20',       bar: 'bg-amber-500' },
  expired:   { label: 'Expired',   chip: 'bg-rose-50 text-rose-700 ring-rose-600/20',          bar: 'bg-rose-500' },
  evergreen: { label: 'Evergreen', chip: 'bg-slate-100 text-slate-600 ring-slate-300',         bar: 'bg-slate-400' },
};

function ViewEvidence({ entity }) {
  const creds = window.CREDENTIALS;
  const events = window.EVENTS;
  const sources = window.EVIDENCE_SOURCES;
  const missing = window.MISSING_EVIDENCE;
  const expiring = creds.filter(c => c.status === 'expiring').sort((a, b) => a.monthsLeft - b.monthsLeft);
  const verifiedEvents = events.filter(e => e.dir !== 'down');
  const recent = [...window.TRUST_HISTORY].slice(0, 6);
  const h = computeHealth();

  return (
    <div className="max-w-[1340px] mx-auto px-6 py-9 space-y-9">
      {/* Header */}
      <div className="rise">
        <Eyebrow className="mb-2">Career OS · Evidence</Eyebrow>
        <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-slate-900 leading-tight">What evidence stands behind this career</h1>
        <p className="text-[13px] text-slate-600 leading-[1.6] max-w-[80ch] mt-2">
          Every credential, license, and event sorted by its evidentiary status. <span className="text-slate-900 font-medium">{h.evidenceComplete}% of source lanes are open and verified</span> — the rest are either gated by an institution or a deliberate next step.
        </p>
        <div className="mt-5 border border-slate-200 rounded-lg bg-white flex flex-wrap">
          <EvidenceStat value={creds.filter(c => c.status !== 'expired').length} label="Verified credentials" tone="emerald" Icon={Icon.ShieldCheck} />
          <EvidenceStat value={expiring.length} label="Expiring < 12mo" tone="amber" Icon={Icon.Clock} />
          <EvidenceStat value={missing.length} label="Missing / gated" tone="indigo" Icon={Icon.Lock} />
          <EvidenceStat value={`${h.verifiedSources}/${h.totalSources}`} label="Source lanes open" tone="slate" Icon={Icon.Layers} />
        </div>
      </div>

      {/* Verified Evidence — credentials */}
      <section className="rise" style={{ animationDelay: '60ms' }}>
        <SectionHeader n="01" title="Verified evidence" sub="Licenses & certifications, each source-backed and primary-read." right="renewable backbone" />
        <div className="border border-slate-200 rounded-lg bg-white overflow-hidden divide-y divide-slate-100">
          {creds.map(c => {
            const sm = STATUS_META[c.status];
            const src = sources.find(s => s.id === c.source);
            return (
              <div key={c.id} className="px-5 py-3.5 flex items-center gap-4 flex-wrap">
                <div className="h-9 w-9 rounded-md bg-slate-50 ring-1 ring-inset ring-slate-200 flex items-center justify-center flex-shrink-0">
                  <Icon.Badge size={16} className="text-slate-700" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-semibold text-slate-900">{c.label}</span>
                    <span className="mono text-[10.5px] text-slate-500">{c.number}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{c.kind} · {c.authority}</div>
                </div>
                <div className="hidden md:block text-right">
                  <div className="mono text-[10px] text-slate-400 uppercase tracking-[0.1em]">Source</div>
                  <div className="text-[11.5px] text-slate-700 mt-0.5">{src ? `${src.label} · ${src.tier}` : '—'}</div>
                </div>
                <div className="text-right min-w-[110px]">
                  <div className="mono text-[10px] text-slate-400 uppercase tracking-[0.1em]">Expires</div>
                  <div className="text-[11.5px] text-slate-700 mt-0.5">{c.expires ? fmtMonth(c.expires) : 'No expiry'}</div>
                </div>
                <span className={cn('mono text-[9px] uppercase tracking-[0.1em] font-medium rounded-full ring-1 ring-inset px-2 py-1 flex-shrink-0', sm.chip)}>{sm.label}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Expiring + Missing side by side */}
      <section className="rise grid lg:grid-cols-2 gap-6" style={{ animationDelay: '120ms' }}>
        {/* Expiring */}
        <div>
          <SectionHeader n="02" title="Expiring evidence" sub="Freshness windows closing — renew before they lapse." right={`${expiring.length} within 12mo`} />
          <div className="space-y-3">
            {expiring.map(c => {
              const pct = Math.max(6, Math.min(100, (c.monthsLeft / 12) * 100));
              return (
                <div key={c.id} className="border border-slate-200 rounded-lg bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[13px] font-semibold text-slate-900">{c.label}</span>
                    <span className="mono text-[11px] text-amber-700 tabular-nums flex-shrink-0">{c.monthsLeft}mo left</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{c.authority} · expires {fmtMonth(c.expires)}</div>
                  <div className="mt-2.5 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            <div className="border border-dashed border-slate-200 rounded-lg px-4 py-3 text-[11.5px] text-slate-500 flex items-center gap-2">
              <Icon.Info size={14} className="text-slate-400 flex-shrink-0" />
              The engine re-queries each source before its window closes — these are flagged for your awareness, not yet overdue.
            </div>
          </div>
        </div>

        {/* Missing */}
        <div>
          <SectionHeader n="03" title="Missing evidence" sub="Gaps that gate roles or would strengthen the profile." right={`${missing.length} items`} />
          <div className="space-y-3">
            {missing.map(m => {
              const meta = TRUST_META[m.state] || TRUST_META.unknown;
              return (
                <div key={m.id} className="border border-slate-200 rounded-lg bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[13px] font-semibold text-slate-900 leading-tight">{m.label}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{m.impact}</div>
                    </div>
                    <Chip state={m.state} size="sm" />
                  </div>
                  <p className="text-[11.5px] text-slate-500 leading-snug mt-2.5">{m.detail}</p>
                  <div className="mt-2.5 flex items-center justify-between gap-2">
                    <span className="mono text-[10px] text-slate-900">{m.unlocks}</span>
                    <span className="text-[10.5px] text-slate-400 inline-flex items-center gap-1"><Icon.User size={11} />{m.owner}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Recent evidence activity */}
      <section className="rise" style={{ animationDelay: '180ms' }}>
        <SectionHeader n="04" title="Recent evidence" sub="The latest reads and corroborations against primary sources." right="last 30 days" />
        <div className="border border-slate-200 rounded-lg bg-white divide-y divide-slate-100">
          {recent.map((r, i) => {
            const tone = { ok: 'bg-emerald-500', warn: 'bg-amber-500', info: 'bg-indigo-500', muted: 'bg-slate-300' }[r.tone];
            return (
              <div key={i} className="px-5 py-3 flex items-start gap-3">
                <span className={cn('h-2 w-2 rounded-full mt-1.5 flex-shrink-0', tone)} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[12px] font-medium text-slate-900">{r.source}</span>
                    <span className="mono text-[9px] uppercase tracking-[0.1em] text-slate-400">{r.kind}</span>
                    <span className="mono text-[10px] text-slate-400 ml-auto tabular-nums">{r.t}</span>
                  </div>
                  <p className="text-[12px] text-slate-600 leading-snug mt-0.5">{r.msg}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

window.ViewEvidence = ViewEvidence;
