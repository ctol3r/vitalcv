'use client';

/**
 * MirofishPanel — Advisory recommendation panel for employer review screen.
 *
 * ISOLATION RULES (enforced at render time):
 *   - Renders only when NEXT_PUBLIC_MIROFISH_ENABLED=true
 *   - Never shows a green check or "verified" status
 *   - Always shows the disclaimer verbatim
 *   - Output is clearly separated from the trust section above it
 *
 * Wave MF2 — Employer Review Integration
 */

import type { PassportData } from '@/app/passport/[id]/page';
import {
  isMirofishEnabled,
  simulateDecision,
  RECOMMENDATION_CONFIG,
  type MirofishContext,
  type MirofishResult,
} from '@/lib/mirofish/mirofishEngine';
import { ChevronDown, ChevronUp, FlaskConical } from 'lucide-react';
import { useMemo, useState } from 'react';

interface Props {
  passport: PassportData;
  context?: MirofishContext;
}

function ownerLabel(owner: 'CLINICIAN' | 'EMPLOYER' | 'BOTH'): string {
  if (owner === 'CLINICIAN') return 'Clinician action';
  if (owner === 'EMPLOYER')  return 'Employer action';
  return 'Joint action';
}

function severityOpacity(s: 'HIGH' | 'MEDIUM' | 'LOW'): string {
  if (s === 'HIGH')   return 'text-white/55';
  if (s === 'MEDIUM') return 'text-white/40';
  return 'text-white/30';
}

export default function MirofishPanel({ passport, context }: Props) {
  const [expanded, setExpanded] = useState(false);

  const enabled = isMirofishEnabled();
  if (!enabled) return null;

  // Pure computation — no side effects on trust layer
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const result: MirofishResult = useMemo(
    () => simulateDecision(passport, context ?? {}),
    [passport, context],
  );

  const cfg = RECOMMENDATION_CONFIG[result.recommendation];

  return (
    <section
      aria-label="MiroFish advisory recommendation"
      className="rounded-2xl border border-white/8 bg-white/2 px-5 py-4 space-y-4"
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-3.5 h-3.5 text-white/25" aria-hidden />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/25">
            MiroFish · Advisory only
          </span>
        </div>
        <span className="text-[10px] text-white/20">
          {result.simulationVersion}
        </span>
      </div>

      {/* ── Recommendation ─────────────────────────────────────────────────── */}
      <div className={`rounded-xl border ${cfg.border} bg-white/3 px-4 py-3`}>
        <p className={`text-sm font-semibold ${cfg.opacity}`}>{cfg.label}</p>
        <p className="text-white/35 text-xs mt-0.5 leading-relaxed">{cfg.detail}</p>

        {/* Reasoning lines */}
        {result.reasoning.length > 0 && (
          <ul className="mt-2 space-y-0.5">
            {result.reasoning.map((line, i) => (
              <li key={i} className="text-white/30 text-xs flex items-start gap-1.5">
                <span className="text-white/15 shrink-0">·</span>
                {line}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Confidence ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-white/25">
          Advisory confidence: <span className="text-white/40">{result.confidence}</span>
        </span>
        {result.totalEstimatedDays > 0 && (
          <span className="text-white/25">
            ~{result.totalEstimatedDays}d to clear
          </span>
        )}
      </div>

      {/* ── Expandable detail ──────────────────────────────────────────────── */}
      {(result.risks.length > 0 || result.fastestPath.length > 0) && (
        <>
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            className="w-full flex items-center justify-between text-white/30 text-xs py-1 border-t border-white/5 hover:text-white/50 transition-colors"
          >
            <span>{expanded ? 'Hide detail' : 'View risks and fastest path'}</span>
            {expanded
              ? <ChevronUp className="w-3.5 h-3.5" />
              : <ChevronDown className="w-3.5 h-3.5" />
            }
          </button>

          {expanded && (
            <div className="space-y-4 pt-1">
              {/* Risks */}
              {result.risks.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-white/20 mb-2">
                    Identified risks
                  </p>
                  <div className="space-y-1.5">
                    {result.risks.map((risk, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className={`text-xs shrink-0 ${severityOpacity(risk.severity)}`}>
                          {risk.severity === 'HIGH' ? '!' : risk.severity === 'MEDIUM' ? '·' : '–'}
                        </span>
                        <div>
                          <span className={`text-xs ${severityOpacity(risk.severity)}`}>
                            {risk.area}: {risk.description}
                          </span>
                          {!risk.mitigable && (
                            <span className="text-white/20 text-xs ml-1">(unresolvable)</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Fastest path */}
              {result.fastestPath.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-white/20 mb-2">
                    Fastest path to start-ready
                  </p>
                  <ol className="space-y-2">
                    {result.fastestPath.map((step) => (
                      <li key={step.step} className="flex items-start gap-3">
                        <span className="text-white/15 text-xs w-4 shrink-0 text-right">
                          {step.step}.
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-white/50 text-xs">{step.action}</span>
                            {step.blocksStart && (
                              <span className="text-white/25 text-[10px] border border-white/10 px-1.5 py-0 rounded-full">
                                blocks start
                              </span>
                            )}
                          </div>
                          <div className="text-white/20 text-xs mt-0.5">
                            {ownerLabel(step.owner)} · ~{step.estimatedDays}d
                            {step.notes ? ` · ${step.notes}` : ''}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Mandatory disclaimer — always visible ──────────────────────────── */}
      <p className="text-white/20 text-[10px] leading-relaxed border-t border-white/5 pt-3">
        {result.disclaimer}
        {' '}Generated {new Date(result.generatedAt).toLocaleTimeString()}.
        Not sourced from live data — reflects current passport snapshot only.
      </p>
    </section>
  );
}
