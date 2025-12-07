'use client';

import { useEffect, useState } from 'react';
import { RefreshCcw, Shield, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  'http://localhost:4000';

interface RegulatoryLedgerData {
  identities: Array<{
    regulatorId: string;
    regulatorName: string;
    identityType: string;
    identityValue: string;
    verified: boolean;
  }>;
  trustPipeline: {
    regulatorTrust: number;
    identityConfidence: number;
    overallTrust: number;
  };
  conflicts: Array<{
    regulator1: string;
    regulator2: string;
    field: string;
    value1: any;
    value2: any;
  }>;
}

export default function RegulatoryLedgerPage() {
  const [data, setData] = useState<RegulatoryLedgerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [clinicianId] = useState('demo_clinician_123');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/regulatory-ledger/${clinicianId}`);
      if (res.ok) {
        const ledger = await res.json();
        setData(ledger);
      }
    } catch (error) {
      console.error('Failed to load regulatory ledger:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="space-y-2">
        <Badge variant="secondary">Admin · Regulatory Identity Ledger</Badge>
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <h1 className="text-3xl font-semibold leading-tight">Regulatory Identity Ledger</h1>
            <p className="text-muted-foreground">
              Regulator-first identity mapping between credentials, license boards, compacts & verifiers
            </p>
          </div>
          <Button
            variant="outline"
            className="ml-auto gap-2"
            onClick={loadData}
            disabled={loading}
          >
            <RefreshCcw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </header>

      {data && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Trust Pipeline</CardTitle>
              <CardDescription>Regulatory trust assessment</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Regulator Trust</div>
                  <div className="text-2xl font-semibold">{data.trustPipeline.regulatorTrust}%</div>
                  <Progress value={data.trustPipeline.regulatorTrust} className="mt-2" />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Identity Confidence</div>
                  <div className="text-2xl font-semibold">{data.trustPipeline.identityConfidence}%</div>
                  <Progress value={data.trustPipeline.identityConfidence} className="mt-2" />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Overall Trust</div>
                  <div className="text-2xl font-semibold">{data.trustPipeline.overallTrust}%</div>
                  <Progress value={data.trustPipeline.overallTrust} className="mt-2" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Regulatory Identities</CardTitle>
              <CardDescription>All mapped regulatory identities</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.identities.map((identity, idx) => (
                  <div key={idx} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold">{identity.regulatorName}</span>
                        <Badge variant="outline" className="capitalize">{identity.identityType}</Badge>
                        {identity.verified && (
                          <Badge variant="default">Verified</Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">{identity.identityValue}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {data.conflicts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Regulatory Conflicts</CardTitle>
                <CardDescription>Conflicting identity signals detected</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.conflicts.map((conflict, idx) => (
                    <div key={idx} className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                        <span className="font-semibold">{conflict.regulator1} vs {conflict.regulator2}</span>
                      </div>
                      <div className="text-sm space-y-1">
                        <div>Field: {conflict.field}</div>
                        <div>{conflict.regulator1}: {String(conflict.value1)}</div>
                        <div>{conflict.regulator2}: {String(conflict.value2)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {loading && !data && (
        <div className="flex items-center justify-center py-12">
          <RefreshCcw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

