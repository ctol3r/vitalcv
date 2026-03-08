'use client';

import { useState } from 'react';
import { Search, ArrowRight, Sparkles } from 'lucide-react';

const EXAMPLE_QUERIES = [
  'Am I cleared for California locums cardiology?',
  'Show employers hiring L3 ICU nurses near Sacramento.',
  "What's missing before I can start at Kaiser?",
  'Which organizations accept telehealth psychiatry with DEA active?',
];

export default function SearchPage() {
  const [query, setQuery] = useState('');

  return (
    <div className="min-h-screen bg-ops-gradient text-white surface-operator">
      <main className="mx-auto max-w-3xl px-6 py-20">

        {/* Header */}
        <div className="mb-10 text-center">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-vt-info/10 px-4 py-1.5 tag text-vt-info ring-1 ring-vt-info/20">
            <Sparkles className="h-3 w-3" />
            Trust Intelligence Search
          </span>
          <h1 className="heading-xl mt-3 text-white">Search VitalCV</h1>
          <p className="body-lg mx-auto mt-3 max-w-md text-vt-neutral-200">
            Ask anything about opportunities, credential requirements, or employer profiles.
          </p>
        </div>

        {/* Search box */}
        <form
          onSubmit={(e) => e.preventDefault()}
          className="relative"
        >
          <div className="relative flex items-center overflow-hidden rounded-2xl border border-vt-neutral-800 bg-vt-surface-ops-raised/50 focus-within:border-vt-info/60 focus-within:ring-2 focus-within:ring-vt-info/20 transition">
            <Search className="ml-5 h-5 w-5 shrink-0 text-vt-neutral-800" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask anything — opportunities, requirements, credentials..."
              className="flex-1 bg-transparent px-4 py-5 text-white placeholder:text-vt-neutral-800 focus:outline-none body"
              aria-label="Search query"
            />
            <button
              type="submit"
              disabled={!query.trim()}
              className="mr-3 flex items-center gap-2 rounded-xl bg-vt-info px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40 hover:bg-vt-info/90 transition"
            >
              Search <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </form>

        {/* Example chips */}
        <div className="mt-6">
          <p className="label mb-3 text-vt-neutral-800">Try an example:</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_QUERIES.map((q) => (
              <button
                key={q}
                onClick={() => setQuery(q)}
                className="rounded-full vt-glass px-4 py-2 text-sm text-vt-neutral-200 hover:bg-vt-surface-ops-raised hover:text-white transition text-left"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Empty state / coming soon */}
        <div className="mt-16 rounded-2xl border border-vt-neutral-800 bg-vt-surface-ops-raised/30 p-10 text-center">
          <Sparkles className="mx-auto mb-3 h-8 w-8 text-vt-info/60" />
          <p className="heading-md text-vt-neutral-100">AI Search Coming Soon</p>
          <p className="body-sm mx-auto mt-2 max-w-sm text-vt-neutral-200">
            Powered by VitalCV Trust Intelligence — source-backed answers with full auditability.
            No black-box advice.
          </p>
        </div>
      </main>
    </div>
  );
}
