'use client';

import { useCallback, useState } from 'react';
import { Book, Search, AlertTriangle, FileDown, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function RegulatoryKnowledgeOrbPage() {
  const [region, setRegion] = useState('US');
  const [orb, setOrb] = useState<any>(null);
  const [query, setQuery] = useState('');
  const [queryResult, setQueryResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrb = useCallback(async () => {
    if (!region) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/reg-orb/${region}`);
      if (!response.ok) {
        throw new Error(`Failed to load orb (${response.status})`);
      }
      const data = await response.json();
      setOrb(data);
    } catch (err) {
      console.error('Failed to fetch orb', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [region]);

  const buildOrb = useCallback(async () => {
    if (!region) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/reg-orb/${region}/build`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error(`Failed to build orb (${response.status})`);
      }
      const data = await response.json();
      setOrb(data);
    } catch (err) {
      console.error('Failed to build orb', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [region]);

  const queryRegulatory = useCallback(async () => {
    if (!region || !query) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/reg-orb/${region}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: query }),
      });
      if (!response.ok) {
        throw new Error(`Failed to query (${response.status})`);
      }
      const data = await response.json();
      setQueryResult(data);
    } catch (err) {
      console.error('Failed to query', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [region, query]);

  const anchorSnapshot = useCallback(async () => {
    if (!region) return;
    try {
      const response = await fetch(`${API_BASE}/api/reg-orb/${region}/anchor`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to anchor snapshot');
      }
      alert('Orb snapshot anchored successfully');
    } catch (err) {
      console.error('Failed to anchor snapshot', err);
      alert('Failed to anchor snapshot');
    }
  }, [region]);

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Regulatory Knowledge Orb</h1>
          <p className="text-muted-foreground">
            A living, queryable, global regulatory intelligence object for all credentialing rules
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>View Regulatory Knowledge Orb</CardTitle>
          <CardDescription>Select a region to view or build knowledge orb</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="Region (e.g., US, EU)"
              className="flex-1"
            />
            <Button onClick={fetchOrb} disabled={!region || loading}>
              View Orb
            </Button>
            <Button onClick={buildOrb} variant="outline" disabled={!region || loading}>
              Build Orb
            </Button>
            <Button onClick={anchorSnapshot} variant="outline" disabled={!region}>
              <FileDown className="h-4 w-4 mr-2" />
              Anchor
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-sm text-muted-foreground">Loading...</p>
            </div>
          )}

          {orb && !loading && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Regulatory Rules</CardTitle>
                  <CardDescription>{orb.rules?.length || 0} rules loaded</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {orb.rules?.slice(0, 10).map((rule: any, idx: number) => (
                      <div key={idx} className="p-3 border rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline">{rule.source}</Badge>
                          <span className="text-sm font-medium">{rule.id}</span>
                        </div>
                        <p className="text-sm">{rule.rule}</p>
                        {rule.dependencies && rule.dependencies.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Depends on: {rule.dependencies.join(', ')}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {orb.contradictions && orb.contradictions.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Rule Contradictions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {orb.contradictions.map((contradiction: any, idx: number) => (
                        <Alert key={idx} variant="warning">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertTitle>{contradiction.rule1} vs {contradiction.rule2}</AlertTitle>
                          <AlertDescription>
                            {contradiction.contradiction} (Severity: {contradiction.severity})
                          </AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Query Regulatory Rules</CardTitle>
              <CardDescription>Ask questions about regulatory requirements</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="e.g., What is the credentialing timeframe?"
                  className="flex-1"
                />
                <Button onClick={queryRegulatory} disabled={!query || !region || loading}>
                  <Search className="h-4 w-4 mr-2" />
                  Query
                </Button>
              </div>

              {queryResult && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertTitle>Answer</AlertTitle>
                  <AlertDescription>
                    <p className="mb-2">{queryResult.answer}</p>
                    <div className="flex gap-2 mt-2">
                      {queryResult.sources?.map((source: string, idx: number) => (
                        <Badge key={idx} variant="outline">{source}</Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Confidence: {queryResult.confidence}%
                    </p>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}

