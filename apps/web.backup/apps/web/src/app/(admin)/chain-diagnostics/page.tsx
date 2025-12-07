'use client';

import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, RefreshCcw, Server } from 'lucide-react';
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

export default function ChainDiagnosticsPage() {
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [exportPack, setExportPack] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadChainDiagnostics();
  }, []);

  async function loadChainDiagnostics() {
    setLoading(true);
    try {
      const [diagnosticsRes, exportRes] = await Promise.all([
        fetch(`${API_BASE}/api/chain-diagnostics`),
        fetch(`${API_BASE}/api/chain-diagnostics/export`),
      ]);

      if (diagnosticsRes.ok) {
        const data = await diagnosticsRes.json();
        setDiagnostics(data);
      }
      if (exportRes.ok) {
        const data = await exportRes.json();
        setExportPack(data);
      }
    } catch (error) {
      console.error('Failed to load chain diagnostics:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="space-y-2">
        <Badge variant="secondary">Admin · Chain Diagnostics</Badge>
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <h1 className="text-3xl font-semibold leading-tight">Blockchain-QA & Diagnostic Mesh</h1>
            <p className="text-muted-foreground">
              Self-diagnosing blockchain layer that tests, verifies, and monitors itself autonomously
            </p>
          </div>
          <Button
            variant="outline"
            className="ml-auto gap-2"
            onClick={() => loadChainDiagnostics()}
            disabled={loading}
          >
            <RefreshCcw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </header>

      {exportPack?.summary && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Blocks Audited</CardDescription>
              <CardTitle className="text-2xl">{exportPack.summary.totalBlocksAudited}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Valid Blocks</CardDescription>
              <CardTitle className="text-2xl text-green-600">{exportPack.summary.validBlocks}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Forks Detected</CardDescription>
              <CardTitle className="text-2xl text-amber-600">
                {exportPack.summary.forksDetected}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Performance</CardDescription>
              <CardTitle className="text-2xl capitalize">{exportPack.summary.performanceStatus}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {exportPack?.summary && (
        <Card>
          <CardHeader>
            <CardTitle>Performance Status</CardTitle>
            <CardDescription>Overall chain health assessment</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 mb-4">
              {exportPack.summary.performanceStatus === 'healthy' ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              )}
              <span className="font-medium capitalize">{exportPack.summary.performanceStatus}</span>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Validators Healthy</p>
                <p className="text-2xl font-bold">
                  {exportPack.summary.validatorsHealthy}/{exportPack.summary.validatorsTotal}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Anchors Validated</p>
                <p className="text-2xl font-bold">{exportPack.summary.anchorsValidated}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Valid Anchors</p>
                <p className="text-2xl font-bold text-green-600">{exportPack.summary.validAnchors}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {diagnostics?.diagnostics?.blockAudit && (
        <Card>
          <CardHeader>
            <CardTitle>Block Consistency Audit</CardTitle>
            <CardDescription>Recent block validation results</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {diagnostics.diagnostics.blockAudit.slice(-5).map((block: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded border">
                  <div>
                    <p className="font-medium">Block #{block.blockNumber}</p>
                    <p className="text-sm text-muted-foreground">{block.hash.slice(0, 16)}...</p>
                  </div>
                  {block.valid ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}








