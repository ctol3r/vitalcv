'use client';

import { useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function ApplyWidgetContent() {
  const sp = useSearchParams();
  const router = useRouter();

  const params = useMemo(() => {
    return {
      org: sp.get('org') || 'demo',
      job_id: sp.get('job_id') || 'job:demo:001',
      role: sp.get('role') || 'Clinician',
      return_url: sp.get('return_url') || '',
      parent_origin: sp.get('parent_origin') || '',
    };
  }, [sp]);

  const continueUrl = useMemo(() => {
    const base = typeof window !== 'undefined' ? window.location.origin : 'https://vitalcv.com';
    const u = new URL('/demo', base);
    u.searchParams.set('intent', 'apply');
    u.searchParams.set('org', params.org);
    u.searchParams.set('job_id', params.job_id);
    u.searchParams.set('role', params.role);
    if (params.return_url) u.searchParams.set('return_url', params.return_url);
    return u.pathname + u.search;
  }, [params]);

  function handleContinue() {
    try {
      const inIframe = window.self !== window.top;
      if (inIframe) {
        const target = params.parent_origin || '*';
        window.parent.postMessage(
          { type: 'vitalcv:apply', payload: { ...params, url: continueUrl } },
          target
        );
      }
    } catch {
      // ignore
    }
    router.push(continueUrl);
  }

  return (
    <main className="min-h-[240px] bg-background text-foreground p-4">
      <div className="max-w-md mx-auto border rounded-3xl p-6 shadow-sm">
        <div className="text-sm text-muted-foreground">Apply with VitalCV</div>
        <h1 className="text-2xl font-semibold mt-1">Fast-track credential sharing</h1>
        <p className="mt-3 text-muted-foreground">
          Create a portable, verifier-ready artifact bundle you can reuse across employers.
        </p>

        <div className="mt-5 text-sm text-muted-foreground space-y-1">
          <div><span className="font-medium text-foreground">Org:</span> {params.org}</div>
          <div><span className="font-medium text-foreground">Job:</span> {params.job_id}</div>
        </div>

        <button
          onClick={handleContinue}
          className="mt-6 w-full px-5 py-3 rounded-2xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition"
        >
          Continue
        </button>

        <p className="mt-3 text-xs text-muted-foreground">
          Employers can validate your artifacts without restarting the verification loop.
        </p>
      </div>
    </main>
  );
}
