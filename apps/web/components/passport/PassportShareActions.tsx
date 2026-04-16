'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';

type PassportShareActionsProps = {
  npi: string;
  name?: string;
  credentialCount?: number;
  downloadUrl?: string;
};

function escapeHtmlAttribute(value: string): string {
  return value.replaceAll('"', '&quot;');
}

function buildShareUrl(npi: string): string {
  if (typeof window === 'undefined') {
    return `https://app.vitalcv.com/p/${npi}`;
  }

  return `${window.location.origin}/p/${encodeURIComponent(npi)}`;
}

function buildEmbedCode(npi: string, name: string): string {
  const safeName = escapeHtmlAttribute(name);

  if (typeof window === 'undefined') {
    return `<img src="https://app.vitalcv.com/api/passport/${npi}/embed.svg" alt="${safeName} VitalCV passport badge" width="320" height="80" />`;
  }

  const embedUrl = `${window.location.origin}/api/passport/${encodeURIComponent(npi)}/embed.svg`;
  return `<img src="${embedUrl}" alt="${safeName} VitalCV passport badge" width="320" height="80" />`;
}

function buildLinkedInMarkdown(name: string, shareUrl: string): string {
  return `[${name} clinician passport](${shareUrl})`;
}

export default function PassportShareActions({
  npi,
  name,
}: PassportShareActionsProps) {
  const clinicianName = name?.trim() || `Clinician ${npi}`;

  async function copyText(value: string, label: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(label);
    } catch {
      toast.error('Clipboard unavailable');
    }
  }

  const shareUrl = buildShareUrl(npi);
  const embedCode = buildEmbedCode(npi, clinicianName);
  const linkedInMarkdown = buildLinkedInMarkdown(clinicianName, shareUrl);

  return (
    <Card className="gap-5 rounded-3xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-5">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-300/80">
            Share Passport
          </p>
          <p className="mt-2 text-sm text-slate-300">
            Copy the public link, embed badge, or a LinkedIn-ready markdown snippet.
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => copyText(shareUrl, 'Copied link')}
          className="h-auto rounded-2xl border-border bg-slate-950/40 px-4 py-4 text-left text-inherit hover:border-emerald-400/40 hover:bg-slate-950/70"
        >
          <span className="block text-sm font-semibold text-foreground">Copy Link</span>
          <span className="mt-1 block text-xs text-slate-400">Public URL for direct sharing.</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => copyText(embedCode, 'Copied embed code')}
          className="h-auto rounded-2xl border-border bg-slate-950/40 px-4 py-4 text-left text-inherit hover:border-emerald-400/40 hover:bg-slate-950/70"
        >
          <span className="block text-sm font-semibold text-foreground">Copy Embed Code</span>
          <span className="mt-1 block text-xs text-slate-400">HTML snippet for the SVG badge.</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => copyText(linkedInMarkdown, 'Copied LinkedIn markdown')}
          className="h-auto rounded-2xl border-border bg-slate-950/40 px-4 py-4 text-left text-inherit hover:border-emerald-400/40 hover:bg-slate-950/70"
        >
          <span className="block text-sm font-semibold text-foreground">Copy LinkedIn Markdown</span>
          <span className="mt-1 block text-xs text-slate-400">Short markdown snippet naming the clinician.</span>
        </Button>
      </div>
    </Card>
  );
}
