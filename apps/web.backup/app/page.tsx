"use client";
import { useEffect, useState } from 'react';
import PublicStatsStrip from './components/PublicStatsStrip';

const pulse = 'animate-[pulse_2.5s_ease-in-out_infinite]';

export default function Landing() {
  const [meta, setMeta] = useState<any>();
  const [variant, setVariant] = useState<any>();

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/meta.json');
        setMeta(await r.json());
      } catch {
        // Fallback to default
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/landing/variant');
        setVariant(await r.json());
      } catch {
        setVariant({ enabled: false });
      }
    })();
  }, []);

  // Press variant hero
  if (variant?.enabled) {
    return (
      <main id="main" className="min-h-[80vh] flex flex-col items-center justify-center px-6 text-center">
        <div className="mb-6">
          <svg className="w-24 h-24 mx-auto" viewBox="0 0 100 100" fill="currentColor">
            <circle cx="50" cy="50" r="40" />
          </svg>
        </div>
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight">VitalCV</h1>
        <p className="mt-4 max-w-3xl text-xl opacity-80">
          Trusted Credentialing. Open Standards. Built for Healthcare.
        </p>
        <div className="mt-8 flex gap-3 flex-wrap justify-center">
          <a href="/press-kit" className="px-5 py-3 rounded-lg bg-black text-white hover:bg-gray-800 transition-colors text-lg">
            Press Kit
          </a>
          <a href="/whats-new" className="px-5 py-3 rounded-lg border hover:bg-gray-50 transition-colors text-lg">
            What's New
          </a>
        </div>
        <footer className="mt-10 text-xs opacity-60">
          © {new Date().getFullYear()} VitalCV • Media Inquiries: press@vitalcv.com
        </footer>
      </main>
    );
  }

  return (
    <main id="main" className="min-h-[80vh] flex flex-col items-center justify-center px-6 text-center">
      <h1 className="text-4xl md:text-6xl font-bold tracking-tight">VitalCV</h1>
      <p className="mt-3 max-w-2xl text-lg opacity-80">
        One Platform, Three Solutions: <b>Empower</b>. <b>Streamline</b>. <b>Trust</b>.
      </p>

      {/* Public Stats Strip - B133C-FE-004 */}
      <div className="mt-8 w-full max-w-6xl">
        <PublicStatsStrip />
      </div>

      <div className={`mt-8 w-full max-w-3xl rounded-2xl border p-5 shadow ${pulse}`}>
        <HeroLiveSnippet />
      </div>

      <div className="mt-6 flex gap-3 flex-wrap justify-center">
        <a href="/agent" className="px-4 py-2 rounded bg-black text-white hover:bg-gray-800 transition-colors">
          Try the Agent
        </a>
        <a href="/docs/regulatory" className="px-4 py-2 rounded border hover:bg-gray-50 transition-colors">
          Regulatory Knowledge →
        </a>
        <a href="/docs/portal" className="px-4 py-2 rounded border hover:bg-gray-50 transition-colors">
          API Docs
        </a>
        <a href="/public-docs" className="px-4 py-2 rounded border hover:bg-gray-50 transition-colors">
          Public Docs
        </a>
      </div>

      <footer className="mt-10 text-xs opacity-60">
        © {new Date().getFullYear()} VitalCV • {meta?.url || ''}
      </footer>
    </main>
  );
}

function HeroLiveSnippet() {
  const [state, setState] = useState('CA');
  const [out, setOut] = useState<any>();
  const [busy, setBusy] = useState(false);
  const BASE = process.env.NEXT_PUBLIC_AGENT_BASE || '';

  return (
    <div>
      <div className="text-sm text-left">
        <div className="mb-2 font-semibold">Live Code</div>
        <pre className="text-[11px] bg-gray-50 p-3 rounded overflow-x-auto">
          {`curl -s ${BASE}/solve \\
  -H 'content-type: application/json' \\
  -d '{"task":"verify license","input":{"state":"${state}","licensePdfId":"demo"}}'`}
        </pre>
      </div>

      <div className="mt-3 flex gap-2 items-center flex-wrap">
        <input
          className="p-2 border rounded w-28"
          value={state}
          onChange={(e) => setState(e.target.value)}
          placeholder="state (e.g., CA)"
        />
        <button
          className="px-3 py-2 rounded bg-black text-white disabled:opacity-50 hover:bg-gray-800 transition-colors"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await fetch(`${BASE}/solve`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                  task: 'verify license',
                  input: { state, licensePdfId: 'demo' },
                }),
              });
              const js = await r.json();
              setOut(js);
            } finally {
              setBusy(false);
            }
          }}
        >
          Run
        </button>
        <a
          className="px-3 py-2 rounded border hover:bg-gray-50 transition-colors"
          href="/ops/demo-reset"
          onClick={async (e) => {
            e.preventDefault();
            if (!confirm('Reset all demo data?')) return;
            await fetch('/ops/demo-reset', { method: 'POST' });
            alert('Demo reset complete');
          }}
        >
          Demo Reset
        </a>
      </div>

      {out && (
        <pre
          className="mt-3 text-[11px] bg-gray-50 p-3 rounded overflow-x-auto"
          aria-live="polite"
        >
          {JSON.stringify(out, null, 2)}
        </pre>
      )}
    </div>
  );
}
