'use client';

import React from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  FileUp,
  Shield,
  ShieldCheck,
  Upload,
  User,
  X,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { TrustStatusBadge } from '@/components/ui/trust-status-badge';
import type { IngestStreamState } from '@/hooks/ingestStreamState';

void React;

// ── Requirement definitions ──────────────────────────────────────────────────

type RequirementId =
  | 'state_license'
  | 'dea_certificate'
  | 'cv_resume'
  | 'board_certification'
  | 'malpractice_insurance'
  | 'photo_id';

interface MissingRequirement {
  id: RequirementId;
  label: string;
  description: string;
  accept: string;
}

const MISSING_REQUIREMENTS: MissingRequirement[] = [
  {
    id: 'state_license',
    label: 'State Medical License',
    description: 'Upload a copy of your current state medical license',
    accept: '.pdf,image/png,image/jpeg',
  },
  {
    id: 'dea_certificate',
    label: 'DEA Registration Certificate',
    description: 'Your current DEA certificate for controlled substance prescribing',
    accept: '.pdf,image/png,image/jpeg',
  },
  {
    id: 'cv_resume',
    label: 'Curriculum Vitae / Resume',
    description: 'A current CV or resume documenting your training and experience',
    accept: '.pdf,.doc,.docx',
  },
  {
    id: 'board_certification',
    label: 'Board Certification',
    description: 'Certificate from your specialty board (ABMS or equivalent)',
    accept: '.pdf,image/png,image/jpeg',
  },
  {
    id: 'malpractice_insurance',
    label: 'Malpractice Insurance',
    description: 'Current certificate of liability / malpractice coverage',
    accept: '.pdf,image/png,image/jpeg',
  },
  {
    id: 'photo_id',
    label: 'Government-Issued Photo ID',
    description: 'Driver\u2019s license, passport, or state ID for identity verification',
    accept: 'image/png,image/jpeg,.pdf',
  },
];

// ── Progress calculation ─────────────────────────────────────────────────────

interface VerifiedSource {
  id: string;
  label: string;
  done: boolean;
}

function resolveVerifiedSources(state: IngestStreamState): VerifiedSource[] {
  return [
    { id: 'nppes', label: 'NPPES Identity', done: state.sources.nppes === 'done' },
    { id: 'oig', label: 'OIG / LEIE Exclusion', done: state.sources.oig === 'done' },
    { id: 'pecos', label: 'CMS PECOS Enrollment', done: state.sources.pecos === 'done' },
  ];
}

function computeReadinessPercent(
  verifiedSources: VerifiedSource[],
  uploadedIds: Set<RequirementId>,
): number {
  const totalItems = verifiedSources.length + MISSING_REQUIREMENTS.length;
  const completedItems =
    verifiedSources.filter(s => s.done).length + uploadedIds.size;
  return Math.round((completedItems / totalItems) * 100);
}

// ── Upload row component ─────────────────────────────────────────────────────

interface UploadedFile {
  name: string;
  size: number;
  uploadedAt: string;
}

function RequirementUploadRow({
  requirement,
  uploadedFile,
  onFileSelected,
  onRemove,
}: {
  requirement: MissingRequirement;
  uploadedFile: UploadedFile | null;
  onFileSelected: (file: File) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) onFileSelected(file);
    },
    [onFileSelected],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onFileSelected(file);
      // Reset so the same file can be re-selected
      e.target.value = '';
    },
    [onFileSelected],
  );

  if (uploadedFile) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04] px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {requirement.label}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {uploadedFile.name} · {(uploadedFile.size / 1024).toFixed(0)} KB
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 rounded-md p-1 text-muted-foreground/50 hover:text-foreground transition-colors"
          aria-label={`Remove ${requirement.label}`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        group flex items-center gap-3 w-full rounded-xl border border-dashed px-4 py-3
        text-left transition-colors cursor-pointer
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
        ${isDragOver
          ? 'border-foreground/30 bg-foreground/[0.04]'
          : 'border-border hover:border-foreground/20 hover:bg-foreground/[0.02]'
        }
      `}
    >
      <FileUp className="h-4 w-4 shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground/60 transition-colors" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground/80 group-hover:text-foreground transition-colors">
          {requirement.label}
        </p>
        <p className="text-xs text-muted-foreground/60">{requirement.description}</p>
      </div>
      <Upload className="h-3.5 w-3.5 shrink-0 text-muted-foreground/30 group-hover:text-muted-foreground/50 transition-colors" />
      <input
        ref={inputRef}
        type="file"
        accept={requirement.accept}
        onChange={handleFileChange}
        className="sr-only"
        aria-label={`Upload ${requirement.label}`}
      />
    </button>
  );
}

// ── Progress bar ─────────────────────────────────────────────────────────────

function PilotReadinessBar({ percent }: { percent: number }) {
  const tone =
    percent >= 80 ? 'bg-emerald-500'
    : percent >= 50 ? 'bg-amber-400'
    : 'bg-foreground/30';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Profile completeness
        </span>
        <span className="text-sm font-semibold tabular-nums text-foreground">
          {percent}% complete
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-border/40 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${tone}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

// ── Main panel ───────────────────────────────────────────────────────────────

interface WhatsNextPanelProps {
  state: IngestStreamState;
}

export function WhatsNextPanel({ state }: WhatsNextPanelProps) {
  const [uploads, setUploads] = useState<Record<RequirementId, UploadedFile | null>>(
    () => Object.fromEntries(MISSING_REQUIREMENTS.map(r => [r.id, null])) as Record<RequirementId, UploadedFile | null>,
  );

  const verifiedSources = useMemo(() => resolveVerifiedSources(state), [state]);
  const uploadedIds = useMemo(
    () => new Set(
      (Object.entries(uploads) as [RequirementId, UploadedFile | null][])
        .filter(([, file]) => file !== null)
        .map(([id]) => id),
    ),
    [uploads],
  );
  const percent = useMemo(
    () => computeReadinessPercent(verifiedSources, uploadedIds),
    [verifiedSources, uploadedIds],
  );

  function handleFileSelected(requirementId: RequirementId, file: File) {
    // Mock upload — stores file metadata in local state.
    // Replace with POST /api/documents/parse when storage backend is ready.
    setUploads(prev => ({
      ...prev,
      [requirementId]: {
        name: file.name,
        size: file.size,
        uploadedAt: new Date().toISOString(),
      },
    }));
  }

  function handleRemove(requirementId: RequirementId) {
    setUploads(prev => ({ ...prev, [requirementId]: null }));
  }

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Progress indicator */}
      <Card className="gap-0 rounded-xl border-border bg-card px-4 py-4 shadow-none">
        <PilotReadinessBar percent={percent} />
      </Card>

      {/* System Verified section */}
      <Card className="gap-0 rounded-xl border-border bg-card px-4 py-4 shadow-none">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="h-4 w-4 text-muted-foreground/50" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            System verified
          </p>
        </div>
        <p className="text-xs text-muted-foreground/60 mb-3">
          Automatically checked against federal and state data sources.
        </p>
        <div className="space-y-0">
          {verifiedSources.map(source => (
            <div
              key={source.id}
              className="flex items-center justify-between py-2 border-b border-border last:border-0"
            >
              <span className="text-sm text-muted-foreground">{source.label}</span>
              <TrustStatusBadge
                status={source.done ? 'checked' : 'pending'}
                label={source.done ? 'Checked' : 'Pending'}
                size="sm"
              />
            </div>
          ))}
        </div>
      </Card>

      {/* User Provided section — Missing Requirements */}
      <Card className="gap-0 rounded-xl border-border bg-card px-4 py-4 shadow-none">
        <div className="flex items-center gap-2 mb-3">
          <User className="h-4 w-4 text-muted-foreground/50" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Missing requirements
          </p>
          {uploadedIds.size > 0 && (
            <span className="ml-auto text-xs tabular-nums text-muted-foreground/50">
              {uploadedIds.size}/{MISSING_REQUIREMENTS.length} provided
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground/60 mb-3">
          These documents cannot be verified from public sources. Upload each to complete your profile.
        </p>
        <div className="space-y-2">
          {MISSING_REQUIREMENTS.map(req => (
            <RequirementUploadRow
              key={req.id}
              requirement={req}
              uploadedFile={uploads[req.id]}
              onFileSelected={file => handleFileSelected(req.id, file)}
              onRemove={() => handleRemove(req.id)}
            />
          ))}
        </div>
      </Card>

      {/* Completion encouragement */}
      {percent === 100 && (
        <Card className="gap-0 rounded-xl border-emerald-500/15 bg-emerald-500/[0.05] px-4 py-4 shadow-none">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-emerald-400" />
            <div>
              <p className="text-sm font-semibold text-foreground">Profile complete</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                All system checks and required documents are in place. Ready to share with employers.
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
