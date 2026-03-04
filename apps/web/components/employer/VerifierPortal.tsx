'use client';

import { AuditTimeline } from '@/components/AuditTimeline';
import {
    normalizeTrustStateResponse,
    type TrustStateResponse,
} from '@/components/trust-state/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { GlassCard, GlassCardContent } from '@/components/ui/glass-card';
import { Input } from '@/components/ui/input';
import {
    VerificationReceipts,
    type ReceiptOutcome,
    type ReceiptRow,
} from '@/components/VerificationReceipts';
import { apiRoute } from '@/lib/api';
import { AlertCircle, History } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { EmergencySwitch } from './EmergencySwitch';
import { ManualVerification } from './ManualVerification';
import { SuperbrainInsights } from './SuperbrainInsights';
import { TrustStatePanel } from './TrustStatePanel';
import { VerificationFlow } from './VerificationFlow';
import { VerificationInput } from './VerificationInput';
import type { ManualVerificationRecord } from './verifier-types';
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
  const trustStateRoute = apiRoute('/trust-state');
  const acceptancesRoute = apiRoute('/acceptances');
  const startsRoute = apiRoute('/starts');
  const verifyRoute = apiRoute('/verify');
  const pilotActivateRoute = apiRoute('/api/pilot/activate');
  const orgHeaders = { 'x-org-id': 'demo-pilot-org-alpha' };
  const searchParams = useSearchParams();

  /* ---- Core state ---- */
  const [clinicianId, setClinicianId] = useState('clinician:alice');
  const [employerId, setEmployerId] = useState('employer:alpha');
  const [simulateDecay, setSimulateDecay] = useState(false);
  const [status, setStatus] = useState<TrustStateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previousTrustBand, setPreviousTrustBand] = useState<TrustStateResponse['crs']['band'] | null>(null);

  /* ---- Emergency State ---- */
  const [isEmergencyActive, setIsEmergencyActive] = useState(false);
  const emergencyDeclareRoute = apiRoute('/compliance/emergency/declare');
  const emergencyStatusRoute = apiRoute('/compliance/emergency/status');

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
    const hadStatus = Boolean(status);
    const priorBand = status?.crs?.band ?? null;
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams({
        clinician_id: clinicianId,
        employer_id: employerId,
        simulate_decay: String(simulateDecay),
      });
      const res = await fetch(`${trustStateRoute}?${queryParams.toString()}`, {
        headers: orgHeaders,
      });
      if (!res.ok) throw new Error('Failed to fetch trust state');
      const rawData = await res.json();
      const data = normalizeTrustStateResponse(rawData);
      if (hadStatus && priorBand && data.crs.band !== priorBand) {
        setPreviousTrustBand(priorBand);
      } else {
        setPreviousTrustBand(null);
      }
      setStatus(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      if (!hadStatus) {
        setStatus(null);
        setPreviousTrustBand(null);
      }
    } finally {
      setLoading(false);
    }
  }, [clinicianId, employerId, simulateDecay, status, trustStateRoute]);

  // Auto-check on mount
  useEffect(() => {
    checkTrustState();

    // Check emergency status
    fetch(emergencyStatusRoute, { headers: orgHeaders })
      .then(res => res.json())
      .then(data => setIsEmergencyActive(data.active))
      .catch(console.error);
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
      const res = await fetch(acceptancesRoute, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...orgHeaders },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to accept');
      await checkTrustState();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setActionLoading(false);
    }
  }, [acceptancesRoute, checkTrustState, employerId, status]);

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
      const res = await fetch(startsRoute, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...orgHeaders },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to attest start');
      await checkTrustState();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setActionLoading(false);
    }
  }, [startsRoute, checkTrustState, status]);

  const handleDeclareEmergency = useCallback(async () => {
    try {
      const res = await fetch(emergencyDeclareRoute, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...orgHeaders },
        body: JSON.stringify({ active: true, context: 'Employer-declared Emergency', npi: employerId }),
      });
      if (!res.ok) throw new Error('Failed to declare emergency');
      const data = await res.json();
      setIsEmergencyActive(data.declaration.active);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error declaring emergency');
    }
  }, [emergencyDeclareRoute, employerId, orgHeaders]);

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
      const res = await fetch(verifyRoute, {
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
  }, [checkTrustState, clinicianId, manualAttestor, manualFile, manualSubject, verifyRoute]);

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
        const response = await fetch(pilotActivateRoute, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...orgHeaders },
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
    [pilotActivateRoute, ctaVariant, pilotContactEmail, pilotOrganization, verifierRef],
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
  const isPortalBusy = loading || actionLoading || manualSubmitting || pilotActivationLoading;
  const isRefreshing = loading && Boolean(status);

  /* ---- Render ---- */
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <div className="flex justify-end">
        <EmergencySwitch onDeclareEmergency={handleDeclareEmergency} isEmergencyActive={isEmergencyActive} />
      </div>

      {/* Header / Input */}
      <VerificationInput
        clinicianId={clinicianId}
        onClinicianIdChange={setClinicianId}
        employerId={employerId}
        onEmployerIdChange={setEmployerId}
        loading={loading}
        onVerify={checkTrustState}
        actionInProgress={isPortalBusy}
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
      {(status || loading) && (
        <div className="space-y-6 animate-[trust-panel-enter_0.3s_ease-out]">
          {/* Audit Timeline + Trust State */}
          <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4">
            <div>
              {status ? (
                status.timeline_preview && status.timeline_preview.length > 0 ? (
                  <div className="space-y-3">
                    {isRefreshing && (
                      <p className="text-xs text-muted-foreground px-1">
                        Refreshing trust state…
                      </p>
                    )}
                    <AuditTimeline events={status.timeline_preview as any} />
                  </div>
                ) : (
                  <GlassCard className="h-full min-h-[200px] flex flex-col items-center justify-center">
                    <GlassCardContent className="text-center">
                      <History className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        No audit history available
                      </p>
                    </GlassCardContent>
                  </GlassCard>
                )
              ) : (
                <GlassCard className="h-full min-h-[200px]">
                  <GlassCardContent className="space-y-2">
                    <div className="h-4 w-3/4 bg-muted/50 rounded animate-shimmer" />
                    <div className="h-3 w-1/2 bg-muted/60 rounded animate-shimmer" />
                    <div className="h-24 rounded border border-dashed border-muted/40 bg-muted/30" />
                  </GlassCardContent>
                </GlassCard>
              )}
            </div>
            {status ? (
              <TrustStatePanel
                status={status}
                simulateDecay={simulateDecay}
                onSimulateDecayChange={setSimulateDecay}
                trustExplanation={trustObserver.explanation}
                trustSummary={trustObserver.summary}
                previousTrustBand={previousTrustBand ?? undefined}
              />
            ) : (
              <GlassCard className="h-full min-h-[320px]">
                <GlassCardContent className="space-y-3">
                  <div className="h-5 w-40 bg-muted/50 rounded animate-shimmer" />
                  <div className="grid grid-cols-2 gap-2">
                    <div className="h-4 bg-muted/60 rounded animate-shimmer" />
                    <div className="h-4 bg-muted/60 rounded animate-shimmer" />
                  </div>
                  <div className="h-28 rounded-md border border-muted/30 bg-muted/30" />
                </GlassCardContent>
              </GlassCard>
            )}
          </div>

          {/* Wave 37: Superbrain Intelligence Panel */}
          <SuperbrainInsights />

          {/* Wave 58: Graph Explorer Link */}
          {status && (
            <GlassCard>
              <GlassCardContent className="py-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Trust Network Graph</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Explore credential relationships and trust paths
                  </p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <a href={`/graph/${encodeURIComponent(clinicianId)}`}>
                    Explore Graph →
                  </a>
                </Button>
              </GlassCardContent>
            </GlassCard>
          )}

          {/* Verification Receipts */}
          {receiptRows.length > 0 && (
            <VerificationReceipts
              receipts={receiptRows}
              crsUpdated={crsUpdatedBanner}
              isUpdating={isPortalBusy}
            />
          )}

          {/* Manual Verification */}
          {status && (
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
              disableActions={isPortalBusy}
            />
          )}

          {/* 3-Step Flow */}
          {status && (
            <VerificationFlow
              status={status}
              actionLoading={actionLoading}
              onAccept={handleAccept}
              onStart={handleStart}
              allReceiptsPass={allReceiptsPass}
              failedOrPendingReceipts={failedOrPendingReceipts}
              isUpdating={isPortalBusy}
            />
          )}
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
