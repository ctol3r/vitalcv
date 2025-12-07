'use client';

import { useCallback, useEffect, useState } from 'react';
import { Globe, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function GlobalLedgerPage() {
  const [region, setRegion] = useState('US');
  const [ledger, setLedger] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLedger = useCallback(async () => {
    if (!region) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/global-regulatory-ledger/${region}`);
      if (!response.ok) {
        throw new Error(`Failed to load ledger (${response.status})`);
      }
      const data = await response.json();
      setLedger(data);
    } catch (err) {
      console.error('Failed to fetch ledger', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [region]);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Global Regulatory Ledger Fusion</h1>
          <p className="text-muted-foreground">
            Fuse regulatory ledgers from multiple countries into one continuous system-of-record
          </p>
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Input
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="Region (US, EU, UK, AU, SG, CA)"
            className="md:w-56"
          />
          <Button onClick={fetchLedger} variant="secondary">
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && <p className="text-muted-foreground">Loading regulatory ledger...</p>}

      {ledger && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Regions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {ledger.ledger?.regions?.length ?? 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Harmonized Rules
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {ledger.ledger?.harmonized?.length ?? 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <XCircle className="h-4 w-4" />
                Conflicts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {ledger.ledger?.conflicts?.length ?? 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Rules
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {ledger.rules?.length ?? 0}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {ledger && ledger.ledger?.conflicts && ledger.ledger.conflicts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Regulatory Conflicts</CardTitle>
            <CardDescription>Detected conflicts between international ledgers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {ledger.ledger.conflicts.slice(0, 10).map((conflict: any, idx: number) => (
                <Alert key={idx} variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>
                    {conflict.region1} ↔ {conflict.region2}
                  </AlertTitle>
                  <AlertDescription>{conflict.conflict}</AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {ledger && ledger.ledger?.harmonized && (
        <Card>
          <CardHeader>
            <CardTitle>Harmonized Rules</CardTitle>
            <CardDescription>Cross-border regulatory rule mappings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {ledger.ledger.harmonized.slice(0, 10).map((rule: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-2 border rounded">
                  <div>
                    <div className="font-medium">{rule.ruleId}</div>
                    <div className="text-sm text-muted-foreground">
                      Regions: {rule.regions.join(', ')}
                    </div>
                  </div>
                  <Badge>Harmonized</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

