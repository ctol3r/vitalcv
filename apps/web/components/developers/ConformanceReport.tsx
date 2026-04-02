'use client';

/**
 * ConformanceReport.tsx — Wave 114: Standards Conformance Report Panel
 *
 * Shows:
 * - Run conformance suite on demand
 * - Per-check results with spec references
 * - Last passing tests summary
 * - Receipt examples (issuance / presentation / verification)
 */

import { useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getApiBase } from '@/lib/api';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FileText,
  Loader2,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// ── Types ─────────────────────────────────────────────────────────────

type CheckStatus = 'PASS' | 'FAIL' | 'WARN' | 'SKIP';

interface ConformanceCheck {
  id: string;
  name: string;
  spec: string;
  status: CheckStatus;
  detail: string;
  durationMs: number;
}

interface ConformanceSummary {
  total: number;
  passed: number;
  failed: number;
  warned: number;
  skipped: number;
}

interface ConformanceReport {
  reportId: string;
  version: string;
  generatedAt: string;
  summary: ConformanceSummary;
  checks: ConformanceCheck[];
  overallCompliant: boolean;
}

interface AuditReceipt {
  receiptId: string;
  type: 'ISSUANCE' | 'PRESENTATION' | 'VERIFICATION';
  status: 'SUCCESS' | 'FAILED' | 'PARTIAL';
  issuedAt: string;
  hash: string;
  summary: string;
  actor: string;
  subject: string;
  payload: Record<string, unknown>;
}

// ── Visual helpers ────────────────────────────────────────────────────

const STATUS_CONFIG: Record<CheckStatus, { icon: typeof CheckCircle2; color: string; bg: string; label: string }> = {
  PASS: { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', label: 'Pass' },
  FAIL: { icon: XCircle,      color: 'text-red-600',     bg: 'bg-red-50 border-red-200',         label: 'Fail' },
  WARN: { icon: AlertTriangle,color: 'text-amber-600',   bg: 'bg-amber-50 border-amber-200',     label: 'Warn' },
  SKIP: { icon: ChevronRight, color: 'text-slate-400',   bg: 'bg-slate-50 border-slate-200',     label: 'Skip' },
};

const RECEIPT_TYPE_COLOR = {
  ISSUANCE:     'text-blue-600 bg-blue-50 border-blue-200',
  PRESENTATION: 'text-purple-600 bg-purple-50 border-purple-200',
  VERIFICATION: 'text-emerald-600 bg-emerald-50 border-emerald-200',
};

// ── Component ─────────────────────────────────────────────────────────

export function ConformanceReport({ className = '' }: { className?: string }) {
  const [report, setReport]       = useState<ConformanceReport | null>(null);
  const [receipts, setReceipts]   = useState<AuditReceipt[]>([]);
  const [loading, setLoading]     = useState(false);
  const [loadingReceipts, setLoadingReceipts] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [expandedCheck, setExpandedCheck] = useState<string | null>(null);

  const base = getApiBase();

  const runReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${base}/api/conformance/report`);
      const data = await r.json() as ConformanceReport & { error?: string };
      if (!r.ok) throw new Error(data.error ?? `HTTP ${r.status}`);
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run conformance suite');
    } finally {
      setLoading(false);
    }
  }, [base]);

  const fetchReceipts = useCallback(async () => {
    setLoadingReceipts(true);
    try {
      const r = await fetch(`${base}/api/audit/receipts?limit=6`);
      const data = await r.json() as { receipts: AuditReceipt[]; error?: string };
      if (!r.ok) throw new Error(data.error ?? `HTTP ${r.status}`);
      setReceipts(data.receipts.slice(0, 6));
    } catch {
      // silently fail — receipts may not exist yet
    } finally {
      setLoadingReceipts(false);
    }
  }, [base]);

  const handleRunAll = useCallback(async () => {
    await Promise.all([runReport(), fetchReceipts()]);
  }, [runReport, fetchReceipts]);

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div className={`rounded-2xl border border-infra-border bg-white overflow-hidden shadow-sm ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-4 border-b border-infra-border bg-infra-surface">
        <ShieldCheck className="h-5 w-5 text-infra-blue" />
        <h2 className="font-bold text-foreground">Conformance & Audit</h2>
        <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
          Wave 114
        </span>
      </div>

      <div className="px-5 py-4 space-y-5">
        {/* Run button */}
        <div className="flex items-center gap-3">
          <Button onClick={() => void handleRunAll()} disabled={loading} className="gap-1.5">
            {loading
              ? <><Loader2 className="h-4 w-4 animate-spin" />Running Suite…</>
              : <><RefreshCw className="h-4 w-4" />Run Conformance Suite</>
            }
          </Button>
          {report && (
            <div className={`flex items-center gap-1.5 text-sm font-semibold ${report.overallCompliant ? 'text-emerald-600' : 'text-red-600'}`}>
              {report.overallCompliant
                ? <CheckCircle2 className="h-4 w-4" />
                : <XCircle className="h-4 w-4" />
              }
              {report.overallCompliant ? 'Fully Compliant' : 'Non-Compliant'}
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2.5 border border-red-200">
            <XCircle className="h-4 w-4 flex-shrink-0" />{error}
          </div>
        )}

        {/* Conformance Report */}
        <AnimatePresence>
          {report && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {/* Summary pills */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'Passed',  value: report.summary.passed,  color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
                  { label: 'Failed',  value: report.summary.failed,  color: 'text-red-600 bg-red-50 border-red-200' },
                  { label: 'Warned',  value: report.summary.warned,  color: 'text-amber-600 bg-amber-50 border-amber-200' },
                  { label: 'Total',   value: report.summary.total,   color: 'text-slate-600 bg-slate-50 border-slate-200' },
                ].map(({ label, value, color }) => (
                  <div key={label} className={`rounded-xl border px-3 py-2 text-center ${color}`}>
                    <p className="text-lg font-bold">{value}</p>
                    <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70">{label}</p>
                  </div>
                ))}
              </div>

              <p className="text-xs text-muted-foreground">
                Report <span className="font-mono">{report.reportId.slice(0, 12)}…</span> · Generated {new Date(report.generatedAt).toLocaleString()} · Spec set v{report.version}
              </p>

              {/* Checks list */}
              <div className="space-y-1.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <ClipboardList className="h-3.5 w-3.5" />Checks
                </h3>
                {report.checks.map((check) => {
                  const cfg = STATUS_CONFIG[check.status];
                  const Icon = cfg.icon;
                  const isExpanded = expandedCheck === check.id;
                  return (
                    <div
                      key={check.id}
                      className={`rounded-xl border overflow-hidden ${cfg.bg}`}
                    >
                      <button
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:brightness-95 transition-all"
                        onClick={() => setExpandedCheck(isExpanded ? null : check.id)}
                      >
                        <Icon className={`h-4 w-4 flex-shrink-0 ${cfg.color}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-foreground">{check.name}</span>
                            <span className="text-[9px] font-mono text-muted-foreground">{check.id}</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{check.spec}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-[10px] text-muted-foreground">{check.durationMs}ms</span>
                          {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="px-3 pb-3">
                          <p className="text-xs text-foreground font-mono bg-white/70 rounded-lg px-3 py-2 border border-border">
                            {check.detail}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Audit Receipts */}
        {(receipts.length > 0 || loadingReceipts) && (
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />Recent Audit Receipts
              {loadingReceipts && <Loader2 className="h-3 w-3 animate-spin" />}
            </h3>
            <div className="space-y-1.5">
              {receipts.map((receipt) => (
                <div key={receipt.receiptId} className={`rounded-xl border px-3 py-2.5 ${RECEIPT_TYPE_COLOR[receipt.type]}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">{receipt.type}</span>
                      <span className="text-[9px] font-mono opacity-70">{receipt.receiptId.slice(0, 10)}…</span>
                    </div>
                    <span className="text-[9px] font-semibold">{receipt.status}</span>
                  </div>
                  <p className="text-[10px] mt-1 opacity-80 line-clamp-1">{receipt.summary}</p>
                  <p className="text-[9px] font-mono mt-1 opacity-50 break-all line-clamp-1">{receipt.hash}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {!report && !loading && (
          <div className="text-center py-8 text-muted-foreground">
            <ShieldCheck className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-semibold">Run the conformance suite</p>
            <p className="text-xs mt-1">Verifies OID4VCI, OID4VP, SD-JWT, HAIP, trust registry & revocation</p>
          </div>
        )}
      </div>
    </div>
  );
}
