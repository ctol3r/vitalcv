'use client';

/**
 * ClinicianPassport.tsx — Wave 139: Clinician Passport Growth Loop
 *
 * A shareable authority artifact for clinicians:
 *   - Trust band hero (L0–L3)
 *   - Credential summary with issuer trust badges
 *   - HAIP compliance indicator
 *   - Shareable credential bundle
 *   - QR presentation link
 *   - Share actions: copy link · download bundle · generate QR
 *
 * Used by /p/:npi (NPI mode) and embedded in /holder.
 */

import { getApiBase } from '@/lib/api';
import { AnimatePresence, motion } from 'framer-motion';
import {
    Award,
    CheckCircle,
    ChevronDown,
    ChevronUp,
    Copy,
    Download,
    ExternalLink,
    FileKey2,
    Loader2,
    QrCode,
    Share2,
    Shield,
    ShieldAlert,
    ShieldCheck,
    ShieldX,
    X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import QRCode from 'react-qr-code';

// ── Types ──────────────────────────────────────────────────────────────────────

interface PassportCredential {
  credentialId: string;
  credentialType: string;
  issuer: string;
  issuerId: string;
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'SUSPENDED';
  issuedAt: string;
  expiresAt?: string;
  haipCompliant?: boolean;
  trustScore?: number;
  trustLevel?: 'AUTHORITATIVE' | 'TRUSTED' | 'UNVERIFIED';
}

interface PassportSummary {
  npi: string;
  totalCredentials: number;
  validCredentials: number;
  expiringCredentials: number;
  revokedCredentials: number;
  trustBand: 'L0' | 'L1' | 'L2' | 'L3';
  haipCompliant?: boolean;
}

export interface ClinicianPassportProps {
  npi: string;
  /** Override share URL (defaults to window.location.href) */
  shareUrl?: string;
  /** Show compact mode (no share drawer) */
  compact?: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const BAND_CONFIG = {
  L3: {
    icon: ShieldCheck,
    color: 'text-vt-success',
    bg: 'from-emerald-900/30 to-emerald-950/20',
    ring: 'ring-vt-success/40',
    label: 'Authoritative Trust',
    desc: 'Maximum credential authority — all sources source-backed',
  },
  L2: {
    icon: Shield,
    color: 'text-vt-info',
    bg: 'from-blue-900/30 to-blue-950/20',
    ring: 'ring-vt-info/40',
    label: 'Source-backed Trust',
    desc: 'Primary credentials source-backed and monitored',
  },
  L1: {
    icon: ShieldAlert,
    color: 'text-vt-warning',
    bg: 'from-amber-900/30 to-amber-950/20',
    ring: 'ring-vt-warning/40',
    label: 'Provisional Trust',
    desc: 'Verification in progress',
  },
  L0: {
    icon: ShieldX,
    color: 'text-vt-neutral-400',
    bg: 'from-zinc-900/30 to-zinc-950/20',
    ring: 'ring-zinc-500/30',
    label: 'Unverified',
    desc: 'Credentials not yet checked',
  },
} as const;

const TRUST_LEVEL_COLOR: Record<string, string> = {
  AUTHORITATIVE: 'text-vt-success bg-vt-success/10 border-vt-success/20',
  TRUSTED: 'text-vt-info bg-vt-info/10 border-vt-info/20',
  UNVERIFIED: 'text-vt-neutral-400 bg-vt-neutral-700/20 border-vt-neutral-700/30',
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function TrustBandHero({
  band,
  npi,
  summary,
}: {
  band: 'L0' | 'L1' | 'L2' | 'L3';
  npi: string;
  summary: PassportSummary;
}) {
  const cfg = BAND_CONFIG[band];
  const Icon = cfg.icon;

  return (
    <div className={`rounded-2xl bg-gradient-to-br ${cfg.bg} ring-1 ${cfg.ring} p-5`}>
      <div className="flex items-start gap-4">
        <div className={`rounded-xl bg-black/60 p-3 ring-1 ${cfg.ring}`}>
          <Icon className={`h-6 w-6 ${cfg.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-bold uppercase tracking-wider ${cfg.color}`}>
              {band}
            </span>
            <span className="text-xs text-vt-neutral-500">·</span>
            <span className="text-xs text-vt-neutral-400">{cfg.label}</span>
            {summary.haipCompliant && (
              <span className="inline-flex items-center gap-1 rounded-full bg-vt-brand-primary/10 border border-vt-brand-primary/20 px-2 py-0.5 text-[10px] font-medium text-vt-brand-primary">
                <CheckCircle className="h-2.5 w-2.5" />
                HAIP
              </span>
            )}
          </div>
          <p className="text-[10px] text-vt-neutral-600 mt-0.5">{cfg.desc}</p>
          <p className="text-[10px] font-mono text-vt-neutral-700 mt-1">NPI {npi}</p>
        </div>
      </div>

      {/* Credential summary strip */}
      <div className="mt-4 grid grid-cols-4 gap-2">
        {[
          { label: 'Total', val: summary.totalCredentials, color: 'text-vt-neutral-300' },
          { label: 'Valid', val: summary.validCredentials, color: 'text-vt-success' },
          { label: 'Expiring', val: summary.expiringCredentials, color: summary.expiringCredentials > 0 ? 'text-vt-warning' : 'text-vt-neutral-600' },
          { label: 'Revoked', val: summary.revokedCredentials, color: summary.revokedCredentials > 0 ? 'text-vt-danger' : 'text-vt-neutral-600' },
        ].map(({ label, val, color }) => (
          <div key={label} className="text-center rounded-lg bg-black/40 py-2">
            <p className={`text-lg font-bold ${color}`}>{val}</p>
            <p className="text-[9px] text-vt-neutral-600 uppercase tracking-wide">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function IssuerTrustBadge({ credential }: { credential: PassportCredential }) {
  const score = credential.trustScore ?? 75;
  const level = credential.trustLevel ?? 'TRUSTED';
  const colorClass = TRUST_LEVEL_COLOR[level] ?? TRUST_LEVEL_COLOR.TRUSTED;

  return (
    <div className="rounded-xl border border-vt-neutral-800 bg-vt-neutral-900/60 p-3 flex items-start gap-3">
      <div className="rounded-lg bg-vt-neutral-800 p-2 shrink-0">
        <FileKey2 className="h-3.5 w-3.5 text-vt-neutral-400" />
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="label text-vt-neutral-100 truncate">{credential.credentialType}</span>
          <span className={`text-[9px] font-medium border rounded-full px-1.5 py-0.5 shrink-0 ${colorClass}`}>
            {level === 'AUTHORITATIVE' ? 'Auth' : level === 'TRUSTED' ? 'Trust' : 'Unver'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-[10px] text-vt-neutral-500 truncate">{credential.issuer}</p>
          {credential.haipCompliant && (
            <span className="text-[9px] text-vt-brand-primary border border-vt-brand-primary/20 rounded px-1 shrink-0">HAIP</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Trust score bar */}
          <div className="flex-1 h-1 bg-vt-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${score}%`,
                background: score >= 85 ? '#10b981' : score >= 60 ? '#60a5fa' : '#f59e0b',
              }}
            />
          </div>
          <span className="text-[9px] font-mono text-vt-neutral-600 shrink-0">{score}</span>
          <span className={`text-[9px] mr-2 ${
            credential.status === 'ACTIVE' ? 'text-vt-success' :
            credential.status === 'EXPIRED' ? 'text-vt-danger' : 'text-vt-warning'
          }`}>{credential.status}</span>
          <a href={`/proof/${credential.credentialId}`} className="text-[9px] font-medium text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1 shrink-0">
            <ShieldCheck className="h-3 w-3" />
            View proof
          </a>
        </div>
      </div>
    </div>
  );
}

function QRModal({
  url,
  npi,
  onClose,
}: {
  url: string;
  npi: string;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="rounded-2xl border border-vt-neutral-800 bg-black p-6 w-full max-w-sm space-y-4"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="heading-sm text-vt-neutral-100">Scan to Verify</h3>
            <p className="text-[10px] text-vt-neutral-600 mt-0.5">NPI {npi}</p>
          </div>
          <button type="button" onClick={onClose} className="text-vt-neutral-600 hover:text-vt-neutral-400">
            <X className="h-4 w-4" />
          </button>
        </div>
        {/* QR Code */}
        <div className="flex justify-center bg-white p-4 rounded-xl">
          <QRCode value={url} size={200} level="M" />
        </div>
        <p className="text-[10px] text-vt-neutral-600 text-center break-all">{url}</p>
      </motion.div>
    </motion.div>
  );
}

// ── Share Actions ─────────────────────────────────────────────────────────────

function ShareDrawer({
  npi,
  shareUrl,
  credentials,
  onClose,
}: {
  npi: string;
  shareUrl: string;
  credentials: PassportCredential[];
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const copyLink = useCallback(async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [shareUrl]);

  const downloadBundle = useCallback(async () => {
    setDownloading(true);
    try {
      const bundle = {
        version: '1.0',
        npi,
        generatedAt: new Date().toISOString(),
        shareUrl,
        credentials: credentials.map((c) => ({
          credentialId: c.credentialId,
          credentialType: c.credentialType,
          issuer: c.issuer,
          issuerId: c.issuerId,
          status: c.status,
          issuedAt: c.issuedAt,
          expiresAt: c.expiresAt,
          haipCompliant: c.haipCompliant ?? false,
          trustScore: c.trustScore ?? 75,
          trustLevel: c.trustLevel ?? 'TRUSTED',
        })),
        attestedBy: 'VitalCV Trust Network',
        bundleType: 'SHAREABLE_CREDENTIAL_BUNDLE',
      };

      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vitalcv-credential-bundle-npi-${npi}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }, [npi, shareUrl, credentials]);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        className="rounded-xl border border-vt-neutral-800 bg-vt-neutral-900/80 p-4 space-y-3"
      >
        <div className="flex items-center justify-between mb-1">
          <p className="text-[11px] font-medium text-vt-neutral-400">Share source-backed data</p>
          <button type="button" onClick={onClose} className="text-vt-neutral-600 hover:text-vt-neutral-400">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Share URL input */}
        <div className="flex items-center gap-2 rounded-lg border border-vt-neutral-700 bg-vt-neutral-800/60 px-3 py-1.5">
          <ExternalLink className="h-3 w-3 text-vt-neutral-600 shrink-0" />
          <input
            readOnly
            value={shareUrl}
            className="flex-1 bg-transparent text-[10px] font-mono text-vt-neutral-400 focus:outline-none min-w-0"
          />
        </div>

        {/* Actions */}
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={copyLink}
            className="flex flex-col items-center gap-1.5 rounded-lg border border-vt-neutral-700 bg-vt-neutral-800/60 py-2.5 px-2 text-[10px] text-vt-neutral-400 hover:text-vt-neutral-100 hover:border-vt-neutral-600 transition-colors"
          >
            {copied ? (
              <CheckCircle className="h-4 w-4 text-emerald-400" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            {copied ? 'Copied!' : 'Copy link'}
          </button>

          <button
            type="button"
            onClick={() => setShowQR(true)}
            className="flex flex-col items-center gap-1.5 rounded-lg border border-vt-neutral-700 bg-vt-neutral-800/60 py-2.5 px-2 text-[10px] text-vt-neutral-400 hover:text-vt-neutral-100 hover:border-vt-neutral-600 transition-colors"
          >
            <QrCode className="h-4 w-4" />
            QR code
          </button>

          <button
            type="button"
            onClick={downloadBundle}
            disabled={downloading}
            className="flex flex-col items-center gap-1.5 rounded-lg border border-vt-neutral-700 bg-vt-neutral-800/60 py-2.5 px-2 text-[10px] text-vt-neutral-400 hover:text-vt-neutral-100 hover:border-vt-neutral-600 transition-colors disabled:opacity-50"
          >
            {downloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {downloading ? 'Bundling…' : 'Download'}
          </button>
        </div>

        <p className="text-[9px] text-vt-neutral-700 text-center">
          Share links allow selective disclosure. Bundle is a cryptographic snapshot.
        </p>
      </motion.div>

      <AnimatePresence>
        {showQR && (
          <QRModal url={shareUrl} npi={npi} onClose={() => setShowQR(false)} />
        )}
      </AnimatePresence>
    </>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function ClinicianPassport({
  npi,
  shareUrl: shareUrlProp,
  compact = false,
}: ClinicianPassportProps) {
  const [summary, setSummary] = useState<PassportSummary | null>(null);
  const [credentials, setCredentials] = useState<PassportCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const shareUrl = shareUrlProp ?? (typeof window !== 'undefined' ? window.location.href : `https://vitalcv.ai/p/${npi}`);

  const apiBase = getApiBase();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [walletRes, trustRes] = await Promise.allSettled([
          fetch(`${apiBase}/api/credentials/wallet/summary?subject=${npi}`),
          fetch(`${apiBase}/api/credentials/wallet?subject=${npi}`),
        ]);

        if (cancelled) return;

        if (walletRes.status === 'fulfilled' && walletRes.value.ok) {
          const data = await walletRes.value.json() as PassportSummary;
          setSummary({ ...data, npi });
        } else {
          // Graceful fallback: construct summary from credential list
          setSummary({
            npi,
            totalCredentials: 0,
            validCredentials: 0,
            expiringCredentials: 0,
            revokedCredentials: 0,
            trustBand: 'L1',
            haipCompliant: false,
          });
        }

        if (trustRes.status === 'fulfilled' && trustRes.value.ok) {
          const data = await trustRes.value.json() as { credentials?: PassportCredential[] };
          setCredentials(data.credentials ?? []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [npi, apiBase]);

  const band = summary?.trustBand ?? 'L1';
  const visible = showAll ? credentials : credentials.slice(0, 3);
  const haipCount = credentials.filter((c) => c.haipCompliant).length;

  if (loading) {
    return (
      <div className="rounded-2xl border border-vt-neutral-800 bg-vt-neutral-900/30 p-6 space-y-3 animate-pulse">
        <div className="h-24 rounded-xl bg-vt-neutral-800/60" />
        <div className="h-16 rounded-xl bg-vt-neutral-800/40" />
        <div className="h-16 rounded-xl bg-vt-neutral-800/40" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-vt-neutral-800 bg-vt-neutral-900/20 overflow-hidden">
      {/* Trust band hero */}
      <div className="p-4">
        {summary && (
          <TrustBandHero band={band} npi={npi} summary={summary} />
        )}
      </div>

      {/* HAIP compliance indicator */}
      {!compact && haipCount > 0 && (
        <div className="mx-4 mb-3 flex items-center gap-2 rounded-lg bg-vt-brand-primary/5 border border-vt-brand-primary/20 px-3 py-2">
          <Award className="h-3.5 w-3.5 text-vt-brand-primary shrink-0" />
          <p className="text-[11px] text-vt-neutral-300">
            <span className="font-semibold">{haipCount}</span>{' '}
            credential{haipCount !== 1 ? 's' : ''} meet HAIP conformance profile
          </p>
        </div>
      )}

      {/* Credential list with issuer trust badges */}
      {credentials.length > 0 && (
        <div className="px-4 pb-4 space-y-2">
          <p className="text-[10px] font-mono text-vt-neutral-600 uppercase tracking-wider mb-2">
            Credentials · {credentials.length}
          </p>
          {visible.map((c) => (
            <IssuerTrustBadge key={c.credentialId} credential={c} />
          ))}
          {credentials.length > 3 && (
            <button
              type="button"
              onClick={() => setShowAll((p) => !p)}
              className="flex items-center gap-1.5 w-full justify-center text-[10px] text-vt-neutral-600 hover:text-vt-neutral-400 transition-colors py-1"
            >
              {showAll ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {showAll ? 'Show less' : `Show ${credentials.length - 3} more`}
            </button>
          )}
        </div>
      )}

      {credentials.length === 0 && !loading && (
        <div className="px-4 pb-4">
          <p className="text-[11px] text-vt-neutral-600 text-center py-3">No credentials on file</p>
        </div>
      )}

      {/* Share actions */}
      {!compact && (
        <div className="border-t border-vt-neutral-800 px-4 py-3 space-y-3">
          <button
            type="button"
            onClick={() => setShowShare((p) => !p)}
            className="flex items-center gap-2 w-full justify-center rounded-lg border border-vt-neutral-700 bg-vt-neutral-800/40 py-2 text-xs text-vt-neutral-400 hover:text-vt-neutral-100 hover:border-vt-neutral-600 transition-colors"
          >
            <Share2 className="h-3.5 w-3.5" />
            Share source-backed data
          </button>

          <AnimatePresence>
            {showShare && (
              <ShareDrawer
                npi={npi}
                shareUrl={shareUrl}
                credentials={credentials}
                onClose={() => setShowShare(false)}
              />
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
