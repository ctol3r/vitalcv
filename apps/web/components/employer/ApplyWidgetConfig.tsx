'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  GlassCard,
  GlassCardContent,
  GlassCardHeader,
  GlassCardTitle,
} from '@/components/ui/glass-card';
import { Input } from '@/components/ui/input';
import { Code2, Copy, ExternalLink, QrCode, ShieldCheck } from 'lucide-react';
import { useState } from 'react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ApplyWidgetConfigProps {
  employerId?: string;
}

/* ------------------------------------------------------------------ */
/*  ApplyWidgetConfig — configuration + preview + embed code           */
/* ------------------------------------------------------------------ */

export function ApplyWidgetConfig({ employerId = 'employer:alpha' }: ApplyWidgetConfigProps) {
  const [jobTitle, setJobTitle] = useState('');
  const [facilityName, setFacilityName] = useState('');
  const [variant, setVariant] = useState<'button' | 'qr'>('button');
  const [copied, setCopied] = useState(false);

  const embedCode = generateEmbedCode({
    employerId,
    jobTitle: jobTitle || 'Open Position',
    facilityName: facilityName || 'Healthcare Facility',
    variant,
  });

  const handleCopy = async () => {
    await navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Configuration */}
      <GlassCard>
        <GlassCardHeader>
          <div className="flex items-center gap-2">
            <Code2 className="h-5 w-5 text-[var(--accent)]" />
            <GlassCardTitle>Apply Widget Configuration</GlassCardTitle>
          </div>
        </GlassCardHeader>
        <GlassCardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Job Title
            </label>
            <Input
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="e.g., Internal Medicine Physician"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Facility Name
            </label>
            <Input
              value={facilityName}
              onChange={(e) => setFacilityName(e.target.value)}
              placeholder="e.g., St. Mary's Medical Center"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Widget Variant
            </label>
            <div className="flex gap-2">
              <VariantToggle
                label="Button"
                icon={<ExternalLink className="h-3.5 w-3.5" />}
                selected={variant === 'button'}
                onSelect={() => setVariant('button')}
              />
              <VariantToggle
                label="QR Code"
                icon={<QrCode className="h-3.5 w-3.5" />}
                selected={variant === 'qr'}
                onSelect={() => setVariant('qr')}
              />
            </div>
          </div>

          {/* Embed code */}
          <div className="space-y-2 pt-2 border-t border-[var(--glass-border)]">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Embed Code
              </label>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="text-xs h-7"
              >
                <Copy className="h-3 w-3 mr-1" />
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
            <pre className="rounded-xl bg-muted/30 border border-[var(--glass-border)] p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">
              {embedCode}
            </pre>
          </div>
        </GlassCardContent>
      </GlassCard>

      {/* Preview */}
      <GlassCard>
        <GlassCardHeader>
          <GlassCardTitle className="text-sm">Live Preview</GlassCardTitle>
        </GlassCardHeader>
        <GlassCardContent className="flex items-center justify-center min-h-[300px]">
          <ApplyWidgetPreview
            jobTitle={jobTitle || 'Open Position'}
            facilityName={facilityName || 'Healthcare Facility'}
            variant={variant}
          />
        </GlassCardContent>
      </GlassCard>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ApplyWidgetPreview — live preview of the embeddable widget         */
/* ------------------------------------------------------------------ */

function ApplyWidgetPreview({
  jobTitle,
  facilityName,
  variant,
}: {
  jobTitle: string;
  facilityName: string;
  variant: 'button' | 'qr';
}) {
  if (variant === 'qr') {
    return (
      <div className="flex flex-col items-center gap-3 p-6">
        {/* QR placeholder */}
        <div className="h-32 w-32 rounded-xl border-2 border-dashed border-[var(--glass-border)] flex items-center justify-center">
          <QrCode className="h-16 w-16 text-muted-foreground/30" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-medium">{jobTitle}</p>
          <p className="text-xs text-muted-foreground">{facilityName}</p>
        </div>
        <Badge variant="outline" className="text-[10px] gap-1">
          <ShieldCheck className="h-3 w-3" />
          Scan to Apply with VitalCV
        </Badge>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 p-6">
      <div className="text-center space-y-1">
        <p className="text-sm font-medium">{jobTitle}</p>
        <p className="text-xs text-muted-foreground">{facilityName}</p>
      </div>
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-xl bg-foreground text-background px-6 py-3 text-sm font-medium shadow-lg hover:opacity-90 transition-opacity"
      >
        <ShieldCheck className="h-4 w-4" />
        Apply with VitalCV
      </button>
      <p className="text-[10px] text-muted-foreground text-center max-w-[200px]">
        Share verified credentials instantly. No paperwork required.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function VariantToggle({
  label,
  icon,
  selected,
  onSelect,
}: {
  label: string;
  icon: React.ReactNode;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
        selected
          ? 'bg-primary/10 border border-primary/20 text-foreground'
          : 'bg-muted/30 border border-transparent text-muted-foreground hover:border-border/40'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function generateEmbedCode({
  employerId,
  jobTitle,
  facilityName,
  variant,
}: {
  employerId: string;
  jobTitle: string;
  facilityName: string;
  variant: 'button' | 'qr';
}): string {
  return `<!-- Apply with VitalCV Widget -->
<script
  src="https://cdn.vitalcv.com/apply-widget.js"
  data-employer-id="${employerId}"
  data-job-title="${jobTitle}"
  data-facility="${facilityName}"
  data-variant="${variant}"
  async
></script>
<div id="vitalcv-apply-widget"></div>`;
}
