'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReceiptOutcome, ReceiptRow } from '@/components/VerificationReceipts';
import { apiRoute, getApiBase } from '@/lib/api';
import {
  type TrustStateResponse,
  normalizeTrustStateResponse,
  type TrustBand,
} from '@/components/trust-state/types';
import { AlertCircle } from 'lucide-react';
import type {
  DataState,
  ExtractedField,
  ManualVerificationRecord,
  NpiIdentityResult,
  VerificationLane,
  VerificationRequestRecord,
} from './intake-types';
import {
  LANE_CONFIG,
  readFileAsBase64,
  receiptHash,
  toExtractedFields,
} from './intake-types';
import { Step1_IdentityClaim } from './Step1_IdentityClaim';
import { Step2_DocumentIntelligence } from './Step2_DocumentIntelligence';
import { Step3_AttestationReview } from './Step3_AttestationReview';

/* ================================================================== */
/*  OnboardingOrchestrator                                             */
/*  ────────────────────────────────────────────────────────────────── */
/*  Manages all intake state. Delegates rendering to step components.  */
/*  Preserves all original API call logic from IntakeContent.tsx.      */
/* ================================================================== */
export function OnboardingOrchestrator() {
  const trustStateRoute = apiRoute('/trust-state');
  const ingestNpiRoute = apiRoute('/ingest/npi');
  const ingestFilesRoute = apiRoute('/ingest/files');
  const verificationRunRoute = apiRoute('/verification/run');
  const isApiConfigured = Boolean(getApiBase());

  /* ---- API reachability check ---- */
  const [apiReachable, setApiReachable] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isApiConfigured) {
      setApiReachable(false);
      return;
    }
    fetch(`${trustStateRoute}?clinician_id=_ping`, { method: 'GET' })
      .then(() => setApiReachable(true))
      .catch(() => setApiReachable(false));
  }, [isApiConfigured, trustStateRoute]);

  /* ---- NPI input ref ---- */
  const npiInputRef = useRef<HTMLInputElement>(null);

  /* ---- Section 1: NPI Lookup ---- */
  const [npi, setNpi] = useState('');
  const [npiValidationError, setNpiValidationError] = useState<string | null>(null);
  const [npiState, setNpiState] = useState<DataState>('idle');
  const [npiResult, setNpiResult] = useState<NpiIdentityResult | null>(null);
  const [npiApiError, setNpiApiError] = useState<string | null>(null);
  const [npiAuditRef, setNpiAuditRef] = useState<string | null>(null);

  /* ---- Section 2: Document Upload ---- */
  const [files, setFiles] = useState<File[]>([]);
  const [fileValidationError, setFileValidationError] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<DataState>('idle');
  const [extractedFields, setExtractedFields] = useState<ExtractedField[]>([]);
  const [uploadApiError, setUploadApiError] = useState<string | null>(null);
  const [uploadAuditRef, setUploadAuditRef] = useState<string | null>(null);

  /* ---- Section 3: Verification Checks ---- */
  const [verificationRequests, setVerificationRequests] = useState<VerificationRequestRecord[]>([]);
  const [verificationErrors, setVerificationErrors] = useState<
    Partial<Record<VerificationLane, string>>
  >({});

  /* ---- Section 4: Trust Status ---- */
  const [trustState, setTrustState] = useState<DataState>('idle');
  const [trustResult, setTrustResult] = useState<TrustStateResponse>(() =>
    normalizeTrustStateResponse(null),
  );
  const [trustApiError, setTrustApiError] = useState<string | null>(null);
  const [trustIsRefreshing, setTrustIsRefreshing] = useState(false);
  const [trustResultStale, setTrustResultStale] = useState(false);
  const [trustActionInFlight, setTrustActionInFlight] = useState(0);
  const [previousTrustBand, setPreviousTrustBand] = useState<TrustBand | null>(null);

  /* ---- CRS change tracking ---- */
  const prevCrsRef = useRef<number | null>(null);
  const [crsUpdatedBanner, setCrsUpdatedBanner] = useState(false);

  /* ---- Employer Manual Verification ---- */
  const [manualSubject, setManualSubject] = useState('');
  const [manualAttestor, setManualAttestor] = useState<'Employer' | 'CVO'>('Employer');
  const [manualFile, setManualFile] = useState<File | null>(null);
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualVerifications, setManualVerifications] = useState<ManualVerificationRecord[]>([]);
  const manualIdRef = useRef(0);
  const manualFileInputRef = useRef<HTMLInputElement>(null);

  /* ---- Progressive disclosure ---- */
  const hasIntakeData = npiState === 'success' || uploadState === 'success';

  /* ================================================================ */
  /*  Handlers                                                         */
  /* ================================================================ */

  const fetchTrustStatus = useCallback(
    async (silent = false) => {
      const cleaned = npi.trim().replace(/\D/g, '');
      const shouldRefreshInPlace = silent && trustState === 'success';
      const shouldPreserve = trustState === 'success';

      if (cleaned.length !== 10) {
        if (!silent) {
          setTrustApiError('Enter a valid NPI first to check trust status.');
          setTrustState('error');
          setTrustResultStale(false);
        }
        return;
      }

      setTrustApiError(null);
      if (!shouldRefreshInPlace) {
        setTrustState('loading');
        setTrustResultStale(false);
      }
      setTrustIsRefreshing(shouldRefreshInPlace);
      const clinicianId = `clinician:npi:${cleaned}`;

      try {
        const params = new URLSearchParams({ clinician_id: clinicianId });
        const res = await fetch(`${trustStateRoute}?${params.toString()}`);
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          setTrustApiError(body || `Trust status lookup failed (HTTP ${res.status}).`);
          if (!silent) {
            setTrustState('error');
            setTrustResult(normalizeTrustStateResponse(null));
            setTrustResultStale(false);
          } else if (shouldPreserve) {
            setTrustResultStale(true);
          }
          return;
        }
        const rawData = await res.json().catch(() => null);
        const data = normalizeTrustStateResponse(rawData);
        if (shouldRefreshInPlace && trustResult.crs.band !== data.crs.band) {
          setPreviousTrustBand(trustResult.crs.band);
        } else if (!shouldRefreshInPlace) {
          setPreviousTrustBand(null);
        }
        setTrustResult(data);
        setTrustState('success');
        setTrustResultStale(false);
      } catch (err) {
        setTrustApiError(err instanceof Error ? err.message : 'Unable to reach the trust service.');
        if (!silent) {
          setTrustState('error');
          setTrustResult(normalizeTrustStateResponse(null));
          setTrustResultStale(false);
        } else if (shouldPreserve) {
          setTrustResultStale(true);
        }
      } finally {
        setTrustIsRefreshing(false);
      }
    },
    [npi, trustResult, trustState, trustStateRoute],
  );

  /* Track CRS score changes */
  useEffect(() => {
    if (prevCrsRef.current !== null && prevCrsRef.current !== trustResult.crs.score) {
      setCrsUpdatedBanner(true);
    }
    prevCrsRef.current = trustResult.crs.score;
  }, [trustResult]);

  const handleNpiLookup = useCallback(async () => {
    const cleaned = npi.trim().replace(/\D/g, '');
    if (cleaned.length !== 10) {
      setNpiValidationError('An NPI number is exactly 10 digits. Please check and try again.');
      return;
    }

    setNpiValidationError(null);
    setNpiApiError(null);
    setNpiAuditRef(null);
    setNpiState('loading');

    try {
      const res = await fetch(ingestNpiRoute, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinician_id: `clinician:npi:${cleaned}`,
          npi: cleaned,
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        setNpiApiError(body || `NPI ingestion failed (HTTP ${res.status}).`);
        setNpiState('error');
        return;
      }

      const data = await res.json();
      setNpiResult(data.clinician_identity ?? data.identity ?? data);
      if (data.audit_ref) setNpiAuditRef(data.audit_ref);
      setNpiState('success');
      fetchTrustStatus(true);
    } catch (err) {
      setNpiApiError(err instanceof Error ? err.message : 'Unable to reach the ingestion service.');
      setNpiState('error');
    }
  }, [npi, ingestNpiRoute, fetchTrustStatus]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const added = Array.from(e.target.files);
    const oversized = added.filter((f) => f.size > 10 * 1024 * 1024);
    if (oversized.length > 0) {
      setFileValidationError(
        `${oversized.map((f) => f.name).join(', ')} exceeded the 10 MB limit.`,
      );
      return;
    }
    setFiles((prev) => [...prev, ...added]);
    setFileValidationError(null);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = useCallback(async () => {
    if (files.length === 0) return;

    setFileValidationError(null);
    setUploadApiError(null);
    setUploadAuditRef(null);
    setUploadState('loading');

    try {
      const cleaned = npi.trim().replace(/\D/g, '');
      const clinicianId =
        cleaned.length === 10 ? `clinician:npi:${cleaned}` : 'clinician:intake:unknown';
      const preparedFiles = await Promise.all(
        files.map(async (file) => ({
          filename: file.name,
          mime_type:
            file.type ||
            (file.name.toLowerCase().endsWith('.pdf')
              ? 'application/pdf'
              : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
          content_base64: await readFileAsBase64(file),
        })),
      );

      const res = await fetch(ingestFilesRoute, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinician_id: clinicianId,
          files: preparedFiles,
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        setUploadApiError(body || `Upload failed (HTTP ${res.status}).`);
        setUploadState('error');
        return;
      }

      const data = await res.json();
      setExtractedFields(toExtractedFields(data.candidate_credentials ?? []));
      if (data.audit_ref) setUploadAuditRef(data.audit_ref);
      setUploadState('success');
      fetchTrustStatus(true);
    } catch (err) {
      setUploadApiError(
        err instanceof Error ? err.message : 'Unable to reach the ingestion service.',
      );
      setUploadState('error');
    }
  }, [files, npi, ingestFilesRoute, fetchTrustStatus]);

  const requestVerification = useCallback(
    async (lane: VerificationLane) => {
      const cleaned = npi.trim().replace(/\D/g, '');
      if (cleaned.length !== 10) return;

      const clinicianId = `clinician:npi:${cleaned}`;
      const { subject } = LANE_CONFIG[lane];

      setVerificationRequests((prev) => [
        ...prev.filter((r) => r.lane !== lane),
        { lane, subject, status: 'PENDING' as const, timestamp: new Date().toISOString() },
      ]);
      setVerificationErrors((prev) => {
        const next = { ...prev };
        delete next[lane];
        return next;
      });
      setTrustActionInFlight((n) => n + 1);

      try {
        const res = await fetch(verificationRunRoute, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ purpose: 'employment', clinician_id: clinicianId }),
        });

        if (!res.ok) {
          const body = await res.text().catch(() => '');
          setVerificationRequests((prev) =>
            prev.map((r) =>
              r.lane === lane
                ? { ...r, status: 'FAILED' as const, timestamp: new Date().toISOString() }
                : r,
            ),
          );
          setVerificationErrors((prev) => ({
            ...prev,
            [lane]: body || `Request failed (HTTP ${res.status}).`,
          }));
          return;
        }

        await res.json();
        setVerificationRequests((prev) =>
          prev.map((r) =>
            r.lane === lane
              ? { ...r, status: 'COMPLETE' as const, timestamp: new Date().toISOString() }
              : r,
          ),
        );
      } catch (err) {
        setVerificationRequests((prev) =>
          prev.map((r) =>
            r.lane === lane
              ? { ...r, status: 'FAILED' as const, timestamp: new Date().toISOString() }
              : r,
          ),
        );
        setVerificationErrors((prev) => ({
          ...prev,
          [lane]: err instanceof Error ? err.message : 'Unable to reach the verification service.',
        }));
      } finally {
        setTrustActionInFlight((n) => Math.max(0, n - 1));
        fetchTrustStatus();
      }
    },
    [npi, verificationRunRoute, fetchTrustStatus],
  );

  const handleManualVerification = useCallback(async () => {
    if (!manualSubject.trim() || !manualFile) return;
    const cleaned = npi.trim().replace(/\D/g, '');
    if (cleaned.length !== 10) return;

    const clinicianId = `clinician:npi:${cleaned}`;
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
    setTrustActionInFlight((n) => n + 1);

    try {
      const res = await fetch(verificationRunRoute, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purpose: 'employment', clinician_id: clinicianId }),
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
            ? { ...v, status: 'COMPLETE' as const, timestamp: new Date().toISOString() }
            : v,
        ),
      );
      setManualSubject('');
      setManualFile(null);
      if (manualFileInputRef.current) manualFileInputRef.current.value = '';
    } catch (err) {
      setManualVerifications((prev) =>
        prev.map((v) =>
          v.id === id
            ? {
                ...v,
                status: 'FAILED' as const,
                timestamp: new Date().toISOString(),
                reason:
                  err instanceof Error ? err.message : 'Unable to reach the verification service.',
              }
            : v,
        ),
      );
    } finally {
      setManualSubmitting(false);
      setTrustActionInFlight((n) => Math.max(0, n - 1));
      fetchTrustStatus();
    }
  }, [
    manualSubject,
    manualAttestor,
    manualFile,
    npi,
    verificationRunRoute,
    fetchTrustStatus,
  ]);

  /* ================================================================ */
  /*  Derived state                                                    */
  /* ================================================================ */

  const receiptRows = useMemo((): ReceiptRow[] => {
    const rows: ReceiptRow[] = [];

    for (const req of verificationRequests) {
      const outcome: ReceiptOutcome =
        req.status === 'COMPLETE' ? 'PASS' : req.status === 'FAILED' ? 'FAIL' : 'PENDING';
      rows.push({
        lane: req.lane.toUpperCase(),
        subject: req.subject,
        outcome,
        timestamp: req.timestamp,
        hash: receiptHash(req.lane, req.subject, req.timestamp),
      });
    }

    for (const mv of manualVerifications) {
      const outcome: ReceiptOutcome =
        mv.status === 'COMPLETE' ? 'PASS' : mv.status === 'FAILED' ? 'FAIL' : 'PENDING';
      rows.push({
        lane: 'MANUAL',
        subject: mv.subject,
        outcome,
        timestamp: mv.timestamp,
        hash: receiptHash('manual', mv.subject, mv.timestamp),
      });
    }

    return rows;
  }, [verificationRequests, manualVerifications]);

  const allReceiptsPass =
    receiptRows.length > 0 && receiptRows.every((r) => r.outcome === 'PASS');
  const failedOrPendingReceipts = receiptRows.filter((r) => r.outcome !== 'PASS');
  const acceptanceEnabled = trustResult.crs.band === 'GREEN' && allReceiptsPass;
  const trustActionInFlightInProgress = trustActionInFlight > 0;

  /* ================================================================ */
  /*  Render                                                           */
  /* ================================================================ */

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-2">
      {/* API unreachable banner */}
      {apiReachable === false && (
        <div className="flex items-start gap-3 rounded-xl bg-destructive/5 border border-destructive/20 p-4 mb-6">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-destructive">
              Backend API is not reachable
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Check that the API server is running and NEXT_PUBLIC_API_BASE is set correctly.
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="text-center space-y-3 pb-8">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
          Your Career Passport
        </h1>
        <p className="text-base text-muted-foreground max-w-lg mx-auto">
          VitalCV builds a living, portable credentialing record. Claim your NPI to see your current readiness, find gaps, and upload evidence to clear them—so you never have to start from scratch again.
        </p>
      </header>

      {/* Progress Stepper */}
      <div className="flex items-center justify-between mb-10 max-w-sm mx-auto relative before:absolute before:inset-0 before:top-1/2 before:-translate-y-1/2 before:w-full before:h-0.5 before:bg-border/60 before:z-0">
        <div className="relative z-10 flex flex-col items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
            npiState === 'success' ? 'bg-primary text-primary-foreground ring-4 ring-background' : 'bg-muted border border-border text-muted-foreground'
          }`}>
            1
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/80 bg-background px-1">Identity</span>
        </div>
        <div className="relative z-10 flex flex-col items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
            uploadState === 'success' ? 'bg-primary text-primary-foreground ring-4 ring-background' : 'bg-muted border border-border text-muted-foreground'
          }`}>
            2
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/80 bg-background px-1">Evidence</span>
        </div>
        <div className="relative z-10 flex flex-col items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
            trustState === 'success' ? 'bg-primary text-primary-foreground ring-4 ring-background' : 'bg-muted border border-border text-muted-foreground'
          }`}>
            3
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/80 bg-background px-1">Passport</span>
        </div>
      </div>

      {/* Step 1: Identity Claim */}
      <Step1_IdentityClaim
        npi={npi}
        onNpiChange={setNpi}
        npiState={npiState}
        npiResult={npiResult}
        npiValidationError={npiValidationError}
        npiApiError={npiApiError}
        npiAuditRef={npiAuditRef}
        onLookup={handleNpiLookup}
        npiInputRef={npiInputRef}
      />

      {/* Step 2: Document Intelligence */}
      <Step2_DocumentIntelligence
        files={files}
        onFileChange={handleFileChange}
        onRemoveFile={removeFile}
        fileValidationError={fileValidationError}
        uploadState={uploadState}
        uploadApiError={uploadApiError}
        uploadAuditRef={uploadAuditRef}
        extractedFields={extractedFields}
        onUpload={handleUpload}
        hasNpi={npiState === 'success'}
      />

      {/* Step 3 + Trust Status + Employer Preview (progressive disclosure) */}
      {hasIntakeData && (
        <Step3_AttestationReview
          npi={npi}
          npiResult={npiResult}
          extractedFields={extractedFields}
          verificationRequests={verificationRequests}
          verificationErrors={verificationErrors}
          onRequestVerification={requestVerification}
          trustState={trustState}
          trustResult={trustResult}
          trustApiError={trustApiError}
          onFetchTrustStatus={() => fetchTrustStatus()}
          manualVerifications={manualVerifications}
          onManualVerification={handleManualVerification}
          manualSubject={manualSubject}
          onManualSubjectChange={setManualSubject}
          manualAttestor={manualAttestor}
          onManualAttestorChange={setManualAttestor}
          manualFile={manualFile}
          onManualFileChange={setManualFile}
          manualSubmitting={manualSubmitting}
          receiptRows={receiptRows}
          crsUpdatedBanner={crsUpdatedBanner}
          acceptanceEnabled={acceptanceEnabled}
          failedOrPendingReceipts={failedOrPendingReceipts}
          trustIsRefreshing={trustIsRefreshing}
          trustResultStale={trustResultStale}
          previousTrustBand={previousTrustBand}
          trustActionInFlight={trustActionInFlightInProgress}
        />
      )}
    </div>
  );
}
