'use client';

/**
 * OpportunityEmbedPanel — self-serve "Apply with VitalCV" embed for one opening.
 *
 * Gives the employer a copyable link and an HTML anchor + hosted-badge snippet
 * for their own careers page. Deliberately NOT an iframe: the app ships
 * frame-ancestors 'none' / X-Frame-Options DENY as a security posture, and a
 * plain anchor works on any site with zero clickjacking surface. The badge is
 * served from /api/embed/apply-badge.svg on this origin.
 */

import { useCallback, useMemo, useState } from 'react';
import { Check, Code2, Copy, Link2 } from 'lucide-react';

export function OpportunityEmbedPanel({ opportunityId, title }: { opportunityId: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://vitalcv.com';
  const applyUrl = `${origin}/opportunities/${opportunityId}?src=embed`;
  const badgeUrl = `${origin}/api/embed/apply-badge.svg`;

  const snippet = useMemo(
    () =>
      [
        `<!-- Apply with VitalCV — ${title.replace(/--/g, '—')} -->`,
        `<a href="${applyUrl}" rel="noopener">`,
        `  <img src="${badgeUrl}" alt="Apply with VitalCV" height="44" />`,
        `</a>`,
      ].join('\n'),
    [applyUrl, badgeUrl, title],
  );

  const copy = useCallback(async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      setCopiedKey(null);
    }
  }, []);

  if (!open) {
    return (
      <button type="button" className="mz-btn-ghost mz-btn-sm" onClick={() => setOpen(true)}>
        <Code2 className="mr-1 inline h-3.5 w-3.5" aria-hidden />
        Embed apply
      </button>
    );
  }

  return (
    <div className="mt-3 w-full rounded-[8px] border p-3" style={{ borderColor: 'var(--edge, rgba(0,0,0,0.12))' }} data-testid="opportunity-embed-panel">
      <div className="flex items-center justify-between gap-2">
        <p className="mz-small font-medium">Put this opening on your own careers page</p>
        <button type="button" className="mz-btn-ghost mz-btn-sm" onClick={() => setOpen(false)}>
          Hide
        </button>
      </div>

      <p className="mz-small mt-2 opacity-80">
        Candidates land on a public VitalCV page for this role and apply with
        their VitalCV profile — readiness snapshot attached, no résumé
        re-typing.
      </p>

      <div className="mt-3 space-y-3">
        <div>
          <p className="mz-small font-medium">
            <Link2 className="mr-1 inline h-3.5 w-3.5" aria-hidden /> Direct link
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <code className="mz-small block overflow-x-auto rounded border px-2 py-1.5" style={{ borderColor: 'var(--edge, rgba(0,0,0,0.12))' }}>
              {applyUrl}
            </code>
            <button type="button" className="mz-btn-ghost mz-btn-sm" onClick={() => void copy('link', applyUrl)}>
              {copiedKey === 'link' ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
              <span className="ml-1">{copiedKey === 'link' ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        <div>
          <p className="mz-small font-medium">
            <Code2 className="mr-1 inline h-3.5 w-3.5" aria-hidden /> Badge snippet (HTML)
          </p>
          <div className="mt-1">
            <pre className="mz-small overflow-x-auto rounded border px-2 py-1.5" style={{ borderColor: 'var(--edge, rgba(0,0,0,0.12))' }}>
              {snippet}
            </pre>
            <button type="button" className="mz-btn-ghost mz-btn-sm mt-1" onClick={() => void copy('snippet', snippet)}>
              {copiedKey === 'snippet' ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
              <span className="ml-1">{copiedKey === 'snippet' ? 'Copied' : 'Copy snippet'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default OpportunityEmbedPanel;
