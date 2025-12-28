'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';

type MatchCandidate = {
  id: string;
  label: string;
  issuerDid: string;
};

type MatchResult = MatchCandidate & {
  pslCredential?: boolean;
  trustTier?: number | null;
};

const demoCandidates: MatchCandidate[] = [
  { id: 'cand-001', label: 'Candidate A', issuerDid: 'did:web:issuer.psl.vitalcv' },
  { id: 'cand-002', label: 'Candidate B', issuerDid: 'did:web:issuer.stateboard.vitalcv' },
  { id: 'cand-003', label: 'Candidate C', issuerDid: 'did:web:issuer.unknown.vitalcv' },
];

export default function MatchaPage() {
  const [pslOnly, setPslOnly] = useState(false);
  const [tier1Only, setTier1Only] = useState(false);
  const [results, setResults] = useState<MatchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const payload = useMemo(
    () => ({
      candidates: demoCandidates,
      filters: { pslOnly, tier1Only },
    }),
    [pslOnly, tier1Only],
  );

  const applyLocalFilters = (candidates: MatchCandidate[]) =>
    candidates.filter((candidate) => {
      const isPsl =
        candidate.issuerDid === 'did:web:issuer.psl.vitalcv' ||
        candidate.issuerDid === 'did:web:issuer.stateboard.vitalcv';
      const tier = candidate.issuerDid === 'did:web:issuer.psl.vitalcv' ? 1 : isPsl ? 2 : null;
      if (pslOnly && !isPsl) return false;
      if (tier1Only && tier !== 1) return false;
      return true;
    });

  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch('/api/matcha/filter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || 'MATCHA filter failed');
        }
        if (!active) return;
        setResults(data.results || []);
      } catch (err) {
        if (!active) return;
        const fallback = applyLocalFilters(demoCandidates).map((candidate) => {
          const pslCredential =
            candidate.issuerDid === 'did:web:issuer.psl.vitalcv' ||
            candidate.issuerDid === 'did:web:issuer.stateboard.vitalcv';
          const trustTier =
            candidate.issuerDid === 'did:web:issuer.psl.vitalcv'
              ? 1
              : candidate.issuerDid === 'did:web:issuer.stateboard.vitalcv'
                ? 2
                : null;
          return { ...candidate, pslCredential, trustTier };
        });
        setError(
          err instanceof Error
            ? `${err.message}. Showing local fallback results.`
            : 'Failed to load match results. Showing local fallback results.',
        );
        setResults(fallback);
      } finally {
        if (active) setLoading(false);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [payload]);

  return (
    <main className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">MATCHA Filters</h1>
        <p className="text-muted-foreground mt-2">
          Recruiter-side PSL filters that constrain match results to trusted issuers.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filter Controls</CardTitle>
            <CardDescription>Apply PSL trust constraints to candidate matches</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">PSL credentials only</div>
                <div className="text-sm text-muted-foreground">
                  Return candidates whose issuer appears on the PSL.
                </div>
              </div>
              <Switch checked={pslOnly} onCheckedChange={setPslOnly} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Tier 1 issuers only</div>
                <div className="text-sm text-muted-foreground">
                  Limit results to highest-trust PSL issuers.
                </div>
              </div>
              <Switch checked={tier1Only} onCheckedChange={setTier1Only} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Match Results</CardTitle>
            <CardDescription>
              {loading ? 'Filtering results…' : `Showing ${results.length} candidates`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {error ? (
              <div className="rounded border border-destructive/30 bg-destructive/10 p-3 text-sm">
                {error}
              </div>
            ) : results.length === 0 ? (
              <div className="text-sm text-muted-foreground">No candidates meet the filters.</div>
            ) : (
              results.map((candidate) => (
                <div
                  key={candidate.id}
                  className="flex items-center justify-between rounded border p-3"
                >
                  <div>
                    <div className="font-medium">{candidate.label}</div>
                    <div className="text-xs text-muted-foreground">{candidate.issuerDid}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={candidate.pslCredential ? 'default' : 'secondary'}>
                      {candidate.pslCredential ? 'PSL' : 'Non-PSL'}
                    </Badge>
                    {candidate.trustTier ? (
                      <Badge variant="outline">Tier {candidate.trustTier}</Badge>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
