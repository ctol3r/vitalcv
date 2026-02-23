'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type {
  CredentialCandidate as CandidateCredentialApi,
  ClinicianIdentity,
} from '@vitalcv/shared/credentials';
import {
  AlertCircle,
  AlertTriangle,
  Building,
  ClipboardList,
  FileText,
  History,
  Loader2,
  Lock,
  Search,
  Shield,
  ShieldAlert,
  Upload,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  VerificationReceipts,
  type ReceiptRow,
  type ReceiptOutcome,
} from '@/components/VerificationReceipts';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/** Shared async-data state for every section. */
type DataState = 'idle' | 'loading' | 'success' | 'error';

/** NPI identity result — shape determined by the backend. */
type NpiIdentityResult = ClinicianIdentity | Record<string, unknown>;

/** Single extracted field returned from document ingestion. */
type ExtractedField = {
  label: string;
  value: string | null;
  source: string | null;
};

/** Trust-state response from /trust-state. */
type TrustStateResponse = {
  start_ready: boolean;
  crs: { score: number; band: 'GREEN' | 'YELLOW' | 'RED' };
  blocking_reasons: string[];
  blocking_reason_messages?: string[];
  intake_summary?: {
    identities_count: number;
    candidate_credentials_count: number;
    unverified_credentials_count: number;
  };
};

/** Verification lane identifier. */
type VerificationLane = 'public' | 'partner' | 'manual';

/** Client-tracked verification request record. */
type VerificationRequestRecord = {
  lane: VerificationLane;
  subject: string;
  status: 'PENDING' | 'COMPLETE' | 'FAILED';
  timestamp: string;
};

/** Manual verification request record (employer/CVO upload). */
type ManualVerificationRecord = {
  id: number;
  subject: string;
  attestor: string;
  status: 'PENDING' | 'COMPLETE' | 'FAILED';
  timestamp: string;
  reason?: string;
};

/* ------------------------------------------------------------------ */
/*  Locked Copy — exact strings, do not modify                         */
/* ------------------------------------------------------------------ */

const LABELS = {
  UNVERIFIED: 'Unverified data',
  PENDING: 'Pending verification',
  ADDITIONAL_CHECKS: 'Additional checks required to start',
  START_READY_CLARIFICATION:
    'PSV complete. Employer acceptance and start attestation still required.',
} as const;

/* ------------------------------------------------------------------ */
/*  Blocking-reason explanations (plain-language, no jargon)           */
/* ------------------------------------------------------------------ */

const BLOCKING_EXPLANATIONS: Record<string, string> = {
  MISSING_PSV: 'Credentials have not been independently confirmed through a primary source yet.',
  EXPIRED_PSV: 'A credential verification on file has expired and needs to be renewed.',
  REVOKED_PSV: 'A previously valid credential verification has been revoked.',
  IDENTITY_CONFLICT: 'Identity conflict detected between NPI and uploaded resume data.',
  MISSING_ACCEPTANCE: 'No employer has reviewed and accepted credentials yet.',
  CRS_BELOW_THRESHOLD: 'Overall credential readiness is below the minimum required to begin clinical work.',
  START_ALREADY_ATTESTED: 'A start date has already been recorded.',
  MISSING_RECOGNITION: 'Not yet recognized by the verification network.',
  NO_ACTIVE_LICENSE: 'No active professional license was found on record.',
  ACTIVE_SANCTIONS: 'There are active sanctions or disciplinary actions on record.',
  VERIFICATION_EXPIRED: 'Credential verification has expired and needs to be refreshed.',
};

/* ------------------------------------------------------------------ */
/*  Verification Lane Config                                           */
/* ------------------------------------------------------------------ */

const LANE_CONFIG: Record<
  VerificationLane,
  { label: string; subject: string; description: string }
> = {
  public: {
    label: 'Run Public Checks',
    subject: 'NPI confirmation, sanctions',
    description: 'Confirms NPI registry status and screens against sanctions lists.',
  },
  partner: {
    label: 'Request Partner Check',
    subject: 'FCVS / ABMS',
    description: 'Requests credential verification through FCVS or ABMS. (Not yet connected.)',
  },
  manual: {
    label: 'Upload Manual Verification',
    subject: 'CVO / employer doc',
    description: 'Records a manually submitted CVO letter or employer verification document.',
  },
};

const LANE_ORDER: VerificationLane[] = ['public', 'partner', 'manual'];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function bandColors(band: string) {
  switch (band) {
    case 'GREEN':
      return {
        bg: 'bg-slate-100',
        text: 'text-slate-800',
        border: 'border-slate-200',
        dot: 'bg-slate-500',
        stripe: 'border-l-slate-600',
        label: 'CRS threshold met (employer action required)',
      };
    case 'YELLOW':
      return {
        bg: 'bg-amber-50',
        text: 'text-amber-800',
        border: 'border-amber-200',
        dot: 'bg-amber-500',
        stripe: 'border-l-amber-500',
        label: 'Needs Attention',
      };
    default:
      return {
        bg: 'bg-red-50',
        text: 'text-red-800',
        border: 'border-red-200',
        dot: 'bg-red-500',
        stripe: 'border-l-red-600',
        label: 'Action Required',
      };
  }
}

function toExtractedFields(credentials: CandidateCredentialApi[]): ExtractedField[] {
  if (!Array.isArray(credentials) || credentials.length === 0) {
    return [];
  }

  const all = credentials[0];
  const licenses = Array.isArray(all.licenses) ? all.licenses : [];
  const licenseValue =
    licenses.length > 0
      ? licenses
          .map((entry) => `${entry.state}${entry.number ? ` #${entry.number}` : ''}`)
          .join(', ')
      : null;

  const toValue = (value: unknown) =>
    Array.isArray(value) && value.length > 0
      ? value.map((entry) => String(entry)).join('; ')
      : null;

  return [
    {
      label: 'Education',
      value: toValue(all.education),
      source: 'resume_upload',
    },
    {
      label: 'Training',
      value: toValue(all.training),
      source: 'resume_upload',
    },
    {
      label: 'Licensure mentions',
      value: toValue(all.licensure_mentions),
      source: 'resume_upload',
    },
    {
      label: 'Licenses (multiple supported)',
      value: licenseValue,
      source: 'resume_upload',
    },
    {
      label: 'Employment timeline',
      value: toValue(all.employment_timeline),
      source: 'resume_upload',
    },
  ];
}

async function readFileAsBase64(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let idx = 0; idx < bytes.length; idx += 1) {
    binary += String.fromCharCode(bytes[idx]);
  }
  return btoa(binary);
}

/** Deterministic 8-char hex hash for receipt display. */
function receiptHash(lane: string, subject: string, timestamp: string): string {
  const input = `${lane}:${subject}:${timestamp}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0').substring(0, 8);
}

function formatDisplayValue(key: string, value: unknown): string {
  if (Array.isArray(value)) {
    if (key.toLowerCase().includes('license')) {
      return value
        .map((entry) => {
          if (!entry || typeof entry !== 'object') return String(entry);
          const record = entry as Record<string, unknown>;
          const state = typeof record.state === 'string' ? record.state : 'UNKNOWN';
          const number = typeof record.number === 'string' ? ` #${record.number}` : '';
          const source = typeof record.source === 'string' ? ` (${record.source})` : '';
          return `${state}${number}${source}`;
        })
        .join(', ');
    }

    return value.map((entry) => String(entry)).join(', ');
  }

  if (value && typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value ?? '—');
}

/* ================================================================== */
/*  ResultPanel — shared data-state container for each section         */
/* ================================================================== */

function ResultPanel({
  state,
  errorMessage,
  children,
}: {
  state: DataState;
  errorMessage: string | null;
  children: React.ReactNode;
}) {
  if (state === 'idle') {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
        <p className="text-sm text-slate-400">No data yet. Results will appear here.</p>
      </div>
    );
  }

  if (state === 'loading') {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 flex flex-col items-center gap-2">
        <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
        <p className="text-sm text-slate-500">Loading&hellip;</p>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">
            {errorMessage || 'Something went wrong. Please try again.'}
          </p>
        </div>
      </div>
    );
  }

  /* state === 'success' */
  return <>{children}</>;
}

/* ================================================================== */
/*  IntakePage                                                         */
/* ================================================================== */

export function IntakeContent() {
  const backendUrl =
    process.env.NEXT_PUBLIC_API_BASE ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    '';
    const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

  /* ---- API reachability check ---- */
  const [apiReachable, setApiReachable] = useState<boolean | null>(null);

  useEffect(() => {
    if (!backendUrl) {
      setApiReachable(false);
      return;
    }

    fetch(`${backendUrl}${DEMO_MODE ? '/demo/status' : '/trust-state'}?clinician_id=_ping`, { method: 'GET' })
      .then(() => setApiReachable(true))
      .catch(() => setApiReachable(false));
  }, [backendUrl]);

  /* ---- NPI input ref ---- */
  const npiInputRef = useRef<HTMLInputElement>(null);

  /* ---- Section 1: NPI Lookup ---- */
  const [npi, setNpi] = useState('');
  const [npiValidationError, setNpiValidationError] = useState<string | null>(null);
  const [npiState, setNpiState] = useState<DataState>('idle');
  const [npiResult, setNpiResult] = useState<NpiIdentityResult | null>(null);
  const [npiApiError, setNpiApiError] = useState<string | null>(null);

  /* ---- Section 2: Document Upload ---- */
  const [files, setFiles] = useState<File[]>([]);
  const [fileValidationError, setFileValidationError] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<DataState>('idle');
  const [extractedFields, setExtractedFields] = useState<ExtractedField[]>([]);
  const [uploadApiError, setUploadApiError] = useState<string | null>(null);

  /* ---- Section 3: Verification Checks ---- */
  const [verificationRequests, setVerificationRequests] = useState<VerificationRequestRecord[]>([]);
  const [verificationErrors, setVerificationErrors] = useState<
    Partial<Record<VerificationLane, string>>
  >({});

  /* ---- Audit refs ---- */
  const [npiAuditRef, setNpiAuditRef] = useState<string | null>(null);
  const [uploadAuditRef, setUploadAuditRef] = useState<string | null>(null);

  /* ---- Section 4: Trust Status ---- */
  const [trustState, setTrustState] = useState<DataState>('idle');
  const [trustResult, setTrustResult] = useState<TrustStateResponse | null>(null);
  const [trustApiError, setTrustApiError] = useState<string | null>(null);

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

  /* ---------------------------------------------------------------- */
  /*  Trust Status handler (defined first — called by NPI and upload   */
  /*  handlers after successful ingestion)                             */
  /* ---------------------------------------------------------------- */

  const fetchTrustStatus = useCallback(
    async (silent = false) => {
      const cleaned = npi.trim().replace(/\D/g, '');

      if (cleaned.length !== 10) {
        if (!silent) {
          setTrustApiError('Enter a valid NPI first to check trust status.');
          setTrustState('error');
        }
        return;
      }

      setTrustApiError(null);
      setTrustState('loading');

      const clinicianId = `clinician:npi:${cleaned}`;

      try {
        const params = new URLSearchParams({ clinician_id: clinicianId });
        const res = await fetch(`${backendUrl}${DEMO_MODE ? '/demo/status' : '/trust-state'}?${params.toString()}`);

        if (!res.ok) {
          const body = await res.text().catch(() => '');
          setTrustApiError(body || `Trust status lookup failed (HTTP ${res.status}).`);
          setTrustState('error');
          return;
        }

        const data: TrustStateResponse = await res.json();
        setTrustResult(data);
        setTrustState('success');
      } catch (err) {
        setTrustApiError(err instanceof Error ? err.message : 'Unable to reach the trust service.');
        setTrustState('error');
      }
    },
    [npi, backendUrl],
  );

  /* ---- Track CRS score changes ---- */
  useEffect(() => {
    if (trustResult?.crs?.score != null) {
      const readinessScore = trustResult.crs.score;
      if (prevCrsRef.current !== null && prevCrsRef.current !== readinessScore) {
        setCrsUpdatedBanner(true);
      }
      prevCrsRef.current = readinessScore;
    }
  }, [trustResult]);

  /* ---------------------------------------------------------------- */
  /*  Section 1: NPI Lookup handler                                    */
  /* ---------------------------------------------------------------- */

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
      const res = await fetch(`${backendUrl}${DEMO_MODE ? '/demo/issue' : '/ingest/npi'}`, {
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

      // Refresh trust-state after successful ingestion
      fetchTrustStatus(true);
    } catch (err) {
      setNpiApiError(err instanceof Error ? err.message : 'Unable to reach the ingestion service.');
      setNpiState('error');
    }
  }, [npi, backendUrl, fetchTrustStatus]);

  /* ---------------------------------------------------------------- */
  /*  Section 2: File handlers                                         */
  /* ---------------------------------------------------------------- */

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

      const res = await fetch(`${backendUrl}/ingest/files`, {
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

      // Refresh trust-state after successful ingestion
      fetchTrustStatus(true);
    } catch (err) {
      setUploadApiError(
        err instanceof Error ? err.message : 'Unable to reach the ingestion service.',
      );
      setUploadState('error');
    }
  }, [files, npi, backendUrl, fetchTrustStatus]);

  /* ---------------------------------------------------------------- */
  /*  Section 3: Verification request handler                          */
  /* ---------------------------------------------------------------- */

  const requestVerification = useCallback(
    async (lane: VerificationLane) => {
      const cleaned = npi.trim().replace(/\D/g, '');
      if (cleaned.length !== 10) return;

      const clinicianId = `clinician:npi:${cleaned}`;
      const { subject } = LANE_CONFIG[lane];

      // Replace any previous record for this lane with PENDING.
      setVerificationRequests((prev) => [
        ...prev.filter((r) => r.lane !== lane),
        {
          lane,
          subject,
          status: 'PENDING' as const,
          timestamp: new Date().toISOString(),
        },
      ]);
      setVerificationErrors((prev) => {
        const next = { ...prev };
        delete next[lane];
        return next;
      });

      try {
        const res = await fetch(`${backendUrl}/verification/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            purpose: 'employment',
            clinician_id: clinicianId,
          }),
        });

        if (!res.ok) {
          const body = await res.text().catch(() => '');
          setVerificationRequests((prev) =>
            prev.map((r) =>
              r.lane === lane
                ? {
                    ...r,
                    status: 'FAILED' as const,
                    timestamp: new Date().toISOString(),
                  }
                : r,
            ),
          );
          setVerificationErrors((prev) => ({
            ...prev,
            [lane]: body || `Request failed (HTTP ${res.status}).`,
          }));
          return;
        }

        // Consume response — trust state refresh below handles UI update.
        await res.json();

        setVerificationRequests((prev) =>
          prev.map((r) =>
            r.lane === lane
              ? {
                  ...r,
                  status: 'COMPLETE' as const,
                  timestamp: new Date().toISOString(),
                }
              : r,
          ),
        );
      } catch (err) {
        setVerificationRequests((prev) =>
          prev.map((r) =>
            r.lane === lane
              ? {
                  ...r,
                  status: 'FAILED' as const,
                  timestamp: new Date().toISOString(),
                }
              : r,
          ),
        );
        setVerificationErrors((prev) => ({
          ...prev,
          [lane]: err instanceof Error ? err.message : 'Unable to reach the verification service.',
        }));
      } finally {
        // Always refresh trust state after a verification attempt.
        fetchTrustStatus();
      }
    },
    [npi, backendUrl, fetchTrustStatus],
  );

  /* ---------------------------------------------------------------- */
  /*  Employer Manual Verification handler                             */
  /* ---------------------------------------------------------------- */

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

    try {
      const res = await fetch(`${backendUrl}/verification/run`, {
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
            ? { ...v, status: 'COMPLETE' as const, timestamp: new Date().toISOString() }
            : v,
        ),
      );

      // Reset form
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
      // Refresh trust state after any verification attempt
      fetchTrustStatus();
    }
  }, [manualSubject, manualAttestor, manualFile, npi, backendUrl, fetchTrustStatus]);

  /* ---------------------------------------------------------------- */
  /*  Verification Receipts (derived from request + manual records)    */
  /* ---------------------------------------------------------------- */

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
  const readiness = trustResult?.crs;
  const band = readiness?.band ?? 'NOT_READY';
  const score = readiness?.score ?? 0;
  const acceptanceEnabled = band === 'GREEN' && allReceiptsPass;

  /* ================================================================ */
  /*  Render                                                           */
  /* ================================================================ */

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-8 sm:py-8 flex flex-col items-center justify-start font-sans">
      <div className="w-full max-w-2xl space-y-6 sm:space-y-8">
        {/* ---------- API unavailable banner ---------- */}
        {apiReachable === false && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">API unavailable</p>
              <p className="text-xs text-amber-600 mt-0.5">
                {backendUrl
                  ? `Unable to reach ${backendUrl}. Please check the service status.`
                  : 'NEXT_PUBLIC_API_BASE is not configured.'}
              </p>
            </div>
          </div>
        )}

        {/* ---------- Header ---------- */}
        <header className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <ClipboardList className="w-7 h-7 text-slate-700" />
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Clinician Intake</h1>
          </div>
          <p className="text-slate-500 text-sm max-w-md mx-auto">
            Provide your information below. All collected data is labeled{' '}
            <strong>&ldquo;{LABELS.UNVERIFIED}&rdquo;</strong> until independently confirmed.
          </p>
        </header>

        {/* ========================================================== */}
        {/*  SECTION 1 — NPI Lookup                                    */}
        {/* ========================================================== */}
        <section aria-labelledby="section-npi">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle id="section-npi" className="flex items-center gap-2 text-lg">
                <Search className="w-5 h-5 text-slate-600" />
                NPI Lookup
              </CardTitle>
              <CardDescription>
                Enter a 10-digit National Provider Identifier to look up publicly available identity
                information.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Input + button */}
              <div className="space-y-2">
                <Label htmlFor="npi">NPI Number</Label>
                <div className="flex gap-2">
                  <Input
                    ref={npiInputRef}
                    id="npi"
                    type="text"
                    inputMode="numeric"
                    placeholder="1234567890"
                    value={npi}
                    onChange={(e) => {
                      setNpi(e.target.value);
                      if (npiValidationError) setNpiValidationError(null);
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleNpiLookup()}
                    maxLength={10}
                    className="font-mono text-lg tracking-wider"
                  />
                  <Button
                    onClick={handleNpiLookup}
                    disabled={npiState === 'loading' || !npi.trim()}
                    className="shrink-0 bg-slate-900 hover:bg-slate-800"
                  >
                    {npiState === 'loading' ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Looking up&hellip;
                      </>
                    ) : (
                      'Lookup NPI'
                    )}
                  </Button>
                </div>
                {npiValidationError && (
                  <p className="text-sm text-red-600 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    {npiValidationError}
                  </p>
                )}
              </div>

              {/* Identity result panel */}
              <ResultPanel state={npiState} errorMessage={npiApiError}>
                {npiResult && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-slate-500 uppercase tracking-wider">
                        Identity Result
                      </Label>
                      <Badge className="bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-100 text-[11px]">
                        {LABELS.UNVERIFIED}
                      </Badge>
                    </div>
                    <div className="rounded-md border border-slate-200 bg-white divide-y divide-slate-100">
                      {Object.entries(npiResult).map(([key, value]) => (
                        <div key={key} className="flex justify-between px-4 py-2.5 text-sm">
                          <span className="font-medium text-slate-700">{key}</span>
                          <span className="text-slate-900">{formatDisplayValue(key, value)}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-slate-400">
                      This data has not been independently confirmed. It reflects what was returned
                      from the ingestion service only.
                    </p>
                    {npiAuditRef && (
                      <p className="text-xs text-slate-400 font-mono">
                        Recorded &middot; {npiAuditRef}
                      </p>
                    )}
                  </div>
                )}
              </ResultPanel>
            </CardContent>
          </Card>
        </section>

        {/* ========================================================== */}
        {/*  SECTION 2 — Resume / Document Upload                      */}
        {/* ========================================================== */}
        <section aria-labelledby="section-upload">
          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle id="section-upload" className="flex items-center gap-2 text-lg">
                  <FileText className="w-5 h-5 text-slate-600" />
                  Resume / Document Upload
                </CardTitle>
                <Badge className="bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-100 text-[11px]">
                  {LABELS.UNVERIFIED}
                </Badge>
              </div>
              <CardDescription>
                Upload a resume, CV, or credential documents (PDF or DOCX). Extracted data is{' '}
                <strong>unverified</strong> until independently confirmed.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Upload area */}
              <label
                htmlFor="file-upload"
                className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50/50 p-8 cursor-pointer hover:border-slate-300 hover:bg-slate-50 transition-colors"
              >
                <Upload className="w-8 h-8 text-slate-400" />
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-700">Click to select files</p>
                  <p className="text-xs text-slate-400 mt-1">PDF or DOCX — up to 10&nbsp;MB each</p>
                </div>
                <input
                  id="file-upload"
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
              <p className="text-xs text-slate-500">File is not stored in this preview.</p>

              {/* Validation error */}
              {fileValidationError && (
                <p className="text-sm text-red-600 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {fileValidationError}
                </p>
              )}

              {/* File list */}
              {files.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-slate-500 uppercase tracking-wider">
                    Selected files
                  </Label>
                  {files.map((file, i) => (
                    <div
                      key={`${file.name}-${i}`}
                      className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="text-sm text-slate-700 truncate">{file.name}</span>
                        <span className="text-xs text-slate-400 shrink-0">
                          {(file.size / 1024).toFixed(0)}&nbsp;KB
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        className="text-slate-400 hover:text-red-500 transition-colors ml-2"
                        aria-label={`Remove ${file.name}`}
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  <Button
                    onClick={handleUpload}
                    disabled={uploadState === 'loading' || files.length === 0}
                    className="w-full bg-slate-900 hover:bg-slate-800"
                  >
                    {uploadState === 'loading' ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Uploading&hellip;
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        Upload &amp; Extract
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* Extracted data panel */}
              <ResultPanel state={uploadState} errorMessage={uploadApiError}>
                {extractedFields.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-slate-500 uppercase tracking-wider">
                        Extracted Data
                      </Label>
                      <Badge className="bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-100 text-[11px]">
                        {LABELS.UNVERIFIED}
                      </Badge>
                    </div>
                    <div className="rounded-md border border-slate-200 overflow-x-auto">
                      <table className="w-full text-sm min-w-[480px]">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                              Field
                            </th>
                            <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                              Value
                            </th>
                            <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                              Status
                            </th>
                            <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                              Source
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {extractedFields.map((field, i) => (
                            <tr key={i} className={!field.value ? 'bg-amber-50/50' : 'bg-white'}>
                              <td className="px-4 py-2.5 font-medium text-slate-700">
                                {field.label}
                              </td>
                              <td className="px-4 py-2.5">
                                {field.value ? (
                                  <span className="text-slate-900">{field.value}</span>
                                ) : (
                                  <span className="text-amber-600 text-xs flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" />
                                    Missing
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2.5">
                                {field.value ? (
                                  <Badge className="bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-100 text-[11px] font-medium">
                                    UNVERIFIED
                                  </Badge>
                                ) : (
                                  <span className="text-xs text-slate-400">&mdash;</span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-xs text-slate-400">
                                {field.source || '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {/* Missing fields summary */}
                    {extractedFields.filter((f) => !f.value).length > 0 && (
                      <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                        <p className="text-xs font-medium text-amber-800 mb-1">
                          Missing fields ({extractedFields.filter((f) => !f.value).length})
                        </p>
                        <ul className="text-xs text-amber-700 list-disc list-inside space-y-0.5">
                          {extractedFields
                            .filter((f) => !f.value)
                            .map((f) => (
                              <li key={f.label}>{f.label}</li>
                            ))}
                        </ul>
                      </div>
                    )}
                    <p className="text-xs text-slate-400">
                      Extracted data has not been independently confirmed. Verification happens
                      after intake is complete.
                    </p>
                    {uploadAuditRef && (
                      <p className="text-xs text-slate-400 font-mono">
                        Recorded &middot; {uploadAuditRef}
                      </p>
                    )}
                  </div>
                )}
              </ResultPanel>
            </CardContent>
          </Card>
        </section>

        {/* ========================================================== */}
        {/*  SECTION 3 — Verification Checks                           */}
        {/* ========================================================== */}
        <section aria-labelledby="section-verification">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle id="section-verification" className="flex items-center gap-2 text-lg">
                <Shield className="w-5 h-5 text-slate-600" />
                Verification Checks
              </CardTitle>
              <CardDescription>
                Each check produces an auditable receipt. Pending checks do not affect trust status.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
              {/* Lane buttons */}
              <div className="space-y-3">
                {LANE_ORDER.map((lane) => {
                  const config = LANE_CONFIG[lane];
                  const existing = verificationRequests.find((r) => r.lane === lane);
                  const isPending = existing?.status === 'PENDING';
                  const hasNpi = npi.trim().replace(/\D/g, '').length === 10;

                  return (
                    <div key={lane} className="space-y-1.5">
                      <Button
                        onClick={() => requestVerification(lane)}
                        disabled={isPending || !hasNpi}
                        variant="outline"
                        className="w-full justify-start gap-2"
                      >
                        {isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                        ) : (
                          <Shield className="w-4 h-4 shrink-0" />
                        )}
                        {config.label}
                      </Button>
                      <p className="text-xs text-slate-400 pl-1">{config.description}</p>
                      {verificationErrors[lane] && (
                        <p className="text-xs text-red-600 flex items-center gap-1 pl-1">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          {verificationErrors[lane]}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Verification status list — always visible once any request exists */}
              {verificationRequests.length > 0 && (
                <div className="space-y-3">
                  <Label className="text-xs text-slate-500 uppercase tracking-wider">
                    Verification Requests
                  </Label>
                  <div className="rounded-md border border-slate-200 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            Lane
                          </th>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            Subject
                          </th>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            Timestamp
                          </th>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            Receipt
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {verificationRequests.map((req) => (
                          <tr
                            key={req.lane}
                            className={req.status === 'FAILED' ? 'bg-red-50/30' : 'bg-white'}
                          >
                            <td className="px-4 py-2.5 font-medium text-slate-700 capitalize">
                              {req.lane}
                            </td>
                            <td className="px-4 py-2.5 text-slate-600">{req.subject}</td>
                            <td className="px-4 py-2.5">
                              <Badge
                                className={`text-[11px] border ${
                                  req.status === 'PENDING'
                                    ? 'bg-gray-50 text-gray-600 border-gray-200'
                                    : req.status === 'COMPLETE'
                                    ? 'bg-green-50 text-green-800 border-green-200'
                                    : 'bg-red-50 text-red-800 border-red-200'
                                } hover:bg-transparent`}
                              >
                                <span className={`inline-block h-2 w-2 rounded-full mr-1.5 ${
                                  req.status === 'PENDING'
                                    ? 'bg-gray-400'
                                    : req.status === 'COMPLETE'
                                    ? 'bg-green-600'
                                    : 'bg-red-600'
                                }`} />
                                {req.status === 'PENDING'
                                  ? 'PENDING'
                                  : req.status === 'COMPLETE'
                                  ? 'PASS'
                                  : 'FAIL'}
                              </Badge>
                            </td>
                            <td className="px-4 py-2.5 text-xs text-slate-400 font-mono">
                              {new Date(req.timestamp).toLocaleTimeString()}
                            </td>
                            <td className="px-4 py-2.5">
                              {req.status === 'COMPLETE' ? (
                                <span className="text-xs text-slate-700 flex items-center gap-1">
                                  <span className="inline-block h-2 w-2 rounded-full bg-slate-500" />
                                  Recorded
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400">&mdash;</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* ========================================================== */}
        {/*  SECTION 4 — Trust Status                                  */}
        {/* ========================================================== */}
        <section aria-labelledby="section-trust">
          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle id="section-trust" className="flex items-center gap-2 text-lg">
                  <ShieldAlert className="w-5 h-5 text-slate-600" />
                  Trust Status
                </CardTitle>
                <div className="flex items-center gap-1.5 text-slate-400" title="All decisions are timestamped and replayable">
                  <History className="w-3 h-3" />
                  <span className="text-xs font-medium uppercase tracking-wider">Audit-backed</span>
                </div>
              </div>
              <CardDescription>
                Shows the current trust state based on what has been checked so far. Nothing here is
                a guarantee.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <Button
                onClick={() => fetchTrustStatus()}
                disabled={trustState === 'loading' || !npi.trim()}
                variant="outline"
                className="w-full"
              >
                {trustState === 'loading' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Checking status&hellip;
                  </>
                ) : (
                  'Check Trust Status'
                )}
              </Button>

              {/* Trust result panel */}
              <ResultPanel state={trustState} errorMessage={trustApiError}>
                {trustResult && (
                  <div className="space-y-4">
                    {!readiness ? (
                      <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                        Demo data not available
                      </p>
                    ) : (
                      <>
                        {/* Trust-State panel: CRS display */}
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                          <div>
                            <Label className="text-xs text-slate-500 uppercase tracking-wider block mb-1">
                              Credential Readiness Score (CRS)
                            </Label>
                            <div className="flex items-baseline gap-1">
                              <span className="text-3xl font-mono font-bold text-slate-900">
                                {score}
                              </span>
                              <span className="text-sm text-slate-400">/ 100</span>
                            </div>
                          </div>

                          <div>
                            <Label className="text-xs text-slate-500 uppercase tracking-wider block mb-1">
                              Level
                            </Label>
                            <Badge
                              className={`${bandColors(band).bg} ${
                                bandColors(band).text
                              } ${bandColors(band).border} border text-sm px-3 py-1`}
                            >
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  bandColors(band).dot
                                } inline-block mr-1.5`}
                              />
                              {bandColors(band).label}
                            </Badge>
                          </div>

                      <div>
                        <Label className="text-xs text-slate-500 uppercase tracking-wider block mb-1">
                          Employer action required
                        </Label>
                        {trustResult.start_ready ? (
                          <div className="flex items-center gap-1.5">
                            <span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-500" />
                            <span className="font-semibold text-slate-700">Conditional</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <XCircle className="w-5 h-5 text-red-600" />
                            <span className="font-semibold text-red-700">Not yet</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Blocking reasons list */}
                    {trustResult.blocking_reasons.length > 0 && !trustResult.start_ready && (
                      <div className="space-y-2">
                        <Label className="text-xs text-slate-500 uppercase tracking-wider">
                          {LABELS.ADDITIONAL_CHECKS}
                        </Label>
                        <div className="space-y-2">
                          {(trustResult.blocking_reason_messages &&
                          trustResult.blocking_reason_messages.length > 0
                            ? trustResult.blocking_reason_messages
                            : trustResult.blocking_reasons.map(
                                (reason) =>
                                  BLOCKING_EXPLANATIONS[reason] || reason.replace(/_/g, ' '),
                              )
                          ).map((message) => (
                            <div
                              key={message}
                              className="flex items-start gap-2 rounded-md bg-red-50 border border-red-100 p-3"
                            >
                              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                              <p className="text-sm font-medium text-red-800">{message}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Pending verification notice */}
                    {!trustResult.start_ready && (
                      <div className="rounded-md bg-amber-50 border border-amber-200 p-3 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-sm font-medium text-amber-800">{LABELS.PENDING}</p>
                      </div>
                    )}

                    {/* All clear */}
                    {trustResult.start_ready && (
                      <div className="rounded-md bg-slate-50 border border-slate-200 p-3 flex items-start gap-2">
                        <span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-500 shrink-0 mt-1.5" />
                        <p className="text-sm font-medium text-slate-800">
                          {LABELS.START_READY_CLARIFICATION}
                        </p>
                      </div>
                      </>
                    )}
                  </div>
                )}
              </ResultPanel>
            </CardContent>
          </Card>
        </section>

        {/* ========================================================== */}
        {/*  HANDOFF DIVIDER — Intake ends / Employer view begins       */}
        {/* ========================================================== */}
        {npiState === 'success' && npiResult && (
          <>
            <div className="relative py-6" role="separator" aria-label="Employer view begins below">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t-2 border-slate-300" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-slate-50 px-4 flex items-center gap-2">
                  <Building className="w-5 h-5 text-slate-500" />
                  <span className="text-sm font-semibold text-slate-600 uppercase tracking-wider">
                    Employer View
                  </span>
                </span>
              </div>
            </div>
            <p className="text-center text-xs text-slate-400 -mt-4 mb-2">
              Below is what an employer would see based on intake data collected above. No
              authentication is applied to this preview.
            </p>

            {/* ====================================================== */}
            {/*  EMPLOYER PREVIEW PANEL                                 */}
            {/* ====================================================== */}
            <section aria-labelledby="section-employer-preview">
              <Card className="shadow-sm border-slate-300">
                <CardHeader>
                  <CardTitle
                    id="section-employer-preview"
                    className="flex items-center gap-2 text-lg"
                  >
                    <Building className="w-5 h-5 text-slate-600" />
                    Clinician Verification Status
                  </CardTitle>
                  <CardDescription>
                    All data shown is labeled <strong>&ldquo;{LABELS.UNVERIFIED}&rdquo;</strong>{' '}
                    until independent verification is complete. This is not an endorsement.
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-6">
                  {/* ---- Clinician Identity (from NPI) ---- */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-slate-500 uppercase tracking-wider">
                        Clinician Identity
                      </Label>
                      <Badge className="bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-100 text-[11px]">
                        {LABELS.UNVERIFIED}
                      </Badge>
                    </div>
                    <div className="rounded-md border border-slate-200 bg-white divide-y divide-slate-100">
                      {Object.entries(npiResult).map(([key, value]) => (
                        <div key={key} className="flex justify-between px-4 py-2.5 text-sm">
                          <span className="font-medium text-slate-700">{key}</span>
                          <span className="text-slate-900">{formatDisplayValue(key, value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ---- Extracted Credentials ---- */}
                  {extractedFields.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-slate-500 uppercase tracking-wider">
                          Extracted Credentials
                        </Label>
                        <Badge className="bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-100 text-[11px]">
                          {LABELS.UNVERIFIED}
                        </Badge>
                      </div>
                      <div className="rounded-md border border-slate-200 overflow-x-auto">
                        <table className="w-full text-sm min-w-[400px]">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                              <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                Credential
                              </th>
                              <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                Value
                              </th>
                              <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                Status
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {extractedFields.map((field, i) => (
                              <tr key={i} className="bg-white">
                                <td className="px-4 py-2.5 font-medium text-slate-700">
                                  {field.label}
                                </td>
                                <td className="px-4 py-2.5 text-slate-900">
                                  {field.value ?? (
                                    <span className="text-amber-600 text-xs flex items-center gap-1">
                                      <AlertTriangle className="w-3 h-3" />
                                      Missing
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-2.5">
                                  <Badge className="bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-100 text-[11px]">
                                    {LABELS.UNVERIFIED}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* ---- Manual Verification ---- */}
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <Label className="text-xs text-slate-500 uppercase tracking-wider">
                        Manual Verification
                      </Label>
                      <p className="text-xs text-slate-400">
                        Upload a document for preview review. This creates a recorded receipt.
                      </p>
                    </div>

                    {/* Upload form */}
                    <div className="rounded-md border border-slate-200 bg-white p-4 space-y-4">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="manual-subject" className="text-sm text-slate-700">
                            Subject
                          </Label>
                          <Input
                            id="manual-subject"
                            type="text"
                            placeholder="e.g., License – State, Education"
                            value={manualSubject}
                            onChange={(e) => setManualSubject(e.target.value)}
                            className="text-sm"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="manual-attestor" className="text-sm text-slate-700">
                            Attestor
                          </Label>
                          <select
                            id="manual-attestor"
                            aria-label="Attestor"
                            value={manualAttestor}
                            onChange={(e) =>
                              setManualAttestor(e.target.value as 'Employer' | 'CVO')
                            }
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          >
                            <option value="Employer">Employer</option>
                            <option value="CVO">CVO</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="manual-doc" className="text-sm text-slate-700">
                          Document
                        </Label>
                        <div className="flex items-center gap-2">
                          <label
                            htmlFor="manual-doc"
                            className="flex items-center gap-2 rounded-md border border-dashed border-slate-200 bg-slate-50/50 px-4 py-2 cursor-pointer hover:border-slate-300 transition-colors flex-1"
                          >
                            <Upload className="w-4 h-4 text-slate-400" />
                            <span className="text-sm text-slate-500">
                              {manualFile ? manualFile.name : 'Select PDF or DOCX'}
                            </span>
                            <input
                              ref={manualFileInputRef}
                              id="manual-doc"
                              type="file"
                              accept=".pdf,.doc,.docx"
                              onChange={(e) => setManualFile(e.target.files?.[0] ?? null)}
                              className="hidden"
                            />
                          </label>
                          {manualFile && (
                            <button
                              type="button"
                              onClick={() => {
                                setManualFile(null);
                                if (manualFileInputRef.current)
                                  manualFileInputRef.current.value = '';
                              }}
                              className="text-slate-400 hover:text-red-500 transition-colors"
                              aria-label="Remove file"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">File is not stored in this preview.</p>
                      </div>

                      <Button
                        onClick={handleManualVerification}
                        disabled={manualSubmitting || !manualSubject.trim() || !manualFile}
                        className="w-full bg-slate-900 hover:bg-slate-800"
                      >
                        {manualSubmitting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Submitting&hellip;
                          </>
                        ) : (
                          <>
                            <Shield className="w-4 h-4" />
                            Submit Manual Verification
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Verification receipts */}
                    {manualVerifications.length > 0 && (
                      <div className="rounded-md border border-slate-200 overflow-x-auto">
                        <table className="w-full text-sm min-w-[520px]">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                              <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                Subject
                              </th>
                              <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                Attestor
                              </th>
                              <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                Status
                              </th>
                              <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                Timestamp
                              </th>
                              <th className="text-left px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                Receipt
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {manualVerifications.map((v) => (
                              <tr
                                key={v.id}
                                className={v.status === 'FAILED' ? 'bg-red-50/30' : 'bg-white'}
                              >
                                <td className="px-4 py-2.5 font-medium text-slate-700">
                                  {v.subject}
                                </td>
                                <td className="px-4 py-2.5 text-slate-600">{v.attestor}</td>
                                <td className="px-4 py-2.5">
                                  <Badge
                                    className={`text-[11px] border ${
                                      v.status === 'PENDING'
                                        ? 'bg-gray-50 text-gray-600 border-gray-200'
                                        : v.status === 'COMPLETE'
                                        ? 'bg-green-50 text-green-800 border-green-200'
                                        : 'bg-red-50 text-red-800 border-red-200'
                                    } hover:bg-transparent`}
                                  >
                                    <span className={`inline-block h-2 w-2 rounded-full mr-1.5 ${
                                      v.status === 'PENDING'
                                        ? 'bg-gray-400'
                                        : v.status === 'COMPLETE'
                                        ? 'bg-green-600'
                                        : 'bg-red-600'
                                    }`} />
                                    {v.status === 'PENDING'
                                      ? 'PENDING'
                                      : v.status === 'COMPLETE'
                                      ? 'PASS'
                                      : 'FAIL'}
                                  </Badge>
                                  {v.status === 'FAILED' && v.reason && (
                                    <p className="text-xs text-red-600 mt-1">{v.reason}</p>
                                  )}
                                </td>
                                <td className="px-4 py-2.5 text-xs text-slate-400 font-mono">
                                  {new Date(v.timestamp).toLocaleTimeString()}
                                </td>
                                <td className="px-4 py-2.5">
                                  {v.status === 'COMPLETE' ? (
                                    <span className="text-xs text-slate-700 flex items-center gap-1">
                                      <span className="inline-block h-2 w-2 rounded-full bg-slate-500" />
                                      Recorded
                                    </span>
                                  ) : (
                                    <span className="text-xs text-slate-400">&mdash;</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* ---- Trust-State Summary ---- */}
                  <div className="space-y-3">
                    <Label className="text-xs text-slate-500 uppercase tracking-wider">
                      Trust-State Summary
                    </Label>

                    {trustState === 'success' && trustResult ? (
                      <div className="space-y-4">
                        {!readiness ? (
                          <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                            Demo data not available
                          </p>
                        ) : (
                          <>
                            {/* CRS + Band */}
                            <div
                              className={`rounded-md border-l-4 ${
                                bandColors(band).stripe
                              } border ${bandColors(band).border} ${bandColors(band).bg} p-4`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-baseline gap-2">
                                  <span className="text-2xl font-mono font-bold text-slate-900">
                                    {score}
                                  </span>
                                  <span className="text-sm text-slate-400">/ 100 CRS</span>
                                </div>
                                <Badge
                                  className={`${bandColors(band).bg} ${
                                    bandColors(band).text
                                  } ${bandColors(band).border} border text-xs`}
                                >
                                  <span
                                    className={`w-2 h-2 rounded-full ${
                                      bandColors(band).dot
                                    } inline-block mr-1.5`}
                                  />
                                  {bandColors(band).label}
                                </Badge>
                              </div>

                              {band !== 'GREEN' && (
                                <p className="text-xs mt-2 text-slate-600">
                                  CRS is below the threshold required for acceptance.{' '}
                                  {LABELS.ADDITIONAL_CHECKS}.
                                </p>
                              )}
                            </div>
                          </>
                        )}

                        {/* Blocking reasons — listed plainly */}
                        {trustResult.blocking_reasons.length > 0 && (
                          <div className="space-y-2">
                            <Label className="text-xs text-slate-500 uppercase tracking-wider">
                              {LABELS.ADDITIONAL_CHECKS}
                            </Label>
                            <ul className="space-y-2">
                              {(trustResult.blocking_reason_messages &&
                              trustResult.blocking_reason_messages.length > 0
                                ? trustResult.blocking_reason_messages
                                : trustResult.blocking_reasons.map(
                                    (reason) =>
                                      BLOCKING_EXPLANATIONS[reason] || reason.replace(/_/g, ' '),
                                  )
                              ).map((message) => (
                                <li
                                  key={message}
                                  className="flex items-start gap-2 rounded-md bg-red-50 border border-red-100 p-3"
                                >
                                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                                  <span className="text-sm text-red-800">{message}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Pending verification notice */}
                        {!trustResult.start_ready && (
                          <div className="rounded-md bg-amber-50 border border-amber-200 p-3 flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <p className="text-sm font-medium text-amber-800">{LABELS.PENDING}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-4 text-center">
                        <p className="text-sm text-slate-400">
                          Trust status has not been checked yet. Complete the steps above first.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* ---- Action Gating: Accept Button ---- */}
                  <div className="pt-2 border-t border-slate-200">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="w-full inline-block" tabIndex={0}>
                            <Button
                              disabled={!acceptanceEnabled}
                              className={`w-full bg-slate-900 hover:bg-slate-800 ${
                                !acceptanceEnabled
                                  ? 'opacity-50 cursor-not-allowed'
                                  : ''
                              }`}
                            >
                              <Lock className="w-4 h-4 mr-2" />
                              Accept Recognition
                            </Button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs text-center">
                          <p>
                            {failedOrPendingReceipts.length > 0
                              ? `Employer action required — ${failedOrPendingReceipts.map((r) => `${r.subject}: ${r.outcome}`).join(', ')}`
                              : 'Employer action required'}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <p className="text-xs text-slate-400 text-center mt-2">
                      Employer action required
                    </p>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* ====================================================== */}
            {/*  VERIFICATION RECEIPTS PANEL                           */}
            {/* ====================================================== */}
            {receiptRows.length > 0 && (
              <VerificationReceipts
                receipts={receiptRows}
                crsUpdated={crsUpdatedBanner}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
