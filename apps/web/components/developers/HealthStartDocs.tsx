'use client';

/**
 * HealthStartDocs.tsx — Wave 118: HealthStart Control Inheritance
 *
 * Developer portal panel showing inherited controls by deployment profile,
 * with evidence references and NIST/HIPAA mappings.
 */

import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Shield, CheckCircle, AlertCircle, Lock, FileText, Server } from 'lucide-react';

type DeploymentProfile = 'SaaS' | 'PrivateVPC' | 'GovEnclave';

interface InheritedControl {
  id: string;
  family: string;
  name: string;
  description: string;
  status: 'INHERITED' | 'SHARED' | 'CUSTOMER_RESPONSIBILITY' | 'NOT_APPLICABLE';
  maturity: 'IMPLEMENTED' | 'PLANNED' | 'PARTIAL' | 'NOT_STARTED';
  nistMapping: string[];
  hipaaMapping: string[];
  evidence: string;
  automatedValidation: boolean;
}

interface ControlReport {
  profileType: string;
  generatedAt: string;
  totalControls: number;
  inherited: number;
  shared: number;
  customerResponsibility: number;
  controls: InheritedControl[];
}

const base = () =>
  ((typeof process !== 'undefined'
    ? process.env.NEXT_PUBLIC_API_BASE ?? process.env.NEXT_PUBLIC_BACKEND_URL
    : '') ?? '').replace(/\/$/, '');

const STATUS_COLORS: Record<string, string> = {
  INHERITED: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  SHARED: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  CUSTOMER_RESPONSIBILITY: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  NOT_APPLICABLE: 'text-zinc-500 bg-zinc-800 border-zinc-700',
};

const PROFILE_META: Record<DeploymentProfile, { icon: React.ReactNode; label: string; desc: string }> = {
  SaaS: { icon: <Server className="h-3.5 w-3.5" />, label: 'SaaS', desc: 'Multi-tenant cloud' },
  PrivateVPC: { icon: <Lock className="h-3.5 w-3.5" />, label: 'Private VPC', desc: 'Single-tenant isolated' },
  GovEnclave: { icon: <Shield className="h-3.5 w-3.5" />, label: 'Gov Enclave', desc: 'Air-gapped / FedRAMP' },
};

export function HealthStartDocs() {
  const [profile, setProfile] = useState<DeploymentProfile>('SaaS');
  const [report, setReport] = useState<ControlReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedFamily, setExpandedFamily] = useState<string | null>(null);

  const fetchControls = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${base()}/api/healthstart/controls?profile=${profile}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setReport(await r.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load controls');
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => { fetchControls(); }, [fetchControls]);

  const families = report ? [...new Set(report.controls.map((c) => c.family))] : [];

  return (
    <div className="rounded-2xl border border-white/8 bg-slate-900/40 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-4 w-4 text-emerald-400" />
          <div>
            <h3 className="text-sm font-semibold text-white">HealthStart Control Inheritance</h3>
            <p className="text-xs text-slate-500">Inherited security controls by deployment profile</p>
          </div>
        </div>
        <button onClick={fetchControls} className="text-slate-600 hover:text-white transition-colors">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Profile Selector */}
      <div className="px-6 py-3 border-b border-white/5 flex gap-2">
        {(Object.keys(PROFILE_META) as DeploymentProfile[]).map((p) => (
          <button
            key={p}
            onClick={() => setProfile(p)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border transition-colors ${
              profile === p
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                : 'border-white/8 text-slate-400 hover:bg-white/[0.04]'
            }`}
          >
            {PROFILE_META[p].icon}
            <span>{PROFILE_META[p].label}</span>
          </button>
        ))}
      </div>

      {error && (
        <div className="px-6 py-3 text-xs text-red-400">{error}</div>
      )}

      {report && (
        <div className="p-6 space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Inherited', value: report.inherited, color: 'text-emerald-400' },
              { label: 'Shared', value: report.shared, color: 'text-blue-400' },
              { label: 'Customer', value: report.customerResponsibility, color: 'text-amber-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl border border-white/8 bg-slate-950/60 p-3 text-center">
                <p className={`text-xl font-bold ${color}`}>{value}</p>
                <p className="text-[10px] text-slate-600 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Controls by Family */}
          <div className="space-y-2">
            {families.map((family) => {
              const controls = report.controls.filter((c) => c.family === family);
              const isExpanded = expandedFamily === family;
              return (
                <div key={family} className="rounded-xl border border-white/8 overflow-hidden">
                  <button
                    onClick={() => setExpandedFamily(isExpanded ? null : family)}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-slate-300">
                        {family.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[10px] text-slate-600">{controls.length} controls</span>
                    </div>
                    <span className="text-[10px] text-slate-600">{isExpanded ? '▾' : '▸'}</span>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-white/5 divide-y divide-white/5">
                      {controls.map((c) => (
                        <div key={c.id} className="px-4 py-3 space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              {c.automatedValidation ? (
                                <CheckCircle className="h-3 w-3 text-emerald-400 shrink-0" />
                              ) : (
                                <AlertCircle className="h-3 w-3 text-amber-400 shrink-0" />
                              )}
                              <span className="text-xs font-medium text-white">{c.name}</span>
                              <span className="text-[9px] font-mono text-slate-600">{c.id}</span>
                            </div>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded border ${STATUS_COLORS[c.status]}`}>
                              {c.status.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 pl-5">{c.description}</p>
                          <div className="flex items-center gap-3 pl-5 text-[9px]">
                            <span className="text-slate-600">NIST: <span className="text-slate-400">{c.nistMapping.join(', ')}</span></span>
                            <span className="text-slate-600">HIPAA: <span className="text-slate-400">{c.hipaaMapping.join(', ')}</span></span>
                          </div>
                          <div className="pl-5 flex items-center gap-1.5">
                            <FileText className="h-2.5 w-2.5 text-slate-700" />
                            <span className="text-[9px] text-slate-600 font-mono">{c.evidence}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* SSP Evidence Download */}
          <div className="rounded-xl border border-white/8 bg-slate-950/40 p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-white">System Security Plan Evidence Pack</p>
              <p className="text-[10px] text-slate-500">Auto-generated from live system state for {PROFILE_META[profile].label}</p>
            </div>
            <a
              href={`${base()}/api/healthstart/ssp?profile=${profile}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-300 hover:bg-emerald-500/20 transition-colors"
            >
              <FileText className="h-3 w-3" />
              View SSP
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
