'use client';

import { useEffect, useState } from 'react';

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
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(() => setToast(null), 1800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function copyText(value: string, label: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      setToast(label);
    } catch {
      setToast('Clipboard unavailable');
    }
  }

  const shareUrl = buildShareUrl(npi);
  const embedCode = buildEmbedCode(npi, clinicianName);
  const linkedInMarkdown = buildLinkedInMarkdown(clinicianName, shareUrl);

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-[0_20px_60px_rgba(8,14,26,0.28)]">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-300/80">
            Share Passport
          </p>
          <p className="mt-2 text-sm text-slate-300">
            Copy the public link, embed badge, or a LinkedIn-ready markdown snippet.
          </p>
        </div>
        {toast && (
          <p className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
            {toast}
          </p>
        )}
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <button
          type="button"
          onClick={() => copyText(shareUrl, 'Copied link')}
          className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-4 text-left transition hover:border-emerald-400/40 hover:bg-slate-950/70"
        >
          <span className="block text-sm font-semibold text-white">Copy Link</span>
          <span className="mt-1 block text-xs text-slate-400">Public URL for direct sharing.</span>
        </button>

        <button
          type="button"
          onClick={() => copyText(embedCode, 'Copied embed code')}
          className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-4 text-left transition hover:border-emerald-400/40 hover:bg-slate-950/70"
        >
          <span className="block text-sm font-semibold text-white">Copy Embed Code</span>
          <span className="mt-1 block text-xs text-slate-400">HTML snippet for the SVG badge.</span>
        </button>

        <button
          type="button"
          onClick={() => copyText(linkedInMarkdown, 'Copied LinkedIn markdown')}
          className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-4 text-left transition hover:border-emerald-400/40 hover:bg-slate-950/70"
        >
          <span className="block text-sm font-semibold text-white">Copy LinkedIn Markdown</span>
          <span className="mt-1 block text-xs text-slate-400">Short markdown snippet naming the clinician.</span>
        </button>
      </div>
    </div>
  );
}
