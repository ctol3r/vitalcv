'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileText,
  Link2,
  Loader2,
  Upload,
} from 'lucide-react';
import { useClinicianMobile } from '@/components/mobile/ClinicianMobileProvider';

type ProfileCompletionMode = 'resume' | 'links' | 'work-auth';

interface ProfileCompletionPanelProps {
  mode: ProfileCompletionMode;
  returnToHref?: string;
  returnToLabel?: string;
}

const RESUME_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
  'image/tiff',
] as const;

const WORK_AUTH_OPTIONS = [
  { value: 'authorized', label: 'Authorized to work in the US' },
  { value: 'visa_required', label: 'Visa or sponsorship required' },
  { value: 'other', label: 'Other or prefer not to say' },
] as const;

function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export default function ProfileCompletionPanel({
  mode,
  returnToHref = '/holder/readiness',
  returnToLabel = 'Return to readiness',
}: ProfileCompletionPanelProps) {
  const { refresh } = useClinicianMobile();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [workAuthStatus, setWorkAuthStatus] = useState<string>('authorized');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const selectedFileLabel = useMemo(() => {
    if (!selectedFile) {
      return 'No file selected';
    }

    return `${selectedFile.name} · ${(selectedFile.size / 1024 / 1024).toFixed(1)} MB`;
  }, [selectedFile]);

  async function handleResumeSubmit() {
    if (!selectedFile) {
      setError('Select a resume file to continue.');
      return;
    }

    if (!RESUME_MIME_TYPES.includes(selectedFile.type as (typeof RESUME_MIME_TYPES)[number])) {
      setError('Unsupported file type. Upload a PDF, DOCX, PNG, JPG, or TIFF.');
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('File is too large. Keep uploads at or below 10 MB.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

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
        throw new Error(parsePayload.error ?? 'Resume upload could not be parsed.');
      }

      const saveResponse = await fetch('/api/profile/resume/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName: selectedFile.name,
          fileUrl: `document:${parsePayload.documentId}`,
        }),
      });
      const savePayload = await saveResponse.json().catch(() => ({})) as {
        error?: string;
      };

      if (!saveResponse.ok) {
        throw new Error(savePayload.error ?? 'Resume upload could not be saved.');
      }

      setSelectedFile(null);
      setSuccessMessage('Your CV is stored on your profile now. Parsed details seed your passport, readiness, and future applications immediately, while licenses, board status, exclusions, and other decision-grade facts still wait on source-backed checks.');
      await refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Resume upload failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLinksSubmit() {
    const normalizedLinkedin = normalizeUrl(linkedinUrl);
    const normalizedPortfolio = normalizeUrl(portfolioUrl);

    if (!normalizedLinkedin && !normalizedPortfolio) {
      setError('Add at least one professional link to continue.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch('/api/profile/links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          linkedinUrl: normalizedLinkedin || undefined,
          portfolioUrl: normalizedPortfolio || undefined,
        }),
      });
      const payload = await response.json().catch(() => ({})) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? 'Links could not be saved.');
      }

      setSuccessMessage('Your profile links are saved. We will use them the next time readiness and employer context refresh.');
      await refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Profile links could not be saved.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleWorkAuthSubmit() {
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch('/api/profile/work-auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ workAuthStatus }),
      });
      const payload = await response.json().catch(() => ({})) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? 'Work authorization could not be saved.');
      }

      setSuccessMessage('Your work authorization is saved. Readiness will reflect this update on the next refresh.');
      await refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Work authorization could not be saved.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
            {mode === 'resume' ? 'Resume upload' : mode === 'links' ? 'Professional links' : 'Work authorization'}
          </p>
          <p className="mt-2 text-sm leading-6 text-white/65">
            {mode === 'resume'
              ? 'Upload a current CV or resume so VitalCV can seed your profile, show what was captured, and carry the same record into readiness and applications.'
              : mode === 'links'
                ? 'Add your public professional links so employers and readiness checks have the context they need.'
                : 'Confirm your work authorization so opportunities do not stall later in the application flow.'}
          </p>
        </div>
        {mode === 'resume' ? (
          <Upload className="mt-0.5 h-5 w-5 text-white/45" />
        ) : mode === 'links' ? (
          <Link2 className="mt-0.5 h-5 w-5 text-white/45" />
        ) : (
          <FileText className="mt-0.5 h-5 w-5 text-white/45" />
        )}
      </div>

      {mode === 'resume' ? (
        <div className="mt-5 space-y-4 rounded-3xl border border-white/10 bg-black/20 p-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">What happens to your CV</p>
            <div className="mt-3 space-y-2 text-sm text-white/70">
              <p>We parse profile details now: employment history, training, education, and license mentions.</p>
              <p>We store the original file plus the structured profile summary tied to your account.</p>
              <p>Licenses, board status, exclusions, and other decision-grade facts still require source-backed checks.</p>
              <p>Your passport and readiness improve immediately after upload, then future applications keep using the same parsed record.</p>
              <p>You do not have to re-enter the same CV details when you return to apply later.</p>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Upload states you will see</p>
            <div className="mt-3 space-y-2 text-sm text-white/70">
              <p><span className="font-semibold text-white">Parsed into profile</span> so your CV details can seed readiness.</p>
              <p><span className="font-semibold text-white">Stored on file</span> so the original document stays attached to your account.</p>
              <p><span className="font-semibold text-white">Checked by source</span> only when a connected source confirms the claim.</p>
              <p><span className="font-semibold text-white">Missing or needs action</span> when VitalCV still needs more evidence or a source check before an employer can rely on it.</p>
            </div>
          </div>
          <label className="block">
            <span className="text-sm font-semibold text-white">CV or resume file</span>
            <input
              type="file"
              accept=".pdf,.docx,image/png,image/jpeg,image/tiff"
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
            Accepted: PDF, DOCX, PNG, JPG, or TIFF up to 10 MB.
          </p>
          <button
            type="button"
            onClick={() => void handleResumeSubmit()}
            disabled={isSubmitting}
            className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-semibold text-zinc-950 transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading resume
              </>
            ) : (
              <>
                Upload CV
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
          <p className="text-xs leading-5 text-white/45">
            After upload, return to readiness to see what changed in your profile checks, then use the same updated record in your passport and next application.
          </p>
        </div>
      ) : null}

      {mode === 'links' ? (
        <div className="mt-5 space-y-4 rounded-3xl border border-white/10 bg-black/20 p-4">
          <div>
            <label htmlFor="profile-linkedin" className="text-sm font-semibold text-white">
              LinkedIn
            </label>
            <input
              id="profile-linkedin"
              type="url"
              value={linkedinUrl}
              onChange={(event) => {
                setLinkedinUrl(event.target.value);
                setError(null);
              }}
              placeholder="https://linkedin.com/in/yourname"
              className="mt-3 w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white placeholder:text-white/35 focus:border-white/20 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="profile-portfolio" className="text-sm font-semibold text-white">
              Portfolio or website
            </label>
            <input
              id="profile-portfolio"
              type="url"
              value={portfolioUrl}
              onChange={(event) => {
                setPortfolioUrl(event.target.value);
                setError(null);
              }}
              placeholder="https://your-site.example"
              className="mt-3 w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white placeholder:text-white/35 focus:border-white/20 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => void handleLinksSubmit()}
            disabled={isSubmitting}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-semibold text-zinc-950 transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving links
              </>
            ) : (
              <>
                Save links
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      ) : null}

      {mode === 'work-auth' ? (
        <div className="mt-5 space-y-3 rounded-3xl border border-white/10 bg-black/20 p-4">
          {WORK_AUTH_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setWorkAuthStatus(option.value);
                setError(null);
              }}
              className={`w-full rounded-2xl border px-4 py-3 text-left text-sm transition ${
                workAuthStatus === option.value
                  ? 'border-emerald-400/30 bg-emerald-400/10 text-white'
                  : 'border-white/10 bg-white/[0.04] text-white/75 hover:border-white/20 hover:text-white'
              }`}
            >
              {option.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => void handleWorkAuthSubmit()}
            disabled={isSubmitting}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-semibold text-zinc-950 transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving work authorization
              </>
            ) : (
              <>
                Save work authorization
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      ) : null}

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
            <p>{successMessage}</p>
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
    </section>
  );
}
