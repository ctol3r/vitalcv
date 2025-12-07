'use client';

import { useCallback, useState } from 'react';
import { Shield, AlertTriangle, CheckCircle, Globe, FileDown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function IdentityAssurancePage() {
  const [clinicianId, setClinicianId] = useState('');
  const [matrix, setMatrix] = useState<any>(null);
  const [integrity, setIntegrity] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMatrix = useCallback(async () => {
    if (!clinicianId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/identity-assurance/${clinicianId}`);
      if (!response.ok) {
        throw new Error(`Failed to load matrix (${response.status})`);
      }
      const data = await response.json();
      setMatrix(data);
    } catch (err) {
      console.error('Failed to fetch matrix', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [clinicianId]);

  const fetchIntegrity = useCallback(async () => {
    if (!clinicianId) return;
    try {
      const response = await fetch(`${API_BASE}/api/identity-assurance/integrity/${clinicianId}`);
      const data = await response.json();
      setIntegrity(data);
    } catch (err) {
      console.error('Failed to fetch integrity', err);
    }
  }, [clinicianId]);

  const exportAudit = useCallback(async () => {
    if (!clinicianId) return;
    try {
      const response = await fetch(`${API_BASE}/api/identity-assurance/audit/${clinicianId}`);
      const data = await response.json();
      window.open(data.packUrl, '_blank');
    } catch (err) {
      console.error('Failed to export audit', err);
    }
  }, [clinicianId]);

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Identity Assurance Matrix</h1>
          <p className="text-muted-foreground">
            Ensure identity is consistent across DID methods, chains, wallets & geographic contexts
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>View Identity Assurance</CardTitle>
          <CardDescription>Enter a clinician ID to view identity assurance matrix</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={clinicianId}
              onChange={(e) => setClinicianId(e.target.value)}
              placeholder="Clinician ID"
              className="flex-1"
            />
            <Button onClick={fetchMatrix} disabled={!clinicianId || loading}>
              View Matrix
            </Button>
            <Button onClick={fetchIntegrity} variant="outline" disabled={!clinicianId}>
              Check Integrity
            </Button>
            <Button onClick={exportAudit} variant="outline" disabled={!clinicianId}>
              <FileDown className="h-4 w-4 mr-2" />
              Export Audit
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading && <p className="text-muted-foreground">Loading identity assurance data...</p>}

          {integrity && integrity.integrity && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Identity Integrity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Integrity Score</span>
                  <Badge variant={integrity.integrity.score >= 0.8 ? 'default' : integrity.integrity.score >= 0.5 ? 'secondary' : 'destructive'}>
                    {(integrity.integrity.score * 100).toFixed(1)}%
                  </Badge>
                </div>
                <Progress value={integrity.integrity.score * 100} />
                <div className="flex items-center justify-between">
                  <span className="text-sm">Consistency</span>
                  <Progress value={integrity.integrity.consistency * 100} className="w-32" />
                </div>
                {integrity.integrity.mismatches && integrity.integrity.mismatches.length > 0 && (
                  <div>
                    <span className="text-sm font-medium">Mismatches:</span>
                    <ul className="list-disc list-inside text-sm text-muted-foreground">
                      {integrity.integrity.mismatches.map((m: any, i: number) => (
                        <li key={i}>{m.type} (severity: {m.severity})</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {matrix && matrix.matrix && (
            <div className="space-y-4">
              {matrix.matrix.multiChainProofs && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Multi-Chain Proofs</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2">
                      {matrix.matrix.multiChainProofs.substrate && <Badge>Substrate</Badge>}
                      {matrix.matrix.multiChainProofs.evm && <Badge>EVM</Badge>}
                      {matrix.matrix.multiChainProofs.cosmos && <Badge>Cosmos</Badge>}
                    </div>
                  </CardContent>
                </Card>
              )}

              {matrix.matrix.continuity && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Identity Continuity</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Drift</span>
                      <Badge variant={matrix.matrix.continuity.drift > 0.5 ? 'destructive' : matrix.matrix.continuity.drift > 0.3 ? 'secondary' : 'default'}>
                        {(matrix.matrix.continuity.drift * 100).toFixed(1)}%
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Risk</span>
                      <Badge variant={matrix.matrix.continuity.risk === 'high' ? 'destructive' : matrix.matrix.continuity.risk === 'medium' ? 'secondary' : 'default'}>
                        {matrix.matrix.continuity.risk}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

