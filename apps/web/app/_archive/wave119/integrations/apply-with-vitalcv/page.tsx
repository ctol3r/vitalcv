'use client';

import { useMemo, useState } from 'react';

export default function ApplyWithVitalCVPlayground() {
  const [org, setOrg] = useState('demo-pilot-org-alpha');
  const [jobId, setJobId] = useState('job:demo:001');
  const [returnUrl, setReturnUrl] = useState('https://example.com/thanks');

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://vitalcv.com';

  const src = useMemo(() => {
    const u = new URL('/widget/apply', origin);
    u.searchParams.set('org', org);
    u.searchParams.set('job_id', jobId);
    u.searchParams.set('return_url', returnUrl);
    return u.toString();
  }, [origin, org, jobId, returnUrl]);

  const snippet = useMemo(() => {
    const esc = (s: string) => s.replace(/"/g, '&quot;');
    return `<iframe
  src="${esc(src)}"
  style="width:100%;max-width:420px;height:280px;border:0;border-radius:24px;overflow:hidden"
  loading="lazy"
  title="Apply with VitalCV"
></iframe>`;
  }, [src]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet);
      alert('Embed snippet copied ✅');
    } catch {
      alert('Copy failed — select and copy manually.');
    }
  }

  return (
    <main className="bg-background text-foreground px-6 py-16">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-4xl font-semibold">Apply with VitalCV</h1>
        <p className="mt-3 text-muted-foreground text-lg">
          A lightweight embed employers can place on job pages to route candidates into VitalCV with intent preserved.
        </p>

        <div className="mt-10 grid lg:grid-cols-2 gap-8">
          <div className="p-8 border rounded-3xl">
            <div className="text-xl font-semibold">Configure</div>

            <label className="block mt-5 text-sm text-muted-foreground">Org</label>
            <input
              className="mt-2 w-full px-4 py-3 border rounded-2xl bg-background"
              value={org}
              onChange={(e) => setOrg(e.target.value)}
            />

            <label className="block mt-5 text-sm text-muted-foreground">Job ID</label>
            <input
              className="mt-2 w-full px-4 py-3 border rounded-2xl bg-background"
              value={jobId}
              onChange={(e) => setJobId(e.target.value)}
            />

            <label className="block mt-5 text-sm text-muted-foreground">Return URL</label>
            <input
              className="mt-2 w-full px-4 py-3 border rounded-2xl bg-background"
              value={returnUrl}
              onChange={(e) => setReturnUrl(e.target.value)}
            />

            <div className="mt-6 flex gap-3">
              <button
                onClick={copy}
                className="px-5 py-3 rounded-2xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition"
              >
                Copy Embed Snippet
              </button>
            </div>

            <pre className="mt-6 p-4 rounded-2xl bg-muted overflow-auto text-xs">
{snippet}
            </pre>
          </div>

          <div className="p-8 border rounded-3xl">
            <div className="text-xl font-semibold">Preview</div>
            <div className="mt-5">
              <iframe
                src={src}
                style={{ width: '100%', maxWidth: 420, height: 280, border: 0, borderRadius: 24, overflow: 'hidden' }}
                title="Apply with VitalCV Preview"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
