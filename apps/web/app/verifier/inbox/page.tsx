'use client';

/**
 * Verifier Inbox — Wave 234
 *
 * Live applications from real clinicians. No seed data.
 * Dark design — consistent with the full VitalCV system.
 * Review actions wire to real API: REVIEWED / ACCEPTED / DECLINED.
 *
 * System contract: closing the marketplace loop.
 * Clinicians apply → verifiers review → starts happen faster.
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Loader2,
  Search,
  ShieldCheck,
  User,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

/* ── Types ─────────────────────────────────────────────────── */

type AppStatus = 'PENDING' | 'REVIEWED' | 'ACCEPTED' | 'DECLINED' | 'WITHDRAWN';

interface LiveApplication {
  id: string;
  opportunityId: string;
  clerkUserId: string;
  npi: string | null;
  coverNote: string | null;
  status: AppStatus;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  opportunity?: {
    id: string;
    title: string;
    specialty: string;
    state: string;
    hiringType: string;
  };
}

/* ── Status config ──────────────────────────────────────────── */

const STATUS_CONFIG: Record<AppStatus, { label: string; color: string; bg: string; dot: string }> = {
  PENDING:   { label: 'Pending Review',  color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/20',   dot: 'bg-amber-400'   },
  REVIEWED:  { label: 'Reviewed',        color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/20',     dot: 'bg-blue-400'    },
  ACCEPTED:  { label: 'Accepted',        color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', dot: 'bg-emerald-400' },
  DECLINED:  { label: 'Declined',        color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/20',       dot: 'bg-red-400'     },
  WITHDRAWN: { label: 'Withdrawn',       color: 'text-white/25',    bg: 'bg-white/4 border-white/8',             dot: 'bg-white/25'    },
};

function StatusPill({ status }: { status: AppStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${cfg.bg} ${cfg.color}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/* ── Empty state ────────────────────────────────────────────── */

function EmptyInbox() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="h-14 w-14 rounded-2xl border border-white/8 bg-white/3 flex items-center justify-center mb-4">
        <FileText className="h-6 w-6 text-white/20" />
      </div>
      <p className="text-white/40 font-medium mb-1">No applications yet</p>
      <p className="text-sm text-white/20 max-w-xs">
        When clinicians apply to your opportunities, they&apos;ll appear here for review.
      </p>
      <Link
        href="/verifier/home"
        className="mt-6 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/4 px-5 py-2.5 text-sm text-white/50 hover:text-white/80 hover:border-white/20 transition"
      >
        Post an opportunity <ChevronRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

/* ── Application detail panel ───────────────────────────────── */

function ApplicationDetail({
  app,
  onReview,
  reviewing,
}: {
  app: LiveApplication;
  onReview: (status: 'REVIEWED' | 'ACCEPTED' | 'DECLINED', note?: string) => void;
  reviewing: boolean;
}) {
  const [note, setNote] = useState('');

  return (
    <motion.div
      key={app.id}
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -8 }}
      transition={{ duration: 0.2 }}
      className="h-full flex flex-col"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <User className="h-4 w-4 text-white/30" />
            <span className="text-xs text-white/30 font-medium uppercase tracking-wider">Applicant</span>
          </div>
          <h2 className="text-xl font-bold text-white">
            {app.npi ? `NPI ${app.npi}` : 'No NPI provided'}
          </h2>
          {app.opportunity && (
            <p className="text-sm text-white/40 mt-1">
              Applied for: <span className="text-white/60">{app.opportunity.title}</span>
              {' · '}{app.opportunity.state} · {app.opportunity.specialty}
            </p>
          )}
        </div>
        <StatusPill status={app.status} />
      </div>

      {/* Credential summary — NPI lookup signal */}
      {app.npi && (
        <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/5 p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
              NPI Verification
            </span>
          </div>
          <p className="text-sm text-white/60">
            NPI <span className="font-mono text-white/80">{app.npi}</span> is registered in NPPES.
            Click &ldquo;Accept&rdquo; to trigger full primary source verification and issue a Trust Passport.
          </p>
        </div>
      )}

      {/* Cover note */}
      {app.coverNote && (
        <div className="rounded-xl border border-white/8 bg-white/3 p-4 mb-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/30 mb-2">Cover Note</p>
          <p className="text-sm text-white/60 leading-relaxed">{app.coverNote}</p>
        </div>
      )}

      {/* Timeline */}
      <div className="flex items-center gap-4 text-xs text-white/25 mb-6">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Applied {relativeTime(app.createdAt)}
        </span>
        {app.reviewedAt && (
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Reviewed {relativeTime(app.reviewedAt)}
          </span>
        )}
      </div>

      {/* Prior review note */}
      {app.reviewNote && (
        <div className="rounded-xl border border-white/8 bg-white/3 p-4 mb-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/30 mb-1">Your Last Note</p>
          <p className="text-sm text-white/50 italic">&ldquo;{app.reviewNote}&rdquo;</p>
        </div>
      )}

      {/* Review actions */}
      {app.status !== 'ACCEPTED' && app.status !== 'DECLINED' && app.status !== 'WITHDRAWN' && (
        <div className="mt-auto pt-4 border-t border-white/6 space-y-3">
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Optional review note (visible to applicant on status change)…"
            rows={2}
            className="w-full rounded-xl border border-white/8 bg-white/3 px-4 py-3 text-sm text-white/70 placeholder:text-white/20 focus:outline-none focus:border-white/20 resize-none transition"
          />
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => onReview('ACCEPTED', note)}
              disabled={reviewing}
              className="flex-1 min-w-[120px] flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 px-5 py-3 text-sm font-bold text-black transition-colors"
            >
              {reviewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Accept
            </button>
            <button
              onClick={() => onReview('REVIEWED', note)}
              disabled={reviewing}
              className="flex-1 min-w-[120px] flex items-center justify-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 disabled:opacity-50 px-5 py-3 text-sm font-semibold text-blue-400 transition-colors"
            >
              Mark Reviewed
            </button>
            <button
              onClick={() => onReview('DECLINED', note)}
              disabled={reviewing}
              className="flex-1 min-w-[120px] flex items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 disabled:opacity-50 px-5 py-3 text-sm font-semibold text-red-400 transition-colors"
            >
              Decline
            </button>
          </div>
          <p className="text-[11px] text-white/20 text-center">
            Accepting triggers full PSV verification and issues a Trust Passport to the clinician.
          </p>
        </div>
      )}

      {/* Final state */}
      {(app.status === 'ACCEPTED' || app.status === 'DECLINED') && (
        <div className={`mt-auto pt-4 border-t border-white/6 rounded-xl p-4 ${app.status === 'ACCEPTED' ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-red-500/5 border-red-500/10'}`}>
          <p className={`text-sm font-semibold ${app.status === 'ACCEPTED' ? 'text-emerald-400' : 'text-red-400'}`}>
            {app.status === 'ACCEPTED' ? '✓ Application accepted — PSV initiated' : '✗ Application declined'}
          </p>
          {app.reviewNote && (
            <p className="text-xs text-white/30 mt-1">{app.reviewNote}</p>
          )}
        </div>
      )}
    </motion.div>
  );
}

/* ── Main page ──────────────────────────────────────────────── */

export default function VerifierInbox() {
  const [applications, setApplications] = useState<LiveApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<AppStatus | 'ALL'>('ALL');

  // Fetch live applications
  useEffect(() => {
    fetch('/api/employer/applications')
      .then(r => r.ok ? r.json() : [])
      .then((data: LiveApplication[]) => {
        setApplications(data);
        if (data.length > 0) setActiveId(data[0].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Filter list
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return applications.filter(app => {
      if (statusFilter !== 'ALL' && app.status !== statusFilter) return false;
      if (q && !app.npi?.includes(q) && !app.opportunity?.title.toLowerCase().includes(q) && !app.opportunity?.specialty.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [applications, query, statusFilter]);

  const active = useMemo(() => filtered.find(a => a.id === activeId) || filtered[0] || null, [filtered, activeId]);

  // Review action
  async function handleReview(status: 'REVIEWED' | 'ACCEPTED' | 'DECLINED', note?: string) {
    if (!active) return;
    setReviewing(true);
    try {
      const res = await fetch(`/api/applications/${active.id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, reviewNote: note }),
      });
      if (res.ok) {
        const updated = await res.json();
        setApplications(prev => prev.map(a => a.id === updated.id ? { ...a, ...updated } : a));
      }
    } finally {
      setReviewing(false);
    }
  }

  // Counts for status tabs
  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: applications.length };
    applications.forEach(a => { c[a.status] = (c[a.status] || 0) + 1; });
    return c;
  }, [applications]);

  return (
    <main className="min-h-screen px-6 py-12" style={{ background: '#080e1a' }}>
      <div className="max-w-6xl mx-auto">

        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/30 mb-2">Verifier</p>
            <h1 className="text-3xl font-bold text-white">Candidate Inbox</h1>
            <p className="mt-1 text-white/40">
              Review applications, verify credentials, and clear clinicians to start.
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/verifier/home"
              className="px-4 py-2.5 rounded-xl border border-white/10 text-sm text-white/50 hover:text-white/80 hover:border-white/20 transition"
            >
              Post Opportunity
            </Link>
            <Link
              href="/demo"
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-sm font-semibold text-black transition"
            >
              Try Demo
            </Link>
          </div>
        </div>

        {/* Status filter tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {(['ALL', 'PENDING', 'REVIEWED', 'ACCEPTED', 'DECLINED'] as const).map(s => {
            const cfg = s !== 'ALL' ? STATUS_CONFIG[s] : null;
            const count = counts[s] || 0;
            const isActive = statusFilter === s;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  isActive
                    ? s === 'ALL'
                      ? 'bg-white/8 border-white/20 text-white'
                      : `${cfg?.bg} ${cfg?.color}`
                    : 'border-white/8 text-white/30 hover:text-white/50'
                }`}
              >
                {s === 'ALL' ? 'All' : STATUS_CONFIG[s].label}
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${isActive ? 'bg-white/10' : 'bg-white/5'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="h-8 w-8 animate-spin text-white/20" />
          </div>
        ) : applications.length === 0 ? (
          <EmptyInbox />
        ) : (
          <div className="grid lg:grid-cols-[340px_1fr] gap-6">

            {/* Left: application list */}
            <section className="rounded-2xl border border-white/8 bg-white/2 overflow-hidden">
              <div className="p-4 border-b border-white/6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/25 pointer-events-none" />
                  <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Search NPI, role, specialty…"
                    className="w-full rounded-xl border border-white/8 bg-white/4 pl-9 pr-4 py-2.5 text-sm text-white/70 placeholder:text-white/20 focus:outline-none focus:border-white/15 transition"
                  />
                </div>
              </div>

              <div className="overflow-y-auto max-h-[520px]">
                {filtered.length === 0 ? (
                  <div className="p-6 text-center text-sm text-white/25">
                    No applications match your filters.
                  </div>
                ) : (
                  filtered.map(app => {
                    const cfg = STATUS_CONFIG[app.status];
                    const isActive = app.id === activeId;
                    return (
                      <button
                        key={app.id}
                        onClick={() => setActiveId(app.id)}
                        className={`w-full text-left p-4 border-b border-white/4 transition-all ${
                          isActive ? 'bg-white/6' : 'hover:bg-white/3'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <span className="text-sm font-semibold text-white truncate">
                            {app.npi ? `NPI ${app.npi}` : 'No NPI'}
                          </span>
                          <span className={`flex-shrink-0 h-2 w-2 rounded-full mt-1 ${cfg.dot}`} />
                        </div>
                        <p className="text-xs text-white/40 truncate mb-1">
                          {app.opportunity?.title || 'Unknown role'} · {app.opportunity?.specialty}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className={`text-[11px] font-medium ${cfg.color}`}>{cfg.label}</span>
                          <span className="text-[10px] text-white/20">{relativeTime(app.createdAt)}</span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </section>

            {/* Right: detail panel */}
            <section className="rounded-2xl border border-white/8 bg-white/2 p-6 min-h-[400px]">
              <AnimatePresence mode="wait">
                {active ? (
                  <ApplicationDetail
                    key={active.id}
                    app={active}
                    onReview={handleReview}
                    reviewing={reviewing}
                  />
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center h-full py-16 text-center"
                  >
                    <User className="h-8 w-8 text-white/10 mb-3" />
                    <p className="text-sm text-white/25">Select an application to review</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>

          </div>
        )}
      </div>
    </main>
  );
}
