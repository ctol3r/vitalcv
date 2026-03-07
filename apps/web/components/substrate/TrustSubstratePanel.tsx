'use client';

/**
 * TrustSubstratePanel — Phase 6: Operator Control Surface
 *
 * Displays the full L0–L3 substrate trust state for a clinician NPI/DID.
 * Polls GET /api/trust/substrate/:subject
 */

import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, ShieldCheck, ShieldAlert, ShieldX, Shield } from 'lucide-react';
import { getApiBase } from '@/lib/api';

interface IssuerTrustDetail {
  issuerId: string;
  issuerName: string;
  trustLevel: string;
  trustScore: number;
  haipCompliant: boolean;
  status: string;
}

interface CredentialRisk {
  credentialId: string;
  issuer: string;
  status: string;
  revoked: boolean;
  expired: boolean;
  haipViolations: Array<{ rule: string; severity: string }>;
  verificationErrors: string[];
}

interface SubstrateTrustResult {
  subject: string;
  band: 'L0' | 'L1' | 'L2' | 'L3';
  bandLabel: string;
  explanation: string;
  issuerTrust: IssuerTrustDetail[];
  credentialRisk: CredentialRisk[];
  revocationState: { revokedCount: number; hasActiveRevocations: boolean };
  haipCompliance: { compliant: boolean; violations: Array<{ rule: string; severity: string; detail: string }> };
  federationTrustHealth: { healthScore: number; totalEntities: number; degradedEntities: string[] };
  computedAt: string;
}

const BAND_CONFIG = {
  L3: { icon: ShieldCheck, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', label: 'Authoritative' },
  L2: { icon: Shield,      color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/30',       label: 'Trusted' },
  L1: { icon: ShieldAlert, color: 'text-amber-400',   bg: 'bg-amber-500/10 border-amber-500/30',     label: 'Provisional' },
  L0: { icon: ShieldX,     color: 'text-red-400',     bg: 'bg-red-500/10 border-red-500/30',         label: 'Untrusted' },
};

interface Props {
  subject: string;
  pollIntervalMs?: number;
}

export function TrustSubstratePanel({ subject, pollIntervalMs = 30_000 }: Props) {
  const [data, setData] = useState<SubstrateTrustResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const base = getApiBase();

  const fetch_ = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${base}/api/trust/substrate/${encodeURIComponent(subject)}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData(await r.json());
      setLastUpdated(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [base, subject]);

  useEffect(() => {
    fetch_();
    const iv = setInterval(fetch_, pollIntervalMs);
    return () => clearInterval(iv);
  }, [fetch_, pollIntervalMs]);

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/[0.05] p-4 text-sm text-red-400">
        {error}
        <button onClick={fetch_} className="ml-3 underline text-xs">Retry</button>
      </div>
    );
  }

  if (!data && loading) {
    return <div className="animate-pulse h-40 rounded-xl bg-white/[0.03]" />;
  }

  if (!data) return null;

  const band = BAND_CONFIG[data.band];
  const BandIcon = band.icon;

  return (
    <div className="space-y-3">
      {/* Band header */}
      <div className={`flex items-center gap-3 rounded-xl border p-4 ${band.bg}`}>
        <BandIcon className={`h-8 w-8 ${band.color}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-lg font-bold ${band.color}`}>{data.band}</span>
            <span className="text-sm text-zinc-300 font-medium">{data.bandLabel}</span>
            {loading && <RefreshCw className="h-3 w-3 text-zinc-600 animate-spin" />}
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">{data.explanation}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-zinc-600">Computed</p>
          <p className="text-[10px] text-zinc-500">{new Date(data.computedAt).toLocaleTimeString()}</p>
        </div>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Credentials', value: data.credentialRisk.length, warn: false },
          { label: 'Revoked', value: data.revocationState.revokedCount, warn: data.revocationState.hasActiveRevocations },
          { label: 'HAIP Issues', value: data.haipCompliance.violations.length, warn: !data.haipCompliance.compliant },
          { label: 'Fed Score', value: `${data.federationTrustHealth.healthScore}%`, warn: data.federationTrustHealth.healthScore < 80 },
        ].map(({ label, value, warn }) => (
          <div key={label} className={`rounded-lg border p-2.5 text-center ${warn ? 'border-amber-500/30 bg-amber-500/[0.05]' : 'border-zinc-800 bg-white/[0.02]'}`}>
            <p className={`text-base font-bold ${warn ? 'text-amber-400' : 'text-zinc-200'}`}>{value}</p>
            <p className="text-[10px] text-zinc-600 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Issuer trust table */}
      {data.issuerTrust.length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-white/[0.01] overflow-hidden">
          <div className="px-3 py-2 border-b border-zinc-800">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Issuer Trust</p>
          </div>
          <div className="divide-y divide-zinc-800/60">
            {data.issuerTrust.map((issuer) => (
              <div key={issuer.issuerId} className="flex items-center gap-3 px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-zinc-300 truncate">{issuer.issuerName}</p>
                  <p className="text-[10px] text-zinc-600">{issuer.trustLevel}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold ${issuer.trustScore >= 80 ? 'text-emerald-400' : issuer.trustScore >= 60 ? 'text-blue-400' : 'text-red-400'}`}>
                    {issuer.trustScore}
                  </span>
                  <span className={`text-[10px] ${issuer.haipCompliant ? 'text-emerald-500' : 'text-amber-500'}`}>
                    {issuer.haipCompliant ? 'HAIP ✓' : 'HAIP ✗'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* HAIP violations */}
      {data.haipCompliance.violations.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-3">
          <p className="text-[10px] text-amber-400 uppercase tracking-wider mb-2">HAIP Violations</p>
          <div className="space-y-1">
            {data.haipCompliance.violations.map((v, i) => (
              <div key={i} className="text-xs text-zinc-400">
                <span className={`font-mono mr-2 ${v.severity === 'CRITICAL' ? 'text-red-400' : 'text-amber-400'}`}>{v.rule}</span>
                {v.detail}
              </div>
            ))}
          </div>
        </div>
      )}

      {lastUpdated && (
        <p className="text-[9px] text-zinc-700 text-right">
          Last updated {lastUpdated.toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
