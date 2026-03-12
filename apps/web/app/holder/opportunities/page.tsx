'use client';

/**
 * Wave 239 — Holder Opportunities (Live)
 * /holder/opportunities — Personalized matched opportunities for the active clinician
 *
 * Fetches NPI from /api/me/workspaces (same pattern as holder/page.tsx)
 * Fetches live matches from /api/matcha/opportunities/:npi (proxy → backend liveMatchaService)
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ShieldCheck, Zap, ChevronRight, Lock,
  Building2, MapPin, DollarSign, Loader2, AlertCircle,
} from 'lucide-react';

/* ── API shapes ────────────────────────────────────────────────── */

type MatchBand = 'CLEAR' | 'NEAR_CLEAR' | 'PARTIAL' | 'INELIGIBLE';

interface LiveMatch {
  opportunityId: string;
  band: MatchBand;
  score: number;
  blockers: { label: string; action?: string }[];
  fitReasons: string[];
}

interface MatchaResponse {
  npi: string;
  clinicianName: string;
  specialty: string;
  state: string;
  matches: LiveMatch[];
  profileCompleteness: {
    level: string;
    missingForHigherMatches: string[];
  };
  generatedAt: string;
}

type WorkspaceProfile = {
  npi?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

/* ── Band config ───────────────────────────────────────────────── */

const BAND_CONFIG: Record<MatchBand, { label: string; color: string }> = {
  CLEAR:      { label: 'Clear to Start', color: 'bg-green-500/15 text-green-400 ring-1 ring-green-500/30' },
  NEAR_CLEAR: { label: 'Almost Ready',   color: 'bg-yellow-500/15 text-yellow-400 ring-1 ring-yellow-500/30' },
  PARTIAL:    { label: 'Partial Match',  color: 'bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/30' },
  INELIGIBLE: { label: 'Not Eligible',   color: 'bg-white/5 text-white/30 ring-1 ring-white/10' },
};

/* ── Component ─────────────────────────────────────────────────── */

type Phase = 'loading_profile' | 'loading_matches' | 'ready' | 'no_npi' | 'error';

export default function HolderOpportunitiesPage() {
  const [phase, setPhase] = useState<Phase>('loading_profile');
  const [npi, setNpi] = useState<string | null>(null);
  const [data, setData] = useState<MatchaResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Step 1: Load NPI from workspace profile
  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch('/api/me/workspaces');
        if (!res.ok) { setPhase('error'); setErrorMsg('Failed to load profile'); return; }
        const json = await res.json() as { personProfile?: WorkspaceProfile | null };
        const pp = json.personProfile;
        if (pp?.npi) {
          setNpi(pp.npi);
          setPhase('loading_matches');
        } else {
          setPhase('no_npi');
        }
      } catch {
        setPhase('error');
        setErrorMsg('Network error loading profile');
      }
    }
    void loadProfile();
  }, []);

  // Step 2: Load matches once NPI is available
  useEffect(() => {
    if (!npi || phase !== 'loading_matches') return;
    async function loadMatches() {
      try {
        const res = await fetch(`/api/matcha/opportunities/${npi}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({})) as { error?: string };
          setErrorMsg(err.error ?? 'Failed to load matches');
          setPhase('error');
          return;
        }
        const json = await res.json() as MatchaResponse;
        setData(json);
        setPhase('ready');
      } catch {
        setPhase('error');
        setErrorMsg('Network error loading opportunities');
      }
    }
    void loadMatches();
  }, [npi, phase]);

  /* ── Loading ── */
  if (phase === 'loading_profile' || phase === 'loading_matches') {
    return (
      <div className="min-h-screen bg-ops-gradient flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-7 w-7 text-white/40 animate-spin" />
          <p className="text-sm text-white/40">
            {phase === 'loading_profile' ? 'Loading your profile…' : 'Fetching matched opportunities…'}
          </p>
        </div>
      </div>
    );
  }

  /* ── No NPI — prompt setup ── */
  if (phase === 'no_npi') {
    return (
      <div className="min-h-screen bg-ops-gradient flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-white/5 border border-white/10 mx-auto">
            <ShieldCheck className="h-7 w-7 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">Set up your trust passport</h1>
            <p className="text-white/60 text-sm leading-relaxed">
              Verify your NPI to see matched opportunities. Takes 2 minutes.
            </p>
          </div>
          <Link
            href="/get-ready"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-7 py-3.5 text-sm font-semibold text-black transition w-full justify-center"
          >
            Verify my NPI <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  /* ── Error ── */
  if (phase === 'error') {
    return (
      <div className="min-h-screen bg-ops-gradient flex items-center justify-center px-6">
        <div className="max-w-sm text-center space-y-4">
          <AlertCircle className="h-8 w-8 text-red-400 mx-auto" />
          <p className="text-white font-medium">Couldn&apos;t load opportunities</p>
          <p className="text-sm text-white/50">{errorMsg ?? 'An unexpected error occurred.'}</p>
          <button
            onClick={() => {
              setPhase(npi ? 'loading_matches' : 'loading_profile');
              setErrorMsg(null);
            }}
            className="rounded-lg border border-white/20 px-5 py-2 text-sm text-white/60 hover:text-white transition"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  /* ── Ready — render live data ── */
  const matches = data?.matches ?? [];
  const clearCount = matches.filter(m => m.band === 'CLEAR').length;
  const nearClearCount = matches.filter(m => m.band === 'NEAR_CLEAR').length;
  const isEmpty = matches.length === 0;

  return (
    <div className="min-h-screen bg-ops-gradient text-white surface-operator">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="mb-8">
          <nav className="flex items-center gap-2 text-xs text-white/40 mb-4">
            <Link href="/holder/home" className="hover:text-white/70">Clinician Home</Link>
            <span>/</span>
            <span className="text-white/60">My Opportunities</span>
          </nav>
          <h1 className="heading-xl font-bold text-white">My Matched Opportunities</h1>
          <p className="text-white/60 mt-2">
            Ranked by your verified credential state — not just your resume.
            {data?.clinicianName && (
              <span className="ml-2 text-white/40 text-sm">({data.clinicianName} · {data.specialty})</span>
            )}
          </p>
        </div>

        {/* Stats */}
        {!isEmpty && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center">
              <p className="text-2xl font-bold text-green-400">{clearCount}</p>
              <p className="text-xs text-white/50 mt-1">Clear to Start</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center">
              <p className="text-2xl font-bold text-yellow-400">{nearClearCount}</p>
              <p className="text-xs text-white/50 mt-1">Almost Ready</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center">
              <p className="text-2xl font-bold text-blue-400">{matches.length}</p>
              <p className="text-xs text-white/50 mt-1">Total Matches</p>
            </div>
          </div>
        )}

        {/* Empty state */}
        {isEmpty && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center mb-8">
            <ShieldCheck className="w-10 h-10 mx-auto mb-4 text-white/20" />
            <p className="text-white/60 mb-1">No opportunities matched yet.</p>
            <p className="text-sm text-white/40">
              Upload credentials to improve your match score.
            </p>
            <Link
              href="/documents"
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors"
            >
              Upload Credentials <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {/* Matched opportunities */}
        {!isEmpty && (
          <div className="space-y-4 mb-10">
            {matches.map(match => {
              const bandCfg = BAND_CONFIG[match.band] ?? BAND_CONFIG.PARTIAL;
              return (
                <div key={match.opportunityId} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start gap-3 flex-wrap">
                      <h3 className="font-semibold text-white">Opportunity</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${bandCfg.color}`}>
                        {bandCfg.label}
                      </span>
                    </div>
                    <p className="text-sm text-white/50 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {data?.state ?? '—'}
                    </p>
                    {match.fitReasons.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {match.fitReasons.slice(0, 3).map(r => (
                          <span key={r} className="px-2 py-0.5 rounded-full text-xs bg-green-500/10 text-green-400 ring-1 ring-green-500/20">
                            ✓ {r}
                          </span>
                        ))}
                      </div>
                    )}
                    {match.blockers.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {match.blockers.slice(0, 2).map(b => (
                          <p key={b.label} className="text-xs text-yellow-400/80">⚠ {b.label}</p>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 min-w-[140px]">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-white">{match.score}</p>
                      <p className="text-xs text-white/40">match score</p>
                    </div>
                    <Link
                      href={`/opportunities/${match.opportunityId}`}
                      className="flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-vt-success text-black text-sm font-semibold hover:bg-vt-success/90 transition-colors"
                    >
                      View <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Profile completeness hint */}
        {data?.profileCompleteness?.missingForHigherMatches?.length ? (
          <div className="rounded-2xl border border-blue-500/20 bg-blue-900/10 p-6 flex items-start gap-4">
            <Lock className="w-6 h-6 text-blue-400 flex-shrink-0 mt-1" />
            <div className="flex-1">
              <h3 className="font-semibold text-white">Unlock better matches</h3>
              <p className="text-sm text-white/60 mt-1">
                Adding the following credentials can improve your match score:{' '}
                <span className="text-white/80">
                  {data.profileCompleteness.missingForHigherMatches.join(', ')}
                </span>
              </p>
              <Link
                href="/get-ready"
                className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors"
              >
                Complete Prequalification <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        ) : null}

        {/* Explore more */}
        <div className="mt-6 text-center">
          <Link href="/explore" className="text-sm text-white/40 hover:text-white/70 transition-colors flex items-center justify-center gap-1">
            <Building2 className="w-3.5 h-3.5" /> Browse all opportunities
          </Link>
        </div>
      </div>
    </div>
  );
}
