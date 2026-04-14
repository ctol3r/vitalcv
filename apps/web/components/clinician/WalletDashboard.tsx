'use client';

/**
 * WalletDashboard — Wave 32: Holder Wallet UX Transformation
 *
 * Main clinician wallet view. Wires:
 *  - Large-Card CredentialCard (Wave 32)
 *  - FocusModeOverlay for front-desk "show-and-go" (Wave 32)
 *  - SelectiveDisclosureModal for sharing
 *  - VitaTokenDashboard sidebar
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { BentoGrid, BentoItem } from '@/components/ui/bento-grid';
import { CRSRing } from '@/components/ui/crs-ring';
import { GlassCard, GlassCardContent } from '@/components/ui/glass-card';
import { TrustBandIndicator } from '@/components/ui/trust-band-indicator';
import type { TrustBand } from '@/components/trust-state/types';
import {
  buildNextBestActionApiFailure,
  type NormalizedNextBestAction,
  normalizeNextBestAction,
} from '@/lib/next-best-action';
import { Shield } from 'lucide-react';
import { CredentialCard, type CredentialCardData } from './CredentialCard';
import { FocusModeOverlay } from './FocusModeOverlay';
import { NextBestAction, type NextBestActionData } from './NextBestAction';
import { SelectiveDisclosureModal } from './SelectiveDisclosureModal';
import { VitaTokenBalance } from './VitaTokenBalance';
import { VitaTokenDashboard, type VitaEvent } from './VitaTokenDashboard';

// ── Demo data ──────────────────────────────────────────────────────────────

const DEMO_NPI = '1234567890';
const DEMO_CLINICIAN_NAME = 'Dr. Sarah Chen';

const DEMO_CREDENTIALS: CredentialCardData[] = [
  {
    id: '1',
    type: 'STATE_LICENSE',
    name: 'Medical License — California',
    issuer: 'Medical Board of California',
    status: 'ACTIVE',
    claimLevel: 'L3',
    issueDate: '2020-06-15',
    expirationDate: '2026-06-15',
    licenseId: 'CA-A-123456',
    psvSnapshotHash: 'a3f2c8d1e9b04572f3a1bc9e7d2054a8f6c3e1d0b9a8f7e2c3d1a0b9f8e7d2c1',
    verifierDid: 'did:web:vitalcv.ai:issuer:ca-medical-board',
    methodologyVersion: 'VCV-PSV-2025.1 (NCQA-Aligned)',
  },
  {
    id: '2',
    type: 'BOARD_CERTIFICATION',
    name: 'Internal Medicine',
    issuer: 'American Board of Internal Medicine',
    status: 'ACTIVE',
    claimLevel: 'L2',
    issueDate: '2019-09-01',
    expirationDate: '2029-09-01',
    licenseId: 'ABIM-2019-IM-88742',
    psvSnapshotHash: 'b8e1d4c7f2a095643e1a7b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2',
    verifierDid: 'did:web:vitalcv.ai:issuer:abim',
    methodologyVersion: 'VCV-PSV-2025.1 (NCQA-Aligned)',
  },
  {
    id: '3',
    type: 'DEA_REGISTRATION',
    name: 'DEA Registration',
    issuer: 'Drug Enforcement Administration',
    status: 'ACTIVE',
    claimLevel: 'L2',
    issueDate: '2021-01-10',
    expirationDate: '2027-01-10',
    licenseId: 'BC1234567',
    psvSnapshotHash: 'c9f2e1d3b4a506172839405162738490516273849051627384905162738490516',
    verifierDid: 'did:web:vitalcv.ai:issuer:dea',
    methodologyVersion: 'VCV-PSV-2025.1 (NCQA-Aligned)',
  },
  {
    id: '4',
    type: 'NPI_ENROLLMENT',
    name: `NPI — ${DEMO_NPI}`,
    issuer: 'CMS / NPPES',
    status: 'ACTIVE',
    claimLevel: 'L3',
    issueDate: '2018-03-20',
    licenseId: DEMO_NPI,
    verifierDid: 'did:web:vitalcv.ai:issuer:cms-nppes',
    methodologyVersion: 'VCV-PSV-2025.1 (NCQA-Aligned)',
  },
  {
    id: '5',
    type: 'EDUCATION',
    name: 'Doctor of Medicine',
    issuer: 'Stanford University School of Medicine',
    status: 'ACTIVE',
    claimLevel: 'L1',
    issueDate: '2016-06-01',
    verifierDid: 'did:web:vitalcv.ai:issuer:stanford-som',
    methodologyVersion: 'VCV-EDU-2025.1',
  },
  {
    id: '6',
    type: 'TRAINING',
    name: 'Internal Medicine Residency',
    issuer: 'UCSF Medical Center',
    status: 'ACTIVE',
    claimLevel: 'L1',
    issueDate: '2016-07-01',
    expirationDate: '2019-06-30',
    verifierDid: 'did:web:vitalcv.ai:issuer:ucsf',
    methodologyVersion: 'VCV-EDU-2025.1',
  },
];

const DEMO_TRUST: { band: TrustBand; score: number } = { band: 'YELLOW', score: 72 };
const DEMO_VITA_BALANCE = 185;

const DEMO_VITA_EVENTS: VitaEvent[] = [
  { id: 'v1', kind: 'CREDENTIAL_VERIFIED', label: 'Medical license checked via NPPES',      tokens: 50, timestamp: new Date(Date.now() - 2 * 3_600_000).toISOString()     },
  { id: 'v2', kind: 'DOCUMENT_UPLOADED',   label: 'Board certification uploaded',          tokens: 15, timestamp: new Date(Date.now() - 18 * 3_600_000).toISOString()    },
  { id: 'v3', kind: 'PROFILE_COMPLETED',   label: 'NPI identity checked',                  tokens: 30, timestamp: new Date(Date.now() - 2 * 86_400_000).toISOString()    },
  { id: 'v4', kind: 'CREDENTIAL_VERIFIED', label: 'Sanctions exclusion checked',           tokens: 50, timestamp: new Date(Date.now() - 3 * 86_400_000).toISOString()    },
  { id: 'v5', kind: 'DOCUMENT_UPLOADED',   label: 'Medical degree transcript uploaded',    tokens: 15, timestamp: new Date(Date.now() - 5 * 86_400_000).toISOString()    },
  { id: 'v6', kind: 'CREDENTIAL_SHARED',   label: 'Credentials shared with employer',      tokens: 25, timestamp: new Date(Date.now() - 7 * 86_400_000).toISOString()    },
];

// ── Component ──────────────────────────────────────────────────────────────

export function WalletDashboard() {
  const [shareOpen, setShareOpen]   = useState(false);
  const [focusCred, setFocusCred]   = useState<CredentialCardData | null>(null);
  const [nextAction, setNextAction] = useState<NextBestActionData | null>(null);
  const [nextActionFailed, setNextActionFailed] = useState(false);

  const credentials  = DEMO_CREDENTIALS;
  const trustBand    = DEMO_TRUST.band;
  const trustScore   = DEMO_TRUST.score;

  const openFocusMode = useCallback((cred: CredentialCardData) => setFocusCred(cred), []);
  const closeFocusMode = useCallback(() => setFocusCred(null), []);
  const loadNextBestAction = useCallback(async (signal?: AbortSignal) => {
    setNextAction(null);
    setNextActionFailed(false);

    try {
      const response = await fetch('/api/omega', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ npi: DEMO_NPI }),
        signal,
      });

      if (!response.ok) {
        throw new Error(`omega_request_failed:${response.status}`);
      }

      const payload = await response.json() as {
        nextBestAction?: import('@/lib/next-best-action').NextBestActionPayload | null;
      };
      setNextAction(normalizeNextBestAction(payload.nextBestAction ?? null));
    } catch (error) {
      if (signal?.aborted) {
        return;
      }
      setNextAction(null);
      setNextActionFailed(true);
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void loadNextBestAction(controller.signal);
    return () => controller.abort();
  }, [loadNextBestAction]);

  const resolvedNextAction = useMemo<NextBestActionData | null>(() => {
    const source = nextActionFailed ? buildNextBestActionApiFailure() : nextAction;
    if (!source) {
      return null;
    }

    switch (source.kind) {
      case 'PROCEED':
        return {
          ...source,
          actionLabel: 'Share credentials',
          onClick: () => setShareOpen(true),
        };
      case 'REVERIFY':
        return {
          ...source,
          actionLabel: 'Open passport',
          href: '/passport',
        };
      case 'ESCALATE':
      case 'REVIEW_MANUALLY':
      default:
        return {
          ...source,
          actionLabel: 'Review passport',
          href: '/passport',
        };
    }
  }, [nextAction, nextActionFailed]);

  return (
    <div className="mx-auto max-w-6xl px-8 py-16 space-y-14">

      {/* ── Demo data banner ──────────────────────────────── */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400">
          Preview profile
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          This is a sample profile. Connect your NPI to see your current status.
        </p>
      </div>

      {/* ── Header ──────────────────────────────────────── */}
      <header className="flex items-start justify-between gap-6">
        <div className="space-y-2">
          <h1 className="font-heading text-4xl font-bold tracking-tight">Credential Wallet</h1>
          <p className="text-lg text-muted-foreground">
            Readiness, verified records, and the next step.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <VitaTokenBalance balance={DEMO_VITA_BALANCE} />
        </div>
      </header>

      {/* ── Main layout ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">

        {/* Left: CRS + credentials */}
        <div className="space-y-10">

          {/* CRS Ring + stats */}
          <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-8">
            <GlassCard weight="heavy" className="flex flex-col items-center justify-center py-10">
              <GlassCardContent className="flex flex-col items-center gap-4">
                <CRSRing band={trustBand} percentage={trustScore} size={220} strokeWidth={12} />
                <TrustBandIndicator band={trustBand} size="sm" />
                <p className="text-sm text-muted-foreground text-center mt-1.5">
                  Credential Readiness Score
                </p>
              </GlassCardContent>
            </GlassCard>

            <div className="flex flex-col gap-5 justify-center">
              <div className="grid grid-cols-3 gap-4">
                {[
                  { val: credentials.length,                                  label: 'Credentials' },
                  { val: credentials.filter((c) => c.claimLevel === 'L3').length, label: 'PSV Verified' },
                  { val: credentials.filter((c) => c.status === 'ACTIVE').length, label: 'Active'       },
                ].map(({ val, label }) => (
                  <GlassCard key={label}>
                    <GlassCardContent className="pt-5 pb-5 text-center">
                      <p className="text-4xl font-heading font-bold">{val}</p>
                      <p className="text-base text-muted-foreground mt-1">{label}</p>
                    </GlassCardContent>
                  </GlassCard>
                ))}
              </div>
              {resolvedNextAction ? <NextBestAction action={resolvedNextAction} /> : null}
            </div>
          </div>

          {/* ── Credential cards grid ──────────────────── */}
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <h2 className="font-heading text-2xl font-semibold tracking-tight">
                Your Credentials
              </h2>
              <p className="ml-auto text-sm text-muted-foreground">
                Use <strong>Focus Mode</strong> at check-in
              </p>
            </div>

            <BentoGrid columns={3} className="gap-8">
              {credentials.map((cred) => (
                <BentoItem key={cred.id}>
                  <CredentialCard
                    credential={cred}
                    className="h-full"
                    onFocusMode={openFocusMode}
                  />
                </BentoItem>
              ))}
            </BentoGrid>
          </section>
        </div>

        {/* Right sidebar */}
        <aside className="space-y-4">
          <VitaTokenDashboard balance={DEMO_VITA_BALANCE} events={DEMO_VITA_EVENTS} />
        </aside>
      </div>

      {/* ── Modals ──────────────────────────────────────── */}
      <SelectiveDisclosureModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        credentials={credentials}
      />

      {/* Focus Mode — full-screen, z-[100] */}
      <FocusModeOverlay
        credential={focusCred}
        clinicianName={DEMO_CLINICIAN_NAME}
        qrUrl={`https://vitalcv.ai/verifier/pas/${DEMO_NPI}`}
        onClose={closeFocusMode}
      />
    </div>
  );
}
