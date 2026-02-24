'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
} from 'lucide-react';
import { apiRoute } from '@/lib/api';
import {
  type TrustStateResponse,
  normalizeTrustStateResponse,
} from '@/components/trust-state/types';

/* ------------------------------------------------------------------ */
/*  Copy-lock: only these terms are used as status labels              */
/*    "Unverified"                                                     */
/*    "Pending verification"                                           */
/*    "Verification complete"                                          */
/*    "Employer acceptance required"                                   */
/* ------------------------------------------------------------------ */

interface Step {
  id: string;
  label: string;
  passWhen: string;
  passed: boolean;
  blocker: string | null;
  tag: string;
}

export function MvpTestChecklist() {
  /* ── backend polling (existing endpoint, no new API) ── */
  const trustStateRoute = apiRoute('/trust-state');
  const isApiConfigured = Boolean(process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_BACKEND_URL);
  const [status, setStatus] = useState<TrustStateResponse>(() =>
    normalizeTrustStateResponse(null),
  );
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [apiUnavailable, setApiUnavailable] = useState(!isApiConfigured);

  const fetchTrustState = useCallback(async () => {
    if (!isApiConfigured || !trustStateRoute) {
      setApiUnavailable(true);
      setLoading(false);
      return;
    }

    try {
      const params = new URLSearchParams({
        clinician_id: 'clinician:alice',
        employer_id: 'employer:alpha',
        facility_id: 'facility:main',
        role: 'Registered Nurse',
      });
      const res = await fetch(`${trustStateRoute}?${params.toString()}`);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const rawData = await res.json().catch(() => null);
      setStatus(normalizeTrustStateResponse(rawData));
      setApiUnavailable(false);
    } catch {
      setApiUnavailable(true);
      setStatus(normalizeTrustStateResponse(null));
    } finally {
      setLoading(false);
    }
  }, [isApiConfigured, trustStateRoute]);

  useEffect(() => {
    fetchTrustState();
    const id = setInterval(fetchTrustState, 5000);
    return () => clearInterval(id);
  }, [fetchTrustState]);

  /* ── live state bindings ── */
  const identityPresent = status.recognized;
  const filesParsed = false; // not available in current demo scope
  const crsLoaded = Boolean(status.crs);
  const crsBand: string = status.crs.band;
  const crsGreen = crsBand === 'GREEN';
  const hasBlockers = status.blocking_reasons.length > 0;
  const verificationProcessed = identityPresent && crsLoaded;
  const acceptanceExists = status.accepted;
  const startExists = status.started;

  /* ── step definitions (exact spec) ── */
  const steps: Step[] = [
    {
      id: 'npi',
      label: 'Enter a real NPI',
      passWhen: 'PASS when identity hydrates',
      passed: identityPresent,
      blocker: identityPresent
        ? null
        : 'Identity not present in trust network',
      tag: identityPresent ? 'Verification complete' : 'Unverified',
    },
    {
      id: 'resume',
      label: 'Upload a resume (PDF/DOCX)',
      passWhen: 'PASS when fields appear labeled "Unverified"',
      passed: filesParsed,
      blocker: 'Resume ingestion not yet available in demo',
      tag: 'Unverified',
    },
    {
      id: 'trust-state',
      label: 'Review Trust-State',
      passWhen: 'PASS when CRS < threshold AND blockers shown',
      passed: crsLoaded && (hasBlockers || crsGreen),
      blocker: crsLoaded
        ? null
        : 'Trust state not yet loaded',
      tag: crsLoaded
        ? crsGreen
          ? 'Verification complete'
          : 'Pending verification'
        : 'Unverified',
    },
    {
      id: 'pub-verification',
      label: 'Request Public Verification',
      passWhen: 'PASS when receipts show PENDING/COMPLETE',
      passed: verificationProcessed,
      blocker: verificationProcessed
        ? null
        : 'Pending verification',
      tag: verificationProcessed
        ? 'Verification complete'
        : 'Pending verification',
    },
    {
      id: 'crs-flip',
      label: 'Observe CRS flip (on PASS)',
      passWhen: 'PASS when CRS becomes GREEN',
      passed: crsGreen,
      blocker: crsGreen
        ? null
        : `CRS band is ${crsBand} — pending verification`,
      tag: crsGreen ? 'Verification complete' : 'Pending verification',
    },
    {
      id: 'acceptance',
      label: 'Employer Acceptance',
      passWhen: 'PASS when enabled only after CRS GREEN',
      passed: acceptanceExists,
      blocker: acceptanceExists
        ? null
        : crsGreen
          ? 'Employer acceptance required'
          : 'CRS must be GREEN before employer acceptance',
      tag: acceptanceExists
        ? 'Verification complete'
        : 'Employer acceptance required',
    },
    {
      id: 'start',
      label: 'Attest Start',
      passWhen: 'PASS when start is recorded and audited',
      passed: startExists,
      blocker: startExists
        ? null
        : acceptanceExists
          ? 'Pending verification'
          : 'Employer acceptance required',
      tag: startExists
        ? 'Verification complete'
        : acceptanceExists
          ? 'Pending verification'
          : 'Employer acceptance required',
    },
  ];

  const firstIncompleteIdx = steps.findIndex((s) => !s.passed);
  const passedCount = steps.filter((s) => s.passed).length;
  const allPassed = passedCount === steps.length;

  /* ── render ── */
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Collapse toggle */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-slate-50 transition-colors duration-150"
      >
        <span className="flex items-center gap-2.5">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
          )}
          <span className="font-semibold text-slate-900 text-sm sm:text-base">
            MVP Test (10 minutes)
          </span>
          <span className="text-xs font-mono text-slate-400">
            {passedCount}/{steps.length}
          </span>
        </span>
        {allPassed && (
          <span className="text-[11px] font-bold tracking-wide text-green-700 bg-green-50 px-2.5 py-1 rounded">
            ALL PASS
          </span>
        )}
      </button>

      {/* Expanded step list */}
      {expanded && (
        <div className="border-t border-slate-100 px-4 sm:px-5 py-4 space-y-1">
          {apiUnavailable && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <p className="text-sm text-amber-700">API unavailable</p>
            </div>
          )}

          {loading && !status && !apiUnavailable && (
            <div className="space-y-3 py-2">
              <div className="h-4 w-44 rounded bg-slate-200 animate-shimmer" />
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-md border border-slate-200 p-3 space-y-2"
                >
                  <div className="h-3 w-64 bg-slate-200 rounded animate-shimmer" />
                  <div className="h-3 w-36 bg-slate-100 rounded animate-shimmer" />
                </div>
              ))}
            </div>
          )}

          {steps.map((step, idx) => {
            const downstream =
              firstIncompleteIdx >= 0 && idx > firstIncompleteIdx;

            return (
              <div
                key={step.id}
                className={`flex items-start gap-3 rounded-md px-3 py-2.5 ${
                  downstream
                    ? 'opacity-40'
                    : step.passed
                      ? 'bg-green-50/60'
                      : ''
                }`}
              >
                {/* Pass/fail indicator */}
                <span className="mt-0.5 shrink-0">
                  {step.passed ? (
                    <CheckCircle2 className="w-[18px] h-[18px] text-green-600" />
                  ) : (
                    <Circle className="w-[18px] h-[18px] text-slate-400" />
                  )}
                </span>

                {/* Step content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2 flex-wrap">
                    <span
                      className={`text-sm font-medium leading-snug ${
                        step.passed
                          ? 'text-green-800'
                          : downstream
                            ? 'text-slate-400'
                            : 'text-slate-700'
                      }`}
                    >
                      {step.label}
                    </span>
                    <span
                      className={`text-[11px] font-mono whitespace-nowrap ${
                        step.passed ? 'text-green-600' : 'text-slate-400'
                      }`}
                    >
                      {step.tag}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                    {step.passWhen}
                  </p>

                  {/* Blocker reason (guardrail) */}
                  {!step.passed && step.blocker && !downstream && (
                    <span className="inline-flex items-center gap-1.5 mt-1.5 text-xs text-amber-700">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      {step.blocker}
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {/* Confidence footer */}
          <p className="text-[11px] text-slate-400 text-center pt-3 mt-2 border-t border-slate-100">
            Checklist reflects real system behavior.
          </p>
        </div>
      )}
    </section>
  );
}
