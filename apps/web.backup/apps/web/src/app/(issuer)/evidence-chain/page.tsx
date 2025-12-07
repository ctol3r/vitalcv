'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileText, RefreshCcw, Link2, Shield } from 'lucide-react';
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

export default function EvidenceChainPage() {
  const [credentialId, setCredentialId] = useState('');
  const [chain, setChain] = useState<any>(null);
  const [correlations, setCorrelations] = useState<any>(null);
  const [tamperResult, setTamperResult] = useState<any>(null);
  const [custody, setCustody] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function buildChain() {
    if (!credentialId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/evidence-chain/${credentialId}/build`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        setChain(data);
      }
    } catch (error) {
      console.error('Failed to build chain:', error);
    } finally {
      setLoading(false);
    }
  }

  async function checkCorrelations() {
    if (!credentialId) return;
    try {
      const res = await fetch(`${API_BASE}/api/evidence-chain/${credentialId}/correlate`);
      if (res.ok) {
        const data = await res.json();
        setCorrelations(data);
      }
    } catch (error) {
      console.error('Failed to correlate:', error);
    }
  }

  async function checkTampering() {
    if (!credentialId) return;
    try {
      const res = await fetch(`${API_BASE}/api/evidence-chain/${credentialId}/tamper`);
      if (res.ok) {
        const data = await res.json();
        setTamperResult(data);
      }
    } catch (error) {
      console.error('Failed to check tampering:', error);
    }
  }

  async function checkCustody() {
    if (!credentialId) return;
    try {
      const res = await fetch(`${API_BASE}/api/evidence-chain/${credentialId}/custody`);
      if (res.ok) {
        const data = await res.json();
        setCustody(data);
      }
    } catch (error) {
      console.error('Failed to check custody:', error);
    }
  }

  async function anchorChain() {
    if (!credentialId) return;
    try {
      const res = await fetch(`${API_BASE}/api/evidence-chain/${credentialId}/anchor`, {
        method: 'POST',
      });
      if (res.ok) {
        alert('Chain anchored successfully');
      }
    } catch (error) {
      console.error('Failed to anchor:', error);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="space-y-2">
        <Badge variant="secondary">Issuer · Evidence Chain</Badge>
        <div>
          <h1 className="text-3xl font-semibold leading-tight">Credential Chain-of-Evidence Fabric</h1>
          <p className="text-muted-foreground">
            Complete evidence graph linking every data point, document, signature & anchor
          </p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Evidence Chain Builder</CardTitle>
          <CardDescription>Build and manage evidence chains for credentials</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Credential ID"
              value={credentialId}
              onChange={(e) => setCredentialId(e.target.value)}
              className="flex-1 rounded-md border px-3 py-2"
            />
            <Button onClick={buildChain} disabled={loading || !credentialId}>
              <RefreshCcw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
              Build Chain
            </Button>
          </div>
        </CardContent>
      </Card>

      {chain && (
        <Card>
          <CardHeader>
            <CardTitle>Chain Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Integrity Score</span>
                <span className="text-sm">{chain.integrityScore?.toFixed(1)}%</span>
              </div>
              <Progress value={chain.integrityScore || 0} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Nodes</p>
                <p className="text-2xl font-bold">{chain.nodes?.length || 0}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Edges</p>
                <p className="text-2xl font-bold">{chain.edges?.length || 0}</p>
              </div>
            </div>
            {chain.gaps && chain.gaps.length > 0 && (
              <div className="flex items-start gap-2 p-3 bg-yellow-50 rounded-md">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-900">Evidence Gaps Detected</p>
                  <ul className="text-sm text-yellow-800 mt-1 list-disc list-inside">
                    {chain.gaps.map((gap: string, i: number) => (
                      <li key={i}>{gap}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={checkCorrelations}>
                <Link2 className="h-4 w-4 mr-2" />
                Correlate
              </Button>
              <Button variant="outline" onClick={checkTampering}>
                <Shield className="h-4 w-4 mr-2" />
                Check Tampering
              </Button>
              <Button variant="outline" onClick={checkCustody}>
                <FileText className="h-4 w-4 mr-2" />
                Validate Custody
              </Button>
              <Button onClick={anchorChain}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Anchor Chain
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {tamperResult && (
        <Card>
          <CardHeader>
            <CardTitle>Tamper Detection</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn(
              'p-3 rounded-md',
              tamperResult.isTampered ? 'bg-red-50' : 'bg-green-50'
            )}>
              <div className="flex items-center gap-2">
                {tamperResult.isTampered ? (
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                )}
                <span className={cn(
                  'font-medium',
                  tamperResult.isTampered ? 'text-red-900' : 'text-green-900'
                )}>
                  {tamperResult.isTampered ? 'Tampering Detected' : 'No Tampering Detected'}
                </span>
              </div>
              <p className="text-sm mt-1">
                Confidence: {tamperResult.confidence}%
              </p>
              {tamperResult.patterns && tamperResult.patterns.length > 0 && (
                <ul className="text-sm mt-2 list-disc list-inside">
                  {tamperResult.patterns.map((pattern: string, i: number) => (
                    <li key={i}>{pattern}</li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {custody && (
        <Card>
          <CardHeader>
            <CardTitle>Chain of Custody</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn(
              'p-3 rounded-md mb-4',
              custody.isValid ? 'bg-green-50' : 'bg-yellow-50'
            )}>
              <div className="flex items-center gap-2">
                {custody.isValid ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                )}
                <span className={cn(
                  'font-medium',
                  custody.isValid ? 'text-green-900' : 'text-yellow-900'
                )}>
                  {custody.isValid ? 'Valid Chain of Custody' : 'Chain of Custody Issues'}
                </span>
              </div>
            </div>
            {custody.timeline && custody.timeline.length > 0 && (
              <div className="space-y-2">
                <p className="font-medium">Timeline</p>
                {custody.timeline.map((item: any, i: number) => (
                  <div key={i} className="text-sm p-2 bg-gray-50 rounded">
                    <p className="font-medium">{item.action}</p>
                    <p className="text-muted-foreground">{item.actor} · {new Date(item.timestamp).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

