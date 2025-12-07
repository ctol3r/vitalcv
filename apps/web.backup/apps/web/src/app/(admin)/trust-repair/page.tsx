'use client';

import { Wrench, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

interface ChainMismatch {
  chain: string;
  expected: any;
  actual: any;
  severity: number;
}

interface TrustRepair {
  type: string;
  description: string;
  chains: string[];
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
}

interface TrustRepairData {
  mismatches: ChainMismatch[];
  repairs: TrustRepair[];
  audit: {
    verified: boolean;
    issues: Array<{ type: string; severity: number; description: string }>;
  };
}

export default function TrustRepairPage() {
  const [data, setData] = useState<TrustRepairData | null>(null);
  const [loading, setLoading] = useState(true);
  const [repairing, setRepairing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const res = await fetch(`${API_BASE}/api/trust-repair`);
      if (res.ok) {
        const data = await res.json();
        setData({
          mismatches: data.mismatches || [],
          repairs: data.repairs || [],
          audit: data.audit || { verified: false, issues: [] },
        });
      }
    } catch (error) {
      console.error('Failed to fetch trust repair data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleRepair() {
    setRepairing(true);
    try {
      const res = await fetch(`${API_BASE}/api/trust-repair/orchestrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error('Failed to repair trust:', error);
    } finally {
      setRepairing(false);
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Trust Repair Engine</CardTitle>
            <CardDescription>No repair data available</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Wrench className="h-8 w-8" />
            Cross-Chain Trust Repair Engine
          </h1>
          <p className="text-muted-foreground mt-2">
            Repair trust inconsistencies across any blockchain or credential network
          </p>
        </div>
        <Button onClick={handleRepair} disabled={repairing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${repairing ? 'animate-spin' : ''}`} />
          Repair Trust
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Chain Mismatches</CardTitle>
            <CardDescription>Detected mismatches</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.mismatches.length}</div>
            <div className="text-sm text-muted-foreground">Across all chains</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Repairs</CardTitle>
            <CardDescription>Active repairs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.repairs.filter(r => r.status === 'completed').length}
            </div>
            <div className="text-sm text-muted-foreground">
              of {data.repairs.length} total
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Audit Status</CardTitle>
            <CardDescription>Verification status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {data.audit.verified ? (
                <CheckCircle className="h-6 w-6 text-green-500" />
              ) : (
                <AlertTriangle className="h-6 w-6 text-yellow-500" />
              )}
              <span className="font-medium">
                {data.audit.verified ? 'Verified' : 'Issues Found'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {data.mismatches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Chain Mismatches</CardTitle>
            <CardDescription>Mismatches across Substrate/EVM/Cosmos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.mismatches.map((mismatch, i) => (
                <div key={i} className="p-3 border rounded space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{mismatch.chain}</span>
                    <Badge variant={mismatch.severity > 0.7 ? 'destructive' : 'secondary'}>
                      Severity: {Math.round(mismatch.severity * 100)}%
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Expected: {JSON.stringify(mismatch.expected).slice(0, 50)}...
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Actual: {JSON.stringify(mismatch.actual).slice(0, 50)}...
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {data.repairs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Trust Repairs</CardTitle>
            <CardDescription>Repair status and progress</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.repairs.map((repair, i) => {
                const statusColors = {
                  pending: 'bg-yellow-500',
                  'in-progress': 'bg-blue-500',
                  completed: 'bg-green-500',
                  failed: 'bg-red-500',
                };
                return (
                  <div key={i} className="p-3 border rounded space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{repair.type}</span>
                      <Badge className={statusColors[repair.status]} variant="outline">
                        {repair.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{repair.description}</p>
                    <div className="flex flex-wrap gap-2">
                      {repair.chains.map((chain) => (
                        <Badge key={chain} variant="secondary" className="text-xs">
                          {chain}
                        </Badge>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {data.audit.issues.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Audit Issues</CardTitle>
            <CardDescription>Trust repair verification issues</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.audit.issues.map((issue, i) => (
                <div key={i} className="p-2 border rounded">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{issue.type}</span>
                    <Badge variant={issue.severity > 0.7 ? 'destructive' : 'secondary'}>
                      {Math.round(issue.severity * 100)}%
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{issue.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

