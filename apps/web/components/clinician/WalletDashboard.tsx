'use client';

import { Button } from '@/components/ui/button';
import { CRSRing } from '@/components/ui/crs-ring';
import { GlassCard, GlassCardContent } from '@/components/ui/glass-card';
import { TrustBandIndicator } from '@/components/ui/trust-band-indicator';
import type { TrustBand } from '@/components/trust-state/types';
import type { CredentialItem, CredentialStatus as WalletCredentialStatus } from '@/lib/api';
import { Share2, Shield } from 'lucide-react';
import { useState } from 'react';
import { type CredentialCardData } from './CredentialCard';
import { CredentialLargeCard } from './CredentialLargeCard';
import { FocusMode } from './FocusMode';
import { NextBestAction, type NextBestActionData } from './NextBestAction';
import { SelectiveDisclosureModal } from './SelectiveDisclosureModal';
import { VitaTokenBalance } from './VitaTokenBalance';
import {
  VitaTokenDashboard,
  type VitaEvent,
} from './VitaTokenDashboard';

/* ------------------------------------------------------------------ */
/*  Demo data — replace with real API data when backend is ready       */
/* ------------------------------------------------------------------ */

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
  },
  {
    id: '4',
    type: 'NPI_ENROLLMENT',
    name: 'NPI — 1234567890',
    issuer: 'CMS / NPPES',
    status: 'ACTIVE',
    claimLevel: 'L3',
    issueDate: '2018-03-20',
  },
  {
    id: '5',
    type: 'EDUCATION',
    name: 'Doctor of Medicine',
    issuer: 'Stanford University School of Medicine',
    status: 'ACTIVE',
    claimLevel: 'L1',
    issueDate: '2016-06-01',
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
  },
];

const DEMO_TRUST: { band: TrustBand; score: number } = {
  band: 'YELLOW',
  score: 72,
};

const DEMO_VITA_BALANCE = 185;

const DEMO_VITA_EVENTS: VitaEvent[] = [
  {
    id: 'v1',
    kind: 'CREDENTIAL_VERIFIED',
    label: 'Medical License verified via PSV',
    tokens: 50,
    timestamp: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
  },
  {
    id: 'v2',
    kind: 'DOCUMENT_UPLOADED',
    label: 'Board certification uploaded',
    tokens: 15,
    timestamp: new Date(Date.now() - 18 * 60 * 60_000).toISOString(),
  },
  {
    id: 'v3',
    kind: 'PROFILE_COMPLETED',
    label: 'NPI identity verified',
    tokens: 30,
    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60_000).toISOString(),
  },
  {
    id: 'v4',
    kind: 'CREDENTIAL_VERIFIED',
    label: 'DEA registration verified',
    tokens: 50,
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60_000).toISOString(),
  },
  {
    id: 'v5',
    kind: 'DOCUMENT_UPLOADED',
    label: 'Medical degree transcript uploaded',
    tokens: 15,
    timestamp: new Date(Date.now() - 5 * 24 * 60 * 60_000).toISOString(),
  },
  {
    id: 'v6',
    kind: 'CREDENTIAL_SHARED',
    label: 'Credentials shared with employer',
    tokens: 25,
    timestamp: new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString(),
  },
];

/* ------------------------------------------------------------------ */
/*  Map demo data → CredentialItem for large cards                     */
/* ------------------------------------------------------------------ */

const STATUS_MAP: Record<string, WalletCredentialStatus> = {
  ACTIVE: 'Valid',
  EXPIRED: 'Revoked',
  REVOKED: 'Revoked',
  PENDING: 'Pending',
  SUSPENDED: 'Revoked',
  INACTIVE: 'Expiring',
};

const SCOPE_MAP: Record<string, string> = {
  STATE_LICENSE: 'Medical Licensure',
  BOARD_CERTIFICATION: 'Board Certification',
  DEA_REGISTRATION: 'Controlled Substances',
  NPI_ENROLLMENT: 'Provider Identity',
  EDUCATION: 'Medical Education',
  TRAINING: 'Graduate Medical Education',
  WORK_HISTORY: 'Employment History',
};

function toCredentialItem(card: CredentialCardData): CredentialItem {
  return {
    id: card.id,
    name: card.name,
    issuer: card.issuer,
    scope: SCOPE_MAP[card.type] ?? card.type,
    status: STATUS_MAP[card.status] ?? 'Pending',
    claimLevel: card.claimLevel as CredentialItem['claimLevel'],
    issueDate: card.issueDate ?? '',
    expirationDate: card.expirationDate,
    pouBinding: 'Employment Credentialing',
  };
}

function getNextBestAction(credentials: CredentialCardData[]): NextBestActionData | null {
  const unverified = credentials.filter((c) => c.claimLevel === 'L0' || c.claimLevel === 'L1');
  if (unverified.length > 0) {
    return {
      title: 'Upgrade your credentials',
      description: `${unverified.length} credential${unverified.length > 1 ? 's' : ''} can be electronically verified to improve your CRS score.`,
      action: 'Start verification',
    };
  }

  const expiringSoon = credentials.filter((c) => {
    if (!c.expirationDate) return false;
    const daysUntil =
      (new Date(c.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return daysUntil > 0 && daysUntil < 90;
  });

  if (expiringSoon.length > 0) {
    return {
      title: 'Credentials expiring soon',
      description: `${expiringSoon[0].name} expires in less than 90 days. Renew early to maintain your readiness.`,
      action: 'View details',
    };
  }

  return null;
}

/* ------------------------------------------------------------------ */
/*  WalletDashboard                                                    */
/* ------------------------------------------------------------------ */

export function WalletDashboard() {
  const [shareOpen, setShareOpen] = useState(false);
  const [focusCred, setFocusCred] = useState<CredentialItem | null>(null);

  const credentials = DEMO_CREDENTIALS;
  const walletCredentials = credentials.map(toCredentialItem);
  const trustBand = DEMO_TRUST.band;
  const trustScore = DEMO_TRUST.score;
  const nextAction = getNextBestAction(credentials);

  return (
    <div className="mx-auto max-w-6xl px-8 py-16 space-y-14">
      {/* Header */}
      <header className="flex items-start justify-between gap-6">
        <div className="space-y-2">
          <h1 className="font-heading text-4xl font-bold tracking-tight">
            Credential Wallet
          </h1>
          <p className="text-lg text-muted-foreground">
            Your verified credentials, readiness score, and next steps.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <VitaTokenBalance balance={DEMO_VITA_BALANCE} />
          <Button
            variant="outline"
            size="default"
            onClick={() => setShareOpen(true)}
          >
            <Share2 className="h-5 w-5 mr-2" />
            Share
          </Button>
        </div>
      </header>

      {/* Main layout: content + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
        {/* Left: CRS + credentials */}
        <div className="space-y-10">
          {/* Top row: CRS Ring + stats + next action */}
          <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-8">
            {/* CRS Ring */}
            <GlassCard weight="heavy" className="flex flex-col items-center justify-center py-10">
              <GlassCardContent className="flex flex-col items-center gap-4">
                <CRSRing band={trustBand} percentage={trustScore} size={220} strokeWidth={12} />
                <TrustBandIndicator band={trustBand} size="sm" />
                <p className="text-sm text-muted-foreground text-center mt-1.5">
                  Credential Readiness Score
                </p>
              </GlassCardContent>
            </GlassCard>

            {/* Right side: summary + next action */}
            <div className="flex flex-col gap-5 justify-center">
              {/* Quick stats */}
              <div className="grid grid-cols-3 gap-4">
                <GlassCard>
                  <GlassCardContent className="pt-5 pb-5 text-center">
                    <p className="text-4xl font-heading font-bold">{credentials.length}</p>
                    <p className="text-base text-muted-foreground mt-1">Credentials</p>
                  </GlassCardContent>
                </GlassCard>
                <GlassCard>
                  <GlassCardContent className="pt-5 pb-5 text-center">
                    <p className="text-4xl font-heading font-bold">
                      {credentials.filter((c) => c.claimLevel === 'L3').length}
                    </p>
                    <p className="text-base text-muted-foreground mt-1">PSV Verified</p>
                  </GlassCardContent>
                </GlassCard>
                <GlassCard>
                  <GlassCardContent className="pt-5 pb-5 text-center">
                    <p className="text-4xl font-heading font-bold">
                      {credentials.filter((c) => c.status === 'ACTIVE').length}
                    </p>
                    <p className="text-base text-muted-foreground mt-1">Active</p>
                  </GlassCardContent>
                </GlassCard>
              </div>

              {/* Next best action */}
              {nextAction && <NextBestAction action={nextAction} />}
            </div>
          </div>

          {/* Credential large cards */}
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <h2 className="font-heading text-2xl font-semibold tracking-tight">
                Your Credentials
              </h2>
            </div>

            <div className="space-y-4">
              {walletCredentials.map((cred) => (
                <CredentialLargeCard
                  key={cred.id}
                  credential={cred}
                  onFocusMode={() => setFocusCred(cred)}
                />
              ))}
            </div>
          </section>
        </div>

        {/* Right sidebar: VITA Token Dashboard */}
        <aside className="space-y-4">
          <VitaTokenDashboard
            balance={DEMO_VITA_BALANCE}
            events={DEMO_VITA_EVENTS}
          />
        </aside>
      </div>

      {/* Selective Disclosure Modal */}
      <SelectiveDisclosureModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        credentials={credentials}
      />

      {/* Focus Mode overlay */}
      <FocusMode credential={focusCred} onClose={() => setFocusCred(null)} />
    </div>
  );
}
