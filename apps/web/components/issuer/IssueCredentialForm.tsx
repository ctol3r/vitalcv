'use client';

import { Button } from '@/components/ui/button';
import {
  GlassCard,
  GlassCardContent,
  GlassCardHeader,
  GlassCardTitle,
} from '@/components/ui/glass-card';
import { Input } from '@/components/ui/input';
import { FilePlus, Loader2, Shield, ShieldCheck } from 'lucide-react';
import { useState } from 'react';

import {
  CREDENTIAL_TYPES,
  CREDENTIAL_TYPE_LABELS,
  type CredentialType,
  type IssuancePayload,
} from './issuer-types';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface IssueCredentialFormProps {
  onIssue: (payload: IssuancePayload) => void;
  loading?: boolean;
}

/* ------------------------------------------------------------------ */
/*  IssueCredentialForm — single credential issuance                   */
/* ------------------------------------------------------------------ */

export function IssueCredentialForm({ onIssue, loading }: IssueCredentialFormProps) {
  const [credentialType, setCredentialType] = useState<CredentialType>('STATE_LICENSE');
  const [subjectNpi, setSubjectNpi] = useState('');
  const [subjectName, setSubjectName] = useState('');
  const [regulatoryBody, setRegulatoryBody] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const canSubmit =
    subjectNpi.trim().length > 0 &&
    subjectName.trim().length > 0;

  const payload: IssuancePayload = {
    credentialType,
    subjectNpi: subjectNpi.trim(),
    subjectName: subjectName.trim(),
    regulatoryBody: regulatoryBody.trim() || undefined,
    licenseNumber: licenseNumber.trim() || undefined,
    issuedAt: new Date().toISOString(),
    expiresAt: expiresAt || undefined,
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    onIssue(payload);
    // Reset form
    setSubjectNpi('');
    setSubjectName('');
    setRegulatoryBody('');
    setLicenseNumber('');
    setExpiresAt('');
    setShowPreview(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Form */}
      <GlassCard>
        <GlassCardHeader>
          <div className="flex items-center gap-2">
            <FilePlus className="h-5 w-5 text-[var(--accent)]" />
            <GlassCardTitle>Issue Credential</GlassCardTitle>
          </div>
        </GlassCardHeader>
        <GlassCardContent className="space-y-4">
          {/* Credential Type */}
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Credential Type
            </label>
            <select
              value={credentialType}
              onChange={(e) => setCredentialType(e.target.value as CredentialType)}
              className="w-full rounded-xl border border-[var(--glass-border)] bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
            >
              {CREDENTIAL_TYPES.map((type) => (
                <option key={type} value={type}>
                  {CREDENTIAL_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>

          {/* Subject NPI */}
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Subject NPI
            </label>
            <Input
              value={subjectNpi}
              onChange={(e) => setSubjectNpi(e.target.value)}
              placeholder="e.g., 1234567890"
              className="font-mono"
            />
          </div>

          {/* Subject Name */}
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Subject Name
            </label>
            <Input
              value={subjectName}
              onChange={(e) => setSubjectName(e.target.value)}
              placeholder="e.g., Dr. Alice Johnson"
            />
          </div>

          {/* Regulatory Body */}
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Regulatory Body (optional)
            </label>
            <Input
              value={regulatoryBody}
              onChange={(e) => setRegulatoryBody(e.target.value)}
              placeholder="e.g., Medical Board of California"
            />
          </div>

          {/* License Number */}
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              License / Certificate Number (optional)
            </label>
            <Input
              value={licenseNumber}
              onChange={(e) => setLicenseNumber(e.target.value)}
              placeholder="e.g., A-123456"
              className="font-mono"
            />
          </div>

          {/* Expiration */}
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Expiration Date (optional)
            </label>
            <Input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t border-[var(--glass-border)]">
            <Button
              variant="outline"
              onClick={() => setShowPreview(!showPreview)}
              disabled={!canSubmit}
            >
              {showPreview ? 'Hide Preview' : 'Preview'}
            </Button>
            <Button onClick={handleSubmit} disabled={!canSubmit || loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  Issuing...
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4 mr-1.5" />
                  Issue Credential
                </>
              )}
            </Button>
          </div>
        </GlassCardContent>
      </GlassCard>

      {/* Preview */}
      {showPreview && canSubmit && (
        <IssuancePreview payload={payload} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  IssuancePreview                                                    */
/* ------------------------------------------------------------------ */

function IssuancePreview({ payload }: { payload: IssuancePayload }) {
  const typeLabel =
    CREDENTIAL_TYPE_LABELS[payload.credentialType as CredentialType] ||
    payload.credentialType;

  return (
    <GlassCard className="border-l-4 border-l-[var(--accent)]">
      <GlassCardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-[var(--accent)]" />
          <GlassCardTitle className="text-sm">Issuance Preview</GlassCardTitle>
        </div>
      </GlassCardHeader>
      <GlassCardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Review before cryptographic signing. This credential will be anchored
          to the VitalCV network upon issuance.
        </p>

        <div className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl bg-muted/20 p-4 border border-[var(--glass-border)]">
          <PreviewField label="Type" value={typeLabel} />
          <PreviewField label="Subject" value={payload.subjectName} />
          <PreviewField label="NPI" value={payload.subjectNpi} mono />
          {payload.regulatoryBody && (
            <PreviewField label="Regulatory Body" value={payload.regulatoryBody} />
          )}
          {payload.licenseNumber && (
            <PreviewField label="License #" value={payload.licenseNumber} mono />
          )}
          <PreviewField
            label="Issued At"
            value={new Date(payload.issuedAt).toLocaleDateString()}
          />
          {payload.expiresAt && (
            <PreviewField
              label="Expires"
              value={new Date(payload.expiresAt).toLocaleDateString()}
            />
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-[var(--accent)]" />
          <span>Subject verified via NPI identity anchor</span>
        </div>
      </GlassCardContent>
    </GlassCard>
  );
}

function PreviewField({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground block mb-0.5">
        {label}
      </span>
      <span className={`text-sm font-medium ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}
