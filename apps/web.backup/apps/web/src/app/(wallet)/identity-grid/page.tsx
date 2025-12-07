'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Globe, RefreshCcw, Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  'http://localhost:4000';

export default function IdentityGridPage() {
  const [grid, setGrid] = useState<any>(null);
  const [heartbeat, setHeartbeat] = useState<any>(null);
  const [aliases, setAliases] = useState<any[]>([]);
  const [fragmentation, setFragmentation] = useState<any>(null);
  const [riskOverlay, setRiskOverlay] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [clinicianId, setClinicianId] = useState('demo_clinician_123');

  useEffect(() => {
    loadIdentityGrid();
  }, []);

  async function loadIdentityGrid() {
    setLoading(true);
    try {
      const [gridRes, heartbeatRes, aliasesRes, fragmentationRes, riskRes] = await Promise.all([
        fetch(`${API_BASE}/api/identity-grid/${clinicianId}`),
        fetch(`${API_BASE}/api/identity-grid/${clinicianId}/heartbeat`),
        fetch(`${API_BASE}/api/identity-grid/${clinicianId}/aliases`),
        fetch(`${API_BASE}/api/identity-grid/${clinicianId}/fragmentation`),
        fetch(`${API_BASE}/api/identity-grid/${clinicianId}/risk`),
      ]);

      if (gridRes.ok) {
        const data = await gridRes.json();
        setGrid(data);
      }
      if (heartbeatRes.ok) {
        const data = await heartbeatRes.json();
        setHeartbeat(data);
      }
      if (aliasesRes.ok) {
        const data = await aliasesRes.json();
        setAliases(data.aliases || []);
      }
      if (fragmentationRes.ok) {
        const data = await fragmentationRes.json();
        setFragmentation(data);
      }
      if (riskRes.ok) {
        const data = await riskRes.json();
        setRiskOverlay(data);
      }
    } catch (error) {
      console.error('Failed to load identity grid:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="space-y-2">
        <Badge variant="secondary">Wallet · Identity Grid</Badge>
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <h1 className="text-3xl font-semibold leading-tight">Global Provider Identity Grid</h1>
            <p className="text-muted-foreground">
              Unified grid of clinician identities mapped across borders, regulators, and DIDs
            </p>
          </div>
          <Button
            variant="outline"
            className="ml-auto gap-2"
            onClick={() => loadIdentityGrid()}
            disabled={loading}
          >
            <RefreshCcw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </header>

      {riskOverlay && (
        <Card>
          <CardHeader>
            <CardTitle>Identity Risk Overlay</CardTitle>
            <CardDescription>Overall confidence and risk factors</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span>Overall Confidence</span>
                  <span className="font-medium">{riskOverlay.overallConfidence}%</span>
                </div>
                <Progress value={riskOverlay.overallConfidence} />
              </div>
              {riskOverlay.riskFactors?.length > 0 && (
                <div>
                  <p className="font-medium mb-2">Risk Factors:</p>
                  {riskOverlay.riskFactors.map((factor: any, idx: number) => (
                    <div key={idx} className="p-2 rounded border mb-2">
                      <p className="font-medium">{factor.factor}</p>
                      <p className="text-sm text-muted-foreground">
                        Severity: {factor.severity} · Impact: {factor.impact}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {heartbeat && (
        <Card>
          <CardHeader>
            <CardTitle>Identity Heartbeat</CardTitle>
            <CardDescription>Status across all wallets and systems</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {heartbeat.status === 'alive' ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-amber-600" />
              )}
              <span className="font-medium capitalize">{heartbeat.status}</span>
            </div>
            {heartbeat.inconsistencies?.length > 0 && (
              <div className="mt-4">
                <p className="font-medium text-amber-700">Inconsistencies:</p>
                <ul className="text-sm text-muted-foreground list-disc list-inside">
                  {heartbeat.inconsistencies.map((inc: string, idx: number) => (
                    <li key={idx}>{inc}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {fragmentation && (
        <Card>
          <CardHeader>
            <CardTitle>Fragmentation Prediction</CardTitle>
            <CardDescription>Risk of identity splits due to inconsistent data</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Badge variant={fragmentation.risk === 'high' ? 'destructive' : 'outline'}>
                {fragmentation.risk} Risk ({fragmentation.probability}%)
              </Badge>
              {fragmentation.factors?.length > 0 && (
                <ul className="text-sm text-muted-foreground list-disc list-inside">
                  {fragmentation.factors.map((factor: string, idx: number) => (
                    <li key={idx}>{factor}</li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {aliases.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Detected Aliases</CardTitle>
            <CardDescription>Potential name/DID duplicates</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {aliases.map((alias, idx) => (
              <div key={idx} className="p-2 rounded border">
                <p className="font-medium">{alias.alias}</p>
                <p className="text-sm text-muted-foreground">
                  Similarity: {alias.similarity}% · Source: {alias.source}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}








