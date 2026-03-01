'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  MapPin,
  Calendar,
  DollarSign,
  Briefcase,
  CheckCircle2,
  XCircle,
  Sparkles,
  Plus,
  Share2,
  Loader2,
} from 'lucide-react';

import { HolderSubNav } from '@/components/holder/HolderSubNav';
import {
  GlassCard,
  GlassCardHeader,
  GlassCardContent,
  GlassCardFooter,
} from '@/components/ui/glass-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  Types (mirror API response)                                        */
/* ------------------------------------------------------------------ */

interface MatchedRequirement {
  key: string;
  label: string;
  priority: 'required' | 'preferred';
  met: boolean;
  reason: string;
}

interface JobPosting {
  id: string;
  title: string;
  facility: string;
  location: string;
  department: string;
  compensation: string;
  startDate: string;
  postedAt: string;
}

interface OpportunityMatch {
  job: JobPosting;
  matchConfidence: number;
  matchBand: 'CLEAR' | 'PARTIAL' | 'INELIGIBLE';
  requirementResults: MatchedRequirement[];
  missingCredentials: string[];
  metCount: number;
  totalRequired: number;
}

interface MatchaResponse {
  npi: string;
  clinician: { name: string; specialty: string; credentialCount: number };
  totalOpportunities: number;
  clearToStart: number;
  opportunities: OpportunityMatch[];
  generatedAt: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  '';

const DEMO_NPI = '1003000126';

const BAND_STYLES = {
  CLEAR: {
    border: 'border-l-[var(--trust-green)]',
    badge: 'trust-green' as const,
    glow: 'shadow-[0_0_20px_var(--trust-green)/15]',
  },
  PARTIAL: {
    border: 'border-l-[var(--trust-yellow)]',
    badge: 'trust-yellow' as const,
    glow: '',
  },
  INELIGIBLE: {
    border: 'border-l-[var(--trust-red)]',
    badge: 'trust-red' as const,
    glow: '',
  },
} as const;

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function OpportunitiesPage() {
  const [data, setData] = useState<MatchaResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const base = API_BASE.endsWith('/') ? API_BASE.slice(0, -1) : API_BASE;
        const res = await fetch(`${base}/api/matcha/opportunities/${DEMO_NPI}`);
        if (!res.ok) throw new Error(`API returned ${res.status}`);
        const json: MatchaResponse = await res.json();
        setData(json);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load opportunities');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-slate-100">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <HolderSubNav />

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Sparkles className="h-7 w-7 text-[var(--trust-green)]" />
            <h1 className="text-3xl font-bold text-gray-900">Opportunities</h1>
          </div>
          {data && (
            <p className="text-lg text-gray-600">
              {data.clearToStart} of {data.totalOpportunities} positions ready to apply
              {data.clinician && (
                <span className="text-gray-400"> — {data.clinician.name}, {data.clinician.specialty}</span>
              )}
            </p>
          )}
          {!data && !loading && (
            <p className="text-lg text-gray-600">
              Positions matched to your verified credentials
            </p>
          )}
        </div>

        {/* States */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-3 text-muted-foreground">Matching credentials to openings…</span>
          </div>
        )}

        {error && (
          <GlassCard className="border-[var(--trust-red)]/20">
            <GlassCardContent>
              <p className="text-sm text-[var(--trust-red)]">
                Unable to load opportunities: {error}
              </p>
            </GlassCardContent>
          </GlassCard>
        )}

        {/* Opportunity Cards */}
        {data && (
          <div className="flex flex-col gap-5">
            {data.opportunities.map((match, i) => (
              <OpportunityCard key={match.job.id} match={match} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  OpportunityCard                                                    */
/* ------------------------------------------------------------------ */

function OpportunityCard({
  match,
  index,
}: {
  match: OpportunityMatch;
  index: number;
}) {
  const { job, matchConfidence, matchBand, requirementResults, missingCredentials } = match;
  const style = BAND_STYLES[matchBand];
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <GlassCard
        className={cn(
          'border-l-4',
          style.border,
          style.glow,
          matchBand === 'CLEAR' && 'ring-1 ring-[var(--trust-green)]/10',
        )}
      >
        <GlassCardHeader>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant={style.badge} className="text-xs">
                {matchConfidence}% Match
              </Badge>
              {matchBand === 'CLEAR' && (
                <Badge variant="trust-green" className="text-xs gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Clear to Start
                </Badge>
              )}
            </div>
            <h3 className="text-xl font-semibold text-foreground truncate">
              {job.title}
            </h3>
            <p className="text-sm font-medium text-muted-foreground">{job.facility}</p>
          </div>
        </GlassCardHeader>

        <GlassCardContent>
          {/* Job details row */}
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground mb-4">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> {job.location}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Briefcase className="h-3.5 w-3.5" /> {job.department}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5" /> {job.compensation}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" /> Start {new Date(job.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>

          {/* Missing credentials warning (PARTIAL/INELIGIBLE) */}
          {matchBand !== 'CLEAR' && missingCredentials.length > 0 && (
            <div className="rounded-xl bg-[var(--trust-yellow)]/8 border border-[var(--trust-yellow)]/20 px-4 py-3 mb-4">
              <p className="text-sm font-medium text-[var(--trust-yellow)] mb-2">
                Missing Requirements
              </p>
              <div className="flex flex-wrap gap-2">
                {requirementResults
                  .filter((r) => !r.met && r.priority === 'required')
                  .map((r) => (
                    <Badge key={r.key} variant="trust-yellow" className="text-xs gap-1">
                      <XCircle className="h-3 w-3" />
                      {r.label}
                    </Badge>
                  ))}
              </div>
            </div>
          )}

          {/* Expandable requirement checklist */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? 'Hide' : 'Show'} requirement details ({match.metCount}/{match.totalRequired} met)
          </button>

          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-3 space-y-1.5"
            >
              {requirementResults.map((r) => (
                <div key={r.key} className="flex items-center gap-2 text-sm">
                  {r.met ? (
                    <CheckCircle2 className="h-4 w-4 text-[var(--trust-green)] shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-[var(--trust-red)] shrink-0" />
                  )}
                  <span className={cn(
                    r.met ? 'text-foreground' : 'text-muted-foreground',
                  )}>
                    {r.label}
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {r.priority === 'preferred' && '(preferred)'}
                  </span>
                </div>
              ))}
            </motion.div>
          )}
        </GlassCardContent>

        <GlassCardFooter>
          {matchBand === 'CLEAR' ? (
            <Button className="gap-2 bg-[var(--trust-green)] hover:bg-[var(--trust-green)]/90 text-white">
              <Share2 className="h-4 w-4" />
              1-Click Apply (Share VC)
            </Button>
          ) : (
            <Button variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              Add Missing Credential
            </Button>
          )}
        </GlassCardFooter>
      </GlassCard>
    </motion.div>
  );
}
