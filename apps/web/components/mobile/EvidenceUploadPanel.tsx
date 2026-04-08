'use client';

import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, CheckCircle2, Loader2, Upload } from 'lucide-react';
import { useClinicianMobile } from '@/components/mobile/ClinicianMobileProvider';

interface CandidateCredentialRecord {
  id: string;
  status: string;
  createdAt: string;
  documentType: string | null;
}

interface CredentialsPayload {
  credentials?: unknown[];
}

interface EvidenceUploadPanelProps {
  heading?: string;
  description?: string;
  returnToHref?: string;
  returnToLabel?: string;
}

const ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/tiff',
] as const;

function normalizeCredentialRecord(raw: unknown): CandidateCredentialRecord | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const record = raw as {
    id?: unknown;
    status?: unknown;
    createdAt?: unknown;
    data?: {
      documentType?: unknown;
    } | null;
  };

  return typeof record.id === 'string'
    && typeof record.status === 'string'
    && typeof record.createdAt === 'string'
    ? {
        id: record.id,
        status: record.status,
        createdAt: record.createdAt,
        documentType: typeof record.data?.documentType === 'string'
          ? record.data.documentType
          : null,
      }
    : null;
}

function normalizeCredentials(payload: unknown): CandidateCredentialRecord[] {
  const records = (
    payload && typeof payload === 'object' && Array.isArray((payload as CredentialsPayload).credentials)
      ? ((payload as CredentialsPayload).credentials ?? [])
      : []
  );

  return records
    .map((record) => normalizeCredentialRecord(record))
    .filter((record): record is CandidateCredentialRecord => Boolean(record));
}

function credentialLabel(record: CandidateCredentialRecord): string {
  return record.documentType
    ? record.documentType.replace(/_/g, ' ').toLowerCase()
    : 'uploaded evidence';
}

function credentialStatusLabel(status: string): string {
  switch (status) {
    case 'VERIFIED':
      return 'Checked by source';
    case 'CONFIRMED':
      return 'Parsed · confirmed on file';
    case 'PENDING_VERIFICATION':
      return 'Parsed · source check pending';
    case 'UNVERIFIED':
      return 'Stored · awaiting source check';
    case 'MISSING_INFORMATION':
      return 'Parsed · missing details';
    case 'FAILED':
    case 'REJECTED':
      return 'Needs review';
    default:
      return status.replace(/_/g, ' ').toLowerCase();
  }
}

function formatWhen(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'just now';
  }

  return parsed.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function EvidenceUploadPanel({
  heading = 'Upload evidence',
  description = 'Upload a PDF or image up to 10 MB so VitalCV can attach it to your profile, show whether it is stored, parsed, source-checked, or still missing detail, and use it to unblock readiness or a live application.',
  returnToHref = '/holder/readiness',
  returnToLabel = 'Return to readiness',
}: EvidenceUploadPanelProps) {
  const { refresh } = useClinicianMobile();
  const [credentials, setCredentials] = useState<CandidateCredentialRecord[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoadingCredentials, setIsLoadingCredentials] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [uploadedAt, setUploadedAt] = useState<string | null>(null);

  async function loadCredentials() {
    setIsLoadingCredentials(true);

    try {
      const response = await fetch('/api/credentials/mine', {
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Credential list failed (${response.status}).`);
      }

      setCredentials(normalizeCredentials(await response.json()));
    } catch {
      setCredentials([]);
    } finally {
      setIsLoadingCredentials(false);
    }
  }

  useEffect(() => {
    void loadCredentials();
  }, []);

  const selectedFileLabel = useMemo(() => {
    if (!selectedFile) {
      return 'No file selected';
    }

    return `${selectedFile.name} · ${(selectedFile.size / 1024 / 1024).toFixed(1)} MB`;
  }, [selectedFile]);

  async function handleUpload() {
    if (!selectedFile) {
      setError('Select a document or image to continue.');
      return;
    }

    if (!ACCEPTED_MIME_TYPES.includes(selectedFile.type as (typeof ACCEPTED_MIME_TYPES)[number])) {
      setError('Unsupported file type. Upload a PDF, PNG, JPG, or TIFF.');
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('File is too large. Keep uploads at or below 10 MB.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);
    setUploadedAt(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const parseResponse = await fetch('/api/documents/parse', {
        method: 'POST',
        body: formData,
      });
      const parsePayload = await parseResponse.json().catch(() => ({})) as {
        error?: string;
        documentId?: string;
      };

      if (!parseResponse.ok || !parsePayload.documentId) {
        throw new Error(parsePayload.error ?? `Upload failed (${parseResponse.status}).`);
      }

      const ingestResponse = await fetch('/api/credentials/ingest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ documentId: parsePayload.documentId }),
      });
      const ingestPayload = await ingestResponse.json().catch(() => ({})) as {
        error?: string;
        credentialId?: string;
      };

      if (!ingestResponse.ok || !ingestPayload.credentialId) {
        throw new Error(ingestPayload.error ?? `Credential ingest failed (${ingestResponse.status}).`);
      }

      const confirmResponse = await fetch(`/api/credentials/${encodeURIComponent(ingestPayload.credentialId)}/confirm`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ corrections: {} }),
      });
      const confirmPayload = await confirmResponse.json().catch(() => ({})) as {
        error?: string;
      };

      if (!confirmResponse.ok) {
        throw new Error(confirmPayload.error ?? `Verification queue handoff failed (${confirmResponse.status}).`);
      }

      setSelectedFile(null);
      const completedAt = new Date().toISOString();
      setUploadedAt(completedAt);
      setSuccessMessage('Your file is attached to your profile now. VitalCV stored the document, matched it to the credential record, and will refresh your passport, readiness, or waiting applications when the source-backed check finishes.');
      await Promise.allSettled([refresh(), loadCredentials()]);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Upload failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">{heading}</p>
          <p className="mt-2 text-sm leading-6 text-white/65">{description}</p>
        </div>
        <Upload className="mt-0.5 h-5 w-5 text-white/45" />
      </div>

      <div className="mt-5 rounded-3xl border border-white/10 bg-black/20 p-4">
        <label className="block">
          <span className="text-sm font-semibold text-white">Document or image</span>
          <input
            type="file"
            accept=".pdf,image/png,image/jpeg,image/tiff"
            onChange={(event) => {
              setSelectedFile(event.target.files?.[0] ?? null);
              setError(null);
              setSuccessMessage(null);
            }}
            className="mt-3 block w-full text-sm text-white file:mr-4 file:rounded-2xl file:border-0 file:bg-white file:px-4 file:py-2.5 file:font-semibold file:text-zinc-950"
          />
        </label>
        <p className="mt-3 text-xs text-white/45">{selectedFileLabel}</p>
        <p className="mt-2 text-xs leading-5 text-white/45">
          Use this for a license, certificate, verification letter, or other credential evidence.
          The file is stored immediately, but employers should still rely on the source-check status before treating it as decision-grade.
        </p>

        <button
          type="button"
          onClick={() => void handleUpload()}
          disabled={isSubmitting}
          className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-semibold text-zinc-950 transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Uploading
            </>
          ) : (
            <>
              Upload evidence
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>

      <div className="mt-5 rounded-3xl border border-white/10 bg-black/20 p-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">What happens after upload</p>
        <div className="mt-3 space-y-3 text-sm text-white/70">
          <p>1. The file appears in your attached evidence list right away.</p>
          <p>2. VitalCV stores the attachment and parses it into the matching credential record when it can.</p>
          <p>3. Verification continues in the background if a source still needs to confirm it.</p>
          <p>4. Passport, readiness, and any waiting application detail update when that check clears.</p>
        </div>
      </div>

      <div className="mt-5 rounded-3xl border border-white/10 bg-black/20 p-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Upload states you will see</p>
        <div className="mt-3 space-y-2 text-sm text-white/70">
          <p><span className="font-semibold text-white">Stored · awaiting source check</span> means VitalCV has the file on your profile now, but a source has not confirmed it yet.</p>
          <p><span className="font-semibold text-white">Parsed · confirmed on file</span> means the attachment was matched to the related credential record.</p>
          <p><span className="font-semibold text-white">Checked by source</span> means a connected source confirmed the claim.</p>
          <p><span className="font-semibold text-white">Parsed · missing details</span> or <span className="font-semibold text-white">Needs review</span> means VitalCV still needs more detail before an employer can rely on it.</p>
        </div>
      </div>

      {error ? (
        <div className="mt-4 flex items-start gap-3 rounded-3xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      ) : null}

      {successMessage ? (
        <div className="mt-4 rounded-3xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-50">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-200" />
            <div>
              <p>{successMessage}</p>
              {uploadedAt ? (
                <p className="mt-1 text-xs text-emerald-100/75">Attached {formatWhen(uploadedAt)}</p>
              ) : null}
            </div>
          </div>
          <Link
            href={returnToHref}
            className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-white"
          >
            {returnToLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : null}

      <div className="mt-5 rounded-3xl border border-white/10 bg-black/20 p-4">
        <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Attached evidence</p>
        {isLoadingCredentials ? (
          <div className="mt-3 flex items-center gap-2 text-sm text-white/65">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading attachments
          </div>
        ) : credentials.length > 0 ? (
          <div className="mt-3 space-y-3">
            {credentials.slice(0, 4).map((credential) => (
              <div
                key={credential.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-white">{credentialLabel(credential)}</p>
                  <p className="mt-1 text-xs text-white/45">
                    Added {formatWhen(credential.createdAt)}
                  </p>
                </div>
                <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-xs font-semibold text-sky-100">
                  {credentialStatusLabel(credential.status)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm leading-6 text-white/60">
            No evidence is attached yet. When you upload something, this list will show whether it is only stored, parsed into a credential record, source-checked, or still missing detail.
          </p>
        )}
      </div>
    </section>
  );
}
