'use client';

/**
 * ComplianceCopilot.tsx — Wave 157: Compliance Co-Pilot UI
 *
 * Right-rail panel for the Command Center showing:
 *   - NPI + state + facility input
 *   - Readiness badge (READY / PARTIAL / NOT_READY)
 *   - Findings with severity indicators
 *   - Citations with source references
 *   - Confidence score + traceId
 *   - Copy report action
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, CheckCircle, AlertTriangle, XCircle, Copy,
  Search, FileText, ExternalLink,
} from 'lucide-react';
import { getApiBase } from '@/lib/api';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Finding {
  ruleId: string;
  requirement: string;
  status: 'MET' | 'NOT_MET' | 'PARTIAL' | 'WAIVED';
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  detail: string;
  citation: string;
  credentialEvidence?: string;
}

interface Citation {
  source: string;
  section: string;
  text: string;
  url?: string;
}

interface ComplianceResult {
  npi: string;
  targetState: string;
  targetFacility: string;
  readiness: 'READY' | 'PARTIAL' | 'NOT_READY' | 'UNKNOWN';
  confidence: number;
  findings: Finding[];
  citations: Citation[];
  traceId: string;
  checkedAt: string;
  ruleVersion: string;
}

type LoadState = 'idle' | 'loading' | 'done' | 'error';

// ── Readiness config ───────────────────────────────────────────────────────────

const readinessConfig = {
  READY:     { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', label: 'Ready' },
  PARTIAL:   { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', label: 'Partial' },
  NOT_READY: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', label: 'Not Ready' },
  UNKNOWN:   { icon: Shield, color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/20', label: 'Unknown' },
};

const severityConfig = {
  CRITICAL: { icon: XCircle, color: 'text-red-400' },
  WARNING:  { icon: AlertTriangle, color: 'text-amber-400' },
  INFO:     { icon: CheckCircle, color: 'text-emerald-400' },
};

const statusColors = {
  MET: 'text-emerald-400',
  NOT_MET: 'text-red-400',
  PARTIAL: 'text-amber-400',
  WAIVED: 'text-slate-400',
};

// ── Component ──────────────────────────────────────────────────────────────────

export default function ComplianceCopilot() {
  const [npi, setNpi] = useState('');
  const [state, setState] = useState('CA');
  const [facility, setFacility] = useState('hospital');
  const [result, setResult] = useState<ComplianceResult | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const base = getApiBase();

  const runCheck = useCallback(async () => {
    if (!npi.trim()) return;
    setLoadState('loading');
    setErrorMsg('');
    try {
      const res = await fetch(`${base}/api/ai/compliance-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ npi: npi.trim(), targetState: state, targetFacility: facility }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string };
        setErrorMsg(err.error ?? `HTTP ${res.status}`);
        setLoadState('error');
        return;
      }
      const data = await res.json() as ComplianceResult;
      setResult(data);
      setLoadState('done');
    } catch {
      setErrorMsg('Network error');
      setLoadState('error');
    }
  }, [base, npi, state, facility]);

  const copyReport = useCallback(() => {
    if (!result) return;
    const report = [
      `VitalCV Compliance Report`,
      `NPI: ${result.npi}`,
      `State: ${result.targetState} | Facility: ${result.targetFacility}`,
      `Readiness: ${result.readiness} (confidence: ${Math.round(result.confidence * 100)}%)`,
      `Trace ID: ${result.traceId}`,
      `Checked: ${result.checkedAt}`,
      `Rule Version: ${result.ruleVersion}`,
      '',
      '--- Findings ---',
      ...result.findings.map((f) => `[${f.status}] ${f.requirement} — ${f.detail} (${f.citation})`),
      '',
      '--- Citations ---',
      ...result.citations.map((c) => `${c.source}: ${c.text}`),
    ].join('\n');
    navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [result]);

  const readiness = result ? readinessConfig[result.readiness] : null;
  const ReadinessIcon = readiness?.icon ?? Shield;

  return (
    <div className="rounded-2xl border border-infra-border bg-infra-surface overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-infra-border flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-violet-400 shadow-[0_0_6px_#a78bfa]" />
        <span className="text-sm font-semibold text-infra-text">Compliance Co-Pilot</span>
        <span className="text-xs text-infra-muted ml-1">Wave 157</span>
      </div>

      <div className="p-4 space-y-4">
        {/* Input form */}
        <div className="space-y-3">
          <div>
            <label className="text-xs text-infra-muted block mb-1">NPI</label>
            <input
              type="text"
              value={npi}
              onChange={(e) => setNpi(e.target.value)}
              placeholder="1234567890"
              className="w-full px-3 py-2 rounded-lg bg-infra-bg border border-infra-border text-sm text-infra-text placeholder-infra-muted/40 focus:outline-none focus:border-violet-500/50"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-infra-muted block mb-1">State</label>
              <select
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-infra-bg border border-infra-border text-sm text-infra-text focus:outline-none focus:border-violet-500/50"
              >
                {['CA', 'NY', 'TX', 'FL', 'IL', 'PA', 'OH'].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-infra-muted block mb-1">Facility</label>
              <select
                value={facility}
                onChange={(e) => setFacility(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-infra-bg border border-infra-border text-sm text-infra-text focus:outline-none focus:border-violet-500/50"
              >
                {['hospital', 'clinic', 'telehealth', 'surgery-center'].map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={runCheck}
            disabled={!npi.trim() || loadState === 'loading'}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 text-sm font-medium hover:bg-violet-500/20 transition-colors disabled:opacity-50"
          >
            <Search className="h-4 w-4" />
            {loadState === 'loading' ? 'Checking…' : 'Run Compliance Check'}
          </button>
        </div>

        {/* Error */}
        {loadState === 'error' && errorMsg && (
          <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {errorMsg}
          </div>
        )}

        {/* Results */}
        <AnimatePresence mode="wait">
          {result && (
            <motion.div
              key={result.traceId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-4"
            >
              {/* Readiness badge */}
              <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${readiness?.bg}`}>
                <ReadinessIcon className={`h-5 w-5 ${readiness?.color}`} />
                <div>
                  <div className={`text-sm font-bold ${readiness?.color}`}>{readiness?.label}</div>
                  <div className="text-xs text-infra-muted">
                    Confidence: {Math.round(result.confidence * 100)}%
                  </div>
                </div>
                <div className="ml-auto text-right">
                  <div className="text-[10px] text-infra-muted font-mono">{result.traceId.slice(0, 8)}</div>
                  <div className="text-[10px] text-infra-muted/60">
                    {new Date(result.checkedAt).toLocaleTimeString()}
                  </div>
                </div>
              </div>

              {/* Findings */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-infra-muted uppercase tracking-wider">Findings</div>
                {result.findings.map((f) => {
                  const sev = severityConfig[f.severity];
                  const SevIcon = sev.icon;
                  return (
                    <div key={f.ruleId} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-infra-bg border border-infra-border">
                      <SevIcon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${sev.color}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-infra-text font-medium">{f.requirement}</span>
                          <span className={`text-[10px] font-semibold ${statusColors[f.status]}`}>{f.status}</span>
                        </div>
                        <div className="text-[11px] text-infra-muted mt-0.5">{f.detail}</div>
                        <div className="text-[10px] text-infra-muted/50 mt-1 flex items-center gap-1">
                          <FileText className="h-2.5 w-2.5" />
                          {f.citation}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Citations */}
              {result.citations.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-infra-muted uppercase tracking-wider">Citations</div>
                  {result.citations.map((c, i) => (
                    <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-infra-bg/50 border border-infra-border/50">
                      <ExternalLink className="h-3 w-3 mt-0.5 text-infra-muted/50 shrink-0" />
                      <div>
                        <div className="text-xs text-infra-text font-medium">{c.source}</div>
                        <div className="text-[11px] text-infra-muted">{c.section}: {c.text}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Copy report */}
              <button
                onClick={copyReport}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-infra-bg border border-infra-border text-xs text-infra-muted hover:text-infra-text hover:border-violet-500/30 transition-colors"
              >
                <Copy className="h-3 w-3" />
                {copied ? '✓ Copied to clipboard' : 'Copy Report'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
