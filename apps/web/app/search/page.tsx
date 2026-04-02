'use client';

import { ArrowRight, ExternalLink, Loader2, Search, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

const EXAMPLE_QUERIES = [
  'ICU nurses near Sacramento',
  'DEA-active telehealth psychiatry',
  'Kaiser onboarding requirements',
  'Locums cardiology California',
];

interface SearchResult {
  id: string; type: string; title: string; snippet: string;
  sourceUrl?: string; metadata: Record<string, unknown>; score: number;
}
interface SearchResponse {
  query: string; total: number; results: SearchResult[]; sources: string[]; durationMs: number;
}

const TYPE_LABELS: Record<string, string> = {
  PUBLIC_PAGE:         'Site',
  EMPLOYER_PROFILE:    'Employer',
  OPPORTUNITY:         'Opportunity',
  ISSUER_PROFILE:      'Issuer',
  TRUST_STATE_SUMMARY: 'Trust State',
  FAQ_DOC:             'Help',
  CONNECTED_RECORD:    'Record',
};

const TYPE_COLORS: Record<string, string> = {
  OPPORTUNITY:      'bg-vt-success/10 text-vt-success ring-vt-success/20',
  EMPLOYER_PROFILE: 'bg-vt-info/10 text-vt-info ring-vt-info/20',
  FAQ_DOC:          'bg-vt-neutral-800/30 text-vt-neutral-200 ring-vt-neutral-700',
  default:          'bg-vt-neutral-800/30 text-vt-neutral-200 ring-vt-neutral-700',
};

export default function SearchPage() {
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const doSearch = async (q: string) => {
    if (!q.trim()) return;
    setLoading(true); setError(''); setResults(null);
    try {
      const res = await fetch('/api/search/query', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: q.trim(), limit: 10 }),
      });
      if (!res.ok) throw new Error('Search failed');
      setResults(await res.json());
    } catch {
      setError('Search unavailable. Try again shortly.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-ops-gradient text-foreground surface-operator">
      <main className="mx-auto max-w-3xl px-6 py-16">

        <div className="mb-10 text-center">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-vt-info/10 px-4 py-1.5 tag text-vt-info ring-1 ring-vt-info/20">
            <Sparkles className="h-3 w-3" /> Trust Intelligence Search
          </span>
          <h1 className="heading-xl mt-3 text-foreground">Search VitalCV</h1>
          <p className="body-lg mx-auto mt-3 max-w-md text-vt-neutral-200">
            Source-backed results across opportunities, employers, and credentialing guides.
          </p>
        </div>

        {/* Search box */}
        <form onSubmit={(e) => { e.preventDefault(); doSearch(query); }}>
          <div className="relative flex items-center overflow-hidden rounded-3xl border border-vt-info/20 bg-vt-surface-ops-base shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] focus-within:border-vt-info focus-within:ring-2 focus-within:ring-vt-info/20 focus-within:shadow-[0_0_20px_rgba(99,102,241,0.1)] transition-all p-2 pl-6">
            <Search className="h-6 w-6 shrink-0 text-vt-neutral-800" />
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search opportunities, employers, requirements..."
              className="flex-1 bg-transparent px-4 py-4 body-lg text-foreground placeholder:text-vt-neutral-800 focus:outline-none"
              aria-label="Search query" />
            <button type="submit" disabled={!query.trim() || loading}
              className="flex items-center gap-2 rounded-2xl bg-vt-info px-8 py-3.5 text-sm font-semibold text-foreground disabled:opacity-40 hover:bg-vt-info/90 hover:shadow-[0_0_15px_rgba(99,102,241,0.4)] transition-all">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><ArrowRight className="h-5 w-5" />Search</>}
            </button>
          </div>
        </form>

        {/* Example chips */}
        {!results && (
          <div className="mt-6">
            <p className="label mb-3 text-vt-neutral-800">Try:</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_QUERIES.map((q) => (
                <button key={q} onClick={() => { setQuery(q); doSearch(q); }}
                  className="rounded-full vt-glass px-4 py-2 text-sm text-vt-neutral-200 hover:bg-vt-surface-ops-raised hover:text-foreground transition">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && <p className="mt-6 body-sm text-vt-danger">{error}</p>}

        {/* Results */}
        {results && (
          <div className="mt-8 space-y-4">
            <div className="flex items-center justify-between">
              <p className="label text-vt-neutral-800">{results.total} result{results.total !== 1 ? 's' : ''} · {results.durationMs}ms</p>
              <Link href={`/ask?q=${encodeURIComponent(results.query)}`}
                className="tag text-vt-info hover:underline flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Ask AI instead
              </Link>
            </div>

            {results.results.length === 0 ? (
              <div className="rounded-2xl border border-vt-neutral-800 bg-vt-surface-ops-raised/20 p-10 text-center">
                <p className="heading-md text-vt-neutral-100">No results found</p>
                <p className="body-sm mt-2 text-vt-neutral-200">Try different terms or ask VitalCV AI.</p>
                <Link href="/ask" className="mt-4 inline-flex items-center gap-2 rounded-full bg-vt-info px-5 py-2 text-sm font-semibold text-foreground hover:bg-vt-info/90 transition">
                  Ask AI <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ) : results.results.map((r) => (
              <div key={r.id} className="rounded-2xl border border-vt-neutral-800 bg-vt-surface-ops-raised/40 p-5 hover:border-vt-neutral-700 transition-colors">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <h2 className="heading-sm text-foreground">{r.title}</h2>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 tag ring-1 ${TYPE_COLORS[r.type] ?? TYPE_COLORS.default}`}>
                    {TYPE_LABELS[r.type] ?? r.type}
                  </span>
                </div>
                <p className="body-sm text-vt-neutral-200">{r.snippet}</p>
                {r.sourceUrl && (
                  <a href={r.sourceUrl} className="mt-3 inline-flex items-center gap-1.5 tag text-vt-info hover:underline">
                    {r.sourceUrl} <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
