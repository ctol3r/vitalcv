'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  VerificationReceipts,
  type ReceiptRow,
  type ReceiptOutcome,
} from '@/components/VerificationReceipts';
import { AuditTimeline } from '@/components/AuditTimeline';
import { GlassCard, GlassCardContent } from '@/components/ui/glass-card';
import { History, AlertCircle } from 'lucide-react';
import { FormEvent, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { ManualVerification } from './ManualVerification';
import { TrustStatePanel } from './TrustStatePanel';
import { VerificationFlow } from './VerificationFlow';
import { VerificationInput } from './VerificationInput';
import type { ManualVerificationRecord, TrustStateStatus } from './verifier-types';
import {
  getCtaVariant,
  getMockHash,
  getTrustObserverExplanation,
  getVerifierRef,
  isPilotModeEnabled,
  normalizeEventLabel,
} from './verifier-types';

/* ------------------------------------------------------------------ */
/*  VerifierPortal — orchestrator                                      */
/* ------------------------------------------------------------------ */

export function VerifierPortal() {
  return (
    <Suspense fallback={null}>
      <VerifierPortalContent />
    </Suspense>
  );
}

function VerifierPortalContent() {
  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
  const searchParams = useSearchParams();

  /* ---- Core state ---- */
  const [clinicianId, setClinicianId] = useState('clinician:alice');
  const [employerId, setEmployerId] = useState('employer:alpha');
  const [simulateDecay, setSimulateDecay] = useState(false);
  const [status, setStatus] = useState<TrustStateStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ---- Pilot state ---- */
  const [pilotOrganization, setPilotOrganization] = useState('');
  const [pilotContactEmail, setPilotContactEmail] = useState('');
  const [pilotActivationState, setPilotActivationState] = useState<string | null>(null);
  const [pilotActivationLoading, setPilotActivationLoading] = useState(false);
  const ctaVariant = getCtaVariant();
  const pilotModeEnabled = isPilotModeEnabled();
  const verifierRef = getVerifierRef(searchParams.get('ref'));
  const pilotActivationButtonLabel =
    ctaVariant === 'B' ? 'Start 30-Day Pilot' : 'Request Pilot Access';

  /* ---- CRS change tracking ---- */
  const prevCrsRef = useRef<number | null>(null);
  const [crsUpdatedBanner, setCrsUpdatedBanner] = useState(false);

  const trustObserver = useMemo(
    () => getTrustObserverExplanation(status),
    [status],
  );

  /* ---- Manual Verification State ---- */
  const [manualSubject, setManualSubject] = useState('');
  const [manualAttestor, setManualAttestor] = useState<'Employer' | 'CVO'>('Employer');
  const [manualFile, setManualFile] = useState<File | null>(null);
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualVerifications, setManualVerifications] = useState<ManualVerificationRecord[]>([]);
  const manualIdRef = useRef(0);

  /* ---- API handlers ---- */
  const checkTrustState = useCallback(async () => {
    if (!clinicianId.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams({
        clinician_id: clinicianId,
        employer_id: employerId,
        simulate_decay: String(simulateDecay),
      });
      const res = await fetch(
        `${backendUrl}/trust-state?${queryParams.toString()}`,
      );
      if (!res.ok) throw new Error('Failed to fetch trust state');
      const data = await res.json();
      setStatus(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [backendUrl, clinicianId, employerId, simulateDecay]);

  // Auto-check on mount
  useEffect(() => {
    checkTrustState();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-check when scenario parameters change
  useEffect(() => {
    if (status) checkTrustState();
  }, [employerId, simulateDecay]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track CRS score changes
  useEffect(() => {
    if (status?.crs?.score != null) {
      if (
        prevCrsRef.current !== null &&
        prevCrsRef.current !== status.crs.score
      ) {
        setCrsUpdatedBanner(true);
      }
      prevCrsRef.current = status.crs.score;
    }
  }, [status]);

  const handleAccept = useCallback(async () => {
    if (!status?.recognitionId) return;
    setActionLoading(true);
    try {
      const psvReportId = status?.timeline_preview?.find(
        (event) => event?.type === 'VERIFICATION_COMPLETED',
      )?.metadata?.psv_report_id;
      if (!psvReportId) throw new Error('Acceptance requires completed PSV.');

      const payload = {
        acceptance: {
          recognitionId: status.recognitionId,
          psvReportId,
          facilityId:
            employerId === 'employer:alpha' ? 'facility:main' : 'facility:b',
          employerId,
          acceptedAt: new Date().toISOString(),
        },
      };
      const res = await fetch(`${backendUrl}/acceptances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to accept');
      await checkTrustState();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setActionLoading(false);
    }
  }, [backendUrl, checkTrustState, employerId, status]);

  const handleStart = useCallback(async () => {
    if (!status?.acceptanceId) return;
    setActionLoading(true);
    try {
      const payload = {
        start: {
          acceptanceId: status.acceptanceId,
          attestedAt: new Date().toISOString(),
        },
      };
      const res = await fetch(`${backendUrl}/starts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to attest start');
      await checkTrustState();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setActionLoading(false);
    }
  }, [backendUrl, checkTrustState, status]);

  const handleManualVerification = useCallback(async () => {
    if (!manualSubject.trim() || !manualFile || !clinicianId.trim()) return;

    const id = ++manualIdRef.current;
    setManualVerifications((prev) => [
      ...prev,
      {
        id,
        subject: manualSubject.trim(),
        attestor: manualAttestor,
        status: 'PENDING' as const,
        timestamp: new Date().toISOString(),
      },
    ]);
    setManualSubmitting(true);

    try {
      const res = await fetch(`${backendUrl}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purpose: 'employment',
          clinician_id: clinicianId,
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        setManualVerifications((prev) =>
          prev.map((v) =>
            v.id === id
              ? {
                  ...v,
                  status: 'FAILED' as const,
                  timestamp: new Date().toISOString(),
                  reason: body || `Request failed (HTTP ${res.status}).`,
                }
              : v,
          ),
        );
        return;
      }

      await res.json();
      setManualVerifications((prev) =>
        prev.map((v) =>
          v.id === id
            ? {
                ...v,
                status: 'COMPLETE' as const,
                timestamp: new Date().toISOString(),
              }
            : v,
        ),
      );

      setManualSubject('');
      setManualFile(null);
    } catch (err) {
      setManualVerifications((prev) =>
        prev.map((v) =>
          v.id === id
            ? {
                ...v,
                status: 'FAILED' as const,
                timestamp: new Date().toISOString(),
                reason:
                  err instanceof Error
                    ? err.message
                    : 'Unable to reach the verification service.',
              }
            : v,
        ),
      );
    } finally {
      setManualSubmitting(false);
      await checkTrustState();
    }
  }, [backendUrl, checkTrustState, clinicianId, manualAttestor, manualFile, manualSubject]);

  const handlePilotActivate = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      setPilotActivationState(null);

      if (!pilotOrganization.trim() || !pilotContactEmail.trim()) {
        setPilotActivationState(
          'Organization name and contact email are required.',
        );
        return;
      }

      setPilotActivationLoading(true);
      try {
        const response = await fetch(`${backendUrl}/api/pilot/activate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationName: pilotOrganization,
            contactEmail: pilotContactEmail,
            ctaVariant,
            ref: verifierRef,
            npi: 'pilot_activation',
          }),
        });

        if (!response.ok) {
          const body = await response.text().catch(() => '');
          throw new Error(body || `Request failed (HTTP ${response.status}).`);
        }

        setPilotActivationState('Pilot access request submitted.');
        setPilotOrganization('');
        setPilotContactEmail('');
      } catch (err) {
        setPilotActivationState(
          err instanceof Error
            ? err.message
            : 'Unable to submit pilot access request.',
        );
      } finally {
        setPilotActivationLoading(false);
      }
    },
    [backendUrl, ctaVariant, pilotContactEmail, pilotOrganization, verifierRef],
  );

  /* ---- Receipt derivation ---- */
  const receiptRows: ReceiptRow[] = useMemo(() => {
    const rows: ReceiptRow[] = [];

    if (status?.timeline_preview) {
      for (const event of status.timeline_preview) {
        if (event.type === 'VERIFICATION_COMPLETED') {
          rows.push({
            lane: (
              (event.metadata?.lane as string) || 'PUBLIC'
            ).toUpperCase(),
            subject:
              (event.metadata?.verification_check as string) ||
              normalizeEventLabel(event.label) ||
              'Verification',
            outcome: 'PASS' as ReceiptOutcome,
            timestamp: event.timestamp,
            hash: getMockHash(event.id || event.timestamp).substring(2, 10),
          });
        } else if (event.type === 'VERIFICATION_FAILED') {
          rows.push({
            lane: (
              (event.metadata?.lane as string) || 'PUBLIC'
            ).toUpperCase(),
            subject:
              (event.metadata?.verification_check as string) ||
              normalizeEventLabel(event.label) ||
              'Verification',
            outcome: 'FAIL' as ReceiptOutcome,
            timestamp: event.timestamp,
            hash: getMockHash(event.id || event.timestamp).substring(2, 10),
          });
        }
      }
    }

    for (const mv of manualVerifications) {
      const outcome: ReceiptOutcome =
        mv.status === 'COMPLETE'
          ? 'PASS'
          : mv.status === 'FAILED'
            ? 'FAIL'
            : 'PENDING';
      rows.push({
        lane: 'MANUAL',
        subject: mv.subject,
        outcome,
        timestamp: mv.timestamp,
        hash: getMockHash(`mv-${mv.id}`).substring(2, 10),
      });
    }

    return rows;
  }, [status?.timeline_preview, manualVerifications]);

  const allReceiptsPass =
    receiptRows.length > 0 && receiptRows.every((r) => r.outcome === 'PASS');
  const failedOrPendingReceipts = receiptRows.filter(
    (r) => r.outcome !== 'PASS',
  );

  /* ---- Render ---- */
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      {/* Header / Input */}
      <VerificationInput
        clinicianId={clinicianId}
        onClinicianIdChange={setClinicianId}
        employerId={employerId}
        onEmployerIdChange={setEmployerId}
        loading={loading}
        onVerify={checkTrustState}
      />

      {/* Error banner */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Trust state + flow */}
      {status && (
        <div className="space-y-6 animate-[trust-panel-enter_0.3s_ease-out]">
          {/* Audit Timeline + Trust State */}
          <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4">
            <div>
              {status.timeline_preview && status.timeline_preview.length > 0 ? (
                <AuditTimeline events={status.timeline_preview as any} />
              ) : (
                <GlassCard className="h-full min-h-[200px] flex flex-col items-center justify-center">
                  <GlassCardContent className="text-center">
                    <History className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No audit history available
                    </p>
                  </GlassCardContent>
                </GlassCard>
              )}
            </div>
            <TrustStatePanel
              status={status}
              simulateDecay={simulateDecay}
              onSimulateDecayChange={setSimulateDecay}
              trustExplanation={trustObserver.explanation}
              trustSummary={trustObserver.summary}
            />
          </div>

          {/* Verification Receipts */}
          {receiptRows.length > 0 && (
            <VerificationReceipts
              receipts={receiptRows}
              crsUpdated={crsUpdatedBanner}
            />
          )}

          {/* Manual Verification */}
          <ManualVerification
            subject={manualSubject}
            onSubjectChange={setManualSubject}
            attestor={manualAttestor}
            onAttestorChange={setManualAttestor}
            file={manualFile}
            onFileChange={setManualFile}
            submitting={manualSubmitting}
            onSubmit={handleManualVerification}
            verifications={manualVerifications}
          />

          {/* 3-Step Flow */}
          <VerificationFlow
            status={status}
            actionLoading={actionLoading}
            onAccept={handleAccept}
            onStart={handleStart}
            allReceiptsPass={allReceiptsPass}
            failedOrPendingReceipts={failedOrPendingReceipts}
          />
        </div>
      )}

      {/* Pilot access form */}
      {pilotModeEnabled && (
        <GlassCard>
          <GlassCardContent>
            <form onSubmit={handlePilotActivate} className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-heading text-sm font-semibold">
                  Verifier Pilot Access
                </h2>
                <Button type="submit" size="sm" disabled={pilotActivationLoading}>
                  {pilotActivationLoading
                    ? 'Submitting\u2026'
                    : pilotActivationButtonLabel}
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  placeholder="Organization name"
                  value={pilotOrganization}
                  onChange={(e) => setPilotOrganization(e.target.value)}
                />
                <Input
                  type="email"
                  placeholder="Contact email"
                  value={pilotContactEmail}
                  onChange={(e) => setPilotContactEmail(e.target.value)}
                />
              </div>
              {pilotActivationState && (
                <p className="text-xs text-muted-foreground">
                  {pilotActivationState}
                </p>
              )}
            </form>
          </GlassCardContent>
        </GlassCard>
      )}
    </main>
  );
}
