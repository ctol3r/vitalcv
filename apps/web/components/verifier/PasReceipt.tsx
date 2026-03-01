'use client';

/**
 * PasReceipt — Wave 29: Professional Authority State Engine
 *
 * Renders the PAS object as a medical-grade cryptographic receipt.
 * Visual language: EKG readout meets hardware security key printout.
 *
 * - Dark, monospace-first typography — authoritative, not decorative
 * - Animated EKG SVG waveform that pulses on GREEN status
 * - Per-credential rows with immutable hashes and TTL countdowns
 * - PSV receipt ledger with source-authority attribution
 * - Audit trail pointer block in terminal style
 *
 * No forms. No upload buttons. Pure read-only clearance evidence.
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Anchor,
  BadgeCheck,
  Clock,
  Fingerprint,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  XCircle,
} from 'lucide-react';

// ── Shared types (mirrors authority.ts) ──────────────────────────────────

export interface PASCredential {
  type: string;
  issuer: string;
  license_id: string;
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED' | 'UNKNOWN';
  verified_at: string;
  expires_at: string | null;
  source_authority: string;
  immutable_hash: string;
  ttl_remaining_days: number | null;
}

export interface PASPsvReceipt {
  receipt_id: string;
  source_authority: string;
  fetched_at: string;
  ttl_seconds: number;
  revoked: boolean;
  response_hash: string;
}

export interface PASObject {
  schema: string;
  generated_at: string;
  npi_checksum: string;
  subject: { npi: string; name: string };
  authority_state: {
    status: 'GREEN' | 'YELLOW' | 'RED';
    as_of: string;
    score: number;
    band: 'GREEN' | 'YELLOW' | 'RED';
    changes_since_last: 'NONE' | 'SCORE_CHANGE' | 'STATUS_CHANGE' | 'NEW_CREDENTIALS';
  };
  credentials: PASCredential[];
  psv_receipts: PASPsvReceipt[];
  audit_trail_pointer: {
    merkle_root: string | null;
    latest_artifact_id: string;
    snapshot_count: number;
    generated_at: string;
  };
}

// ── EKG Waveform SVG ─────────────────────────────────────────────────────

const EKG_PATH =
  'M0,30 L20,30 L25,10 L30,50 L35,5 L40,55 L45,30 L55,30 L60,30 L65,20 L70,40 L75,30 L300,30';

function EkgWaveform({ status }: { status: 'GREEN' | 'YELLOW' | 'RED' }) {
  const color = status === 'GREEN' ? '#10b981' : status === 'YELLOW' ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative overflow-hidden h-14 w-full" aria-hidden="true">
      {/* Grid lines */}
      <svg className="absolute inset-0 w-full h-full opacity-10" xmlns="http://www.w3.org/2000/svg">
        {[0, 1, 2, 3].map((i) => (
          <line key={i} x1="0" y1={`${25 * i}%`} x2="100%" y2={`${25 * i}%`} stroke={color} strokeWidth="0.5" />
        ))}
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <line key={i} x1={`${12.5 * i}%`} y1="0" x2={`${12.5 * i}%`} y2="100%" stroke={color} strokeWidth="0.5" />
        ))}
      </svg>

      {/* Waveform — repeating, animated translate */}
      <svg className="absolute inset-0" viewBox="0 0 300 60" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="ekg-glow">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <motion.path
          d={EKG_PATH}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          filter="url(#ekg-glow)"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.2, ease: 'easeInOut', delay: 0.3 }}
        />
        {status === 'GREEN' && (
          <motion.path
            d={EKG_PATH}
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
            opacity={0.15}
            filter="url(#ekg-glow)"
            animate={{ opacity: [0.08, 0.18, 0.08] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
      </svg>
    </div>
  );
}

// ── Status config ─────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  GREEN:  { icon: ShieldCheck,   ring: 'ring-emerald-500/40', glow: 'shadow-emerald-500/20', bg: 'bg-emerald-500/8',  text: 'text-emerald-400', label: 'START-READY',   sub: 'All credentials verified and current.' },
  YELLOW: { icon: ShieldQuestion, ring: 'ring-amber-500/40',   glow: 'shadow-amber-500/20',   bg: 'bg-amber-500/8',    text: 'text-amber-400',   label: 'CONDITIONAL',   sub: 'One or more credentials expiring soon.' },
  RED:    { icon: ShieldAlert,    ring: 'ring-red-500/40',     glow: 'shadow-red-500/20',     bg: 'bg-red-500/8',      text: 'text-red-400',     label: 'NOT CLEARED',   sub: 'Credential gap or revocation detected.' },
} as const;

// ── Credential type labels ────────────────────────────────────────────────

function credLabel(type: string): string {
  const map: Record<string, string> = {
    STATE_LICENSE: 'State Medical License',
    NURSING_LICENSE: 'Nursing License',
    DEA_REGISTRATION: 'DEA Registration',
    BOARD_CERTIFICATION: 'Board Certification',
    NPI_ENROLLMENT: 'NPI / NPPES Enrollment',
    SANCTIONS_CHECK: 'OIG/LEIE Sanctions Check',
    SAM_EXCLUSIONS_CHECK: 'SAM Exclusions Check',
    PRIMARY_SOURCE_VERIFICATION: 'Primary Source Verification',
  };
  return map[type] ?? type.replace(/_/g, ' ');
}

function fmtDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso));
  } catch { return iso.slice(0, 10); }
}

function fmtTs(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }).format(new Date(iso));
  } catch { return iso; }
}

// ── Sub-components ────────────────────────────────────────────────────────

function CredentialRow({ cred, i }: { cred: PASCredential; i: number }) {
  const isActive = cred.status === 'ACTIVE';
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.05 * i, duration: 0.3 }}
      className={`relative border-b border-white/5 px-5 py-3.5 last:border-b-0 ${isActive ? '' : 'bg-red-500/[0.03]'}`}
    >
      <div className="flex items-start gap-3">
        {/* Status dot */}
        <div className="mt-1 shrink-0">
          {isActive
            ? <BadgeCheck className="h-4 w-4 text-emerald-400" />
            : <XCircle   className="h-4 w-4 text-red-400" />}
        </div>

        {/* Main info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-white/80">{credLabel(cred.type)}</span>
            <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
              {cred.status}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500">{cred.issuer}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1 font-mono text-[10px] text-slate-600">
              <Clock className="h-2.5 w-2.5" />
              Verified: {fmtDate(cred.verified_at)}
            </span>
            {cred.expires_at && (
              <span className={`flex items-center gap-1 font-mono text-[10px] ${(cred.ttl_remaining_days ?? 0) < 30 ? 'text-amber-500' : 'text-slate-600'}`}>
                Expires: {fmtDate(cred.expires_at)}
                {cred.ttl_remaining_days !== null && ` (${cred.ttl_remaining_days}d)`}
              </span>
            )}
          </div>
        </div>

        {/* Hash */}
        <div className="hidden shrink-0 text-right sm:block">
          <div className="flex items-center gap-1 justify-end">
            <Fingerprint className="h-3 w-3 text-teal-600" />
            <span className="font-mono text-[10px] text-slate-700">
              {cred.immutable_hash.slice(0, 12)}…
            </span>
          </div>
          <p className="mt-0.5 font-mono text-[9px] text-slate-700">{cred.license_id.slice(0, 20)}</p>
        </div>
      </div>
    </motion.div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export function PasReceipt({ pas }: { pas: PASObject }) {
  const cfg = STATUS_CONFIG[pas.authority_state.status];
  const StatusIcon = cfg.icon;

  const changesBadge = useMemo(() => {
    const map: Record<string, { label: string; color: string }> = {
      NONE:            { label: 'No changes since last verification', color: 'text-emerald-400' },
      SCORE_CHANGE:    { label: 'Score updated since last verification',  color: 'text-amber-400'  },
      STATUS_CHANGE:   { label: 'Status changed since last verification', color: 'text-amber-400'  },
      NEW_CREDENTIALS: { label: 'New credentials added',                  color: 'text-sky-400'    },
    };
    return map[pas.authority_state.changes_since_last] ?? map['NONE'];
  }, [pas.authority_state.changes_since_last]);

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-950/90 shadow-2xl shadow-black/50 backdrop-blur-xl font-mono">

      {/* ── Receipt header ─────────────────────────────── */}
      <div className="border-b border-white/8 bg-slate-900/60 px-6 pt-6 pb-4">
        {/* Schema + timestamp */}
        <div className="mb-4 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">
            {pas.schema}
          </span>
          <span className="text-[10px] text-slate-700">{fmtTs(pas.generated_at)}</span>
        </div>

        {/* Subject line */}
        <p className="text-[11px] text-slate-500">
          SUBJECT: <span className="text-slate-300">{pas.subject.name}</span>
          <span className="ml-3 text-slate-600">NPI: {pas.subject.npi}</span>
        </p>

        {/* Status block */}
        <div className={`mt-5 flex items-center gap-5 rounded-xl p-4 ring-1 ${cfg.bg} ${cfg.ring} shadow-lg ${cfg.glow}`}>
          <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ring-1 ${cfg.bg} ${cfg.ring} shadow-lg ${cfg.glow}`}>
            <StatusIcon className={`h-7 w-7 ${cfg.text}`} />
          </div>
          <div className="flex-1">
            <div className="flex items-baseline gap-3">
              <p className={`text-2xl font-bold tracking-tight ${cfg.text}`}>
                {cfg.label}
              </p>
              <span className={`text-sm font-semibold ${cfg.text}`}>
                {pas.authority_state.score}/100
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-400">{cfg.sub}</p>
            <p className={`mt-1.5 text-[10px] font-semibold ${changesBadge.color}`}>
              ▸ {changesBadge.label}
            </p>
          </div>
        </div>
      </div>

      {/* ── EKG waveform ────────────────────────────────── */}
      <div className="border-b border-white/5 bg-slate-900/30 px-4">
        <EkgWaveform status={pas.authority_state.status} />
      </div>

      {/* ── Credentials ledger ───────────────────────────── */}
      {pas.credentials.length > 0 ? (
        <section>
          <div className="border-b border-white/5 bg-slate-900/40 px-5 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">
              Credential Ledger — {pas.credentials.length} records
            </p>
          </div>
          {pas.credentials.map((cred, i) => (
            <CredentialRow key={cred.license_id ?? `${cred.type}-${i}`} cred={cred} i={i} />
          ))}
        </section>
      ) : (
        <div className="px-6 py-8 text-center text-xs text-slate-600">
          No PSV receipts on file for this NPI. Credentials pending primary source verification.
        </div>
      )}

      {/* ── Audit trail pointer ──────────────────────────── */}
      <div className="border-t border-white/8 bg-slate-900/60 px-5 py-4">
        <div className="flex items-center gap-2 mb-3">
          <Anchor className="h-3.5 w-3.5 text-teal-500" />
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            Audit Trail Pointer
          </p>
        </div>
        <div className="space-y-1">
          <p className="font-mono text-[10px]">
            <span className="text-slate-600">merkle_root:  </span>
            <span className="text-teal-400 break-all">{pas.audit_trail_pointer.merkle_root ?? 'none'}</span>
          </p>
          <p className="font-mono text-[10px]">
            <span className="text-slate-600">artifact_id:  </span>
            <span className="text-slate-400">{pas.audit_trail_pointer.latest_artifact_id}</span>
          </p>
          <p className="font-mono text-[10px]">
            <span className="text-slate-600">snapshots:    </span>
            <span className="text-slate-400">{pas.audit_trail_pointer.snapshot_count}</span>
          </p>
          <p className="font-mono text-[10px]">
            <span className="text-slate-600">npi_checksum: </span>
            <span className="text-slate-500">{pas.npi_checksum.slice(0, 32)}…</span>
          </p>
        </div>
      </div>

      {/* ── Receipt footer ───────────────────────────────── */}
      <div className="border-t border-white/5 px-5 py-3 text-center">
        <p className="text-[9px] text-slate-700">
          This document is a deterministic, cryptographically-anchored snapshot generated by the VitalCV PAS Engine.
          It does not constitute a legal or regulatory credentialing decision.
          Verify the merkle_root against the VitalCV transparency ledger before acting on this document.
        </p>
      </div>
    </div>
  );
}
