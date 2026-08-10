'use client';

import { Button } from '@/components/ui/button';
import {
  GlassCard,
  GlassCardContent,
  GlassCardHeader,
  GlassCardTitle,
} from '@/components/ui/glass-card';
import { Sparkles, Search, ArrowRight } from 'lucide-react';
import { useState } from 'react';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface MatchaSearchPromptProps {
  onSearch: (query: string) => void;
  loading?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Example prompts                                                    */
/* ------------------------------------------------------------------ */

const EXAMPLES = [
  'Board-certified internist with active CA license, available within 30 days',
  'Pediatric cardiologist with teaching hospital experience',
  'Nurse practitioner credentialed for telehealth in TX and NY',
  'Emergency medicine physician with DEA registration, no board actions',
];

/* ------------------------------------------------------------------ */
/*  MatchaSearchPrompt — natural language search input                 */
/* ------------------------------------------------------------------ */

export function MatchaSearchPrompt({ onSearch, loading }: MatchaSearchPromptProps) {
  const [query, setQuery] = useState('');

  const handleSubmit = () => {
    const trimmed = query.trim();
    if (trimmed) onSearch(trimmed);
  };

  return (
    <GlassCard weight="heavy">
      <GlassCardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-[var(--accent)]" />
          <GlassCardTitle>AI matching</GlassCardTitle>
        </div>
      </GlassCardHeader>
      <GlassCardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Describe the clinician profile you need. We will search
          verified credentials and return ranked matches.
        </p>

        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Describe the clinician you're looking for..."
            rows={2}
            className="w-full rounded-xl border border-[var(--glass-border)] bg-background/50 pl-10 pr-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 placeholder:text-muted-foreground/60"
          />
        </div>

        {/* Action bar */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
            Powered by verified credentials
          </span>
          <Button
            onClick={handleSubmit}
            disabled={!query.trim() || loading}
            size="sm"
          >
            {loading ? 'Searching...' : 'Search'}
            {!loading && <ArrowRight className="h-3.5 w-3.5 ml-1" />}
          </Button>
        </div>

        {/* Example prompts */}
        <div className="space-y-2 pt-2 border-t border-[var(--glass-border)]">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
            Try an example
          </p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => {
                  setQuery(example);
                  onSearch(example);
                }}
                className="rounded-lg border border-[var(--glass-border)] bg-muted/20 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-[var(--accent)]/40 transition-colors text-left"
              >
                {example.length > 60 ? `${example.slice(0, 60)}...` : example}
              </button>
            ))}
          </div>
        </div>
      </GlassCardContent>
    </GlassCard>
  );
}
