'use client';

import { useCallback, useState } from 'react';
import { Link, AlertTriangle, CheckCircle, Clock, FileDown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function CredentialContinuityPage() {
  const [clinicianId, setClinicianId] = useState('');
  const [continuity, setContinuity] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchContinuity = useCallback(async () => {
    if (!clinicianId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/credential-continuity/${clinicianId}`);
      if (!response.ok) {
        throw new Error(`Failed to load continuity (${response.status})`);
      }
      const data = await response.json();
      setContinuity(data);
    } catch (err) {
      console.error('Failed to fetch continuity', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [clinicianId]);

  const buildContinuity = useCallback(async () => {
    if (!clinicianId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/credential-continuity/${clinicianId}/build`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error(`Failed to build continuity (${response.status})`);
      }
      const data = await response.json();
      setContinuity(data);
    } catch (err) {
      console.error('Failed to build continuity', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [clinicianId]);

  const anchorSnapshot = useCallback(async () => {
    if (!clinicianId) return;
    try {
      const response = await fetch(`${API_BASE}/api/credential-continuity/${clinicianId}/anchor`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to anchor snapshot');
      }
      alert('Continuity snapshot anchored successfully');
    } catch (err) {
      console.error('Failed to anchor snapshot', err);
      alert('Failed to anchor snapshot');
    }
  }, [clinicianId]);

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Credential Continuity</h1>
          <p className="text-muted-foreground">
            Ensure credentials remain active, valid, anchored & uninterrupted through entire career
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>View Credential Continuity</CardTitle>
          <CardDescription>Enter a clinician ID to view or build continuity record</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={clinicianId}
              onChange={(e) => setClinicianId(e.target.value)}
              placeholder="Clinician ID"
              className="flex-1"
            />
            <Button onClick={fetchContinuity} disabled={!clinicianId || loading}>
              View Continuity
            </Button>
            <Button onClick={buildContinuity} variant="outline" disabled={!clinicianId || loading}>
              Build Continuity
            </Button>
            <Button onClick={anchorSnapshot} variant="outline" disabled={!clinicianId}>
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

          {continuity && !loading && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Continuity Reliability Score</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <div className="text-4xl font-bold">{continuity.reliabilityScore}</div>
                    <div className="flex-1">
                      <Progress value={continuity.reliabilityScore} className="h-2" />
                    </div>
                    <Badge variant={continuity.reliabilityScore >= 80 ? 'default' : continuity.reliabilityScore >= 60 ? 'secondary' : 'destructive'}>
                      {continuity.reliabilityScore >= 80 ? 'Strong' : continuity.reliabilityScore >= 60 ? 'Moderate' : 'Weak'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {continuity.chain && (
                <Card>
                  <CardHeader>
                    <CardTitle>Continuity Chain</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Start Date</span>
                        <span className="text-sm font-medium">{new Date(continuity.chain.start).toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">End Date</span>
                        <span className="text-sm font-medium">
                          {continuity.chain.end ? new Date(continuity.chain.end).toLocaleDateString() : 'Ongoing'}
                        </span>
                      </div>
                      {continuity.chain.breaks && continuity.chain.breaks.length > 0 && (
                        <div className="mt-4">
                          <p className="text-sm font-medium mb-2">Breaks Detected:</p>
                          {continuity.chain.breaks.map((break_: any, idx: number) => (
                            <Alert key={idx} variant="destructive" className="mt-2">
                              <AlertTriangle className="h-4 w-4" />
                              <AlertTitle>Break {idx + 1}</AlertTitle>
                              <AlertDescription>
                                {break_.start} to {break_.end}: {break_.reason}
                              </AlertDescription>
                            </Alert>
                          ))}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {continuity.multiChain && (
                <Card>
                  <CardHeader>
                    <CardTitle>Multi-Chain Continuity</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm">Substrate</span>
                        <span className="text-sm font-medium">{continuity.multiChain.substrate.continuity}%</span>
                      </div>
                      <Progress value={continuity.multiChain.substrate.continuity} />
                    </div>
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm">EVM</span>
                        <span className="text-sm font-medium">{continuity.multiChain.evm.continuity}%</span>
                      </div>
                      <Progress value={continuity.multiChain.evm.continuity} />
                    </div>
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm">Cosmos</span>
                        <span className="text-sm font-medium">{continuity.multiChain.cosmos.continuity}%</span>
                      </div>
                      <Progress value={continuity.multiChain.cosmos.continuity} />
                    </div>
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium">Overall</span>
                        <span className="text-sm font-medium">{continuity.multiChain.overall}%</span>
                      </div>
                      <Progress value={continuity.multiChain.overall} />
                    </div>
                  </CardContent>
                </Card>
              )}

              {continuity.expirationPrevention && continuity.expirationPrevention.warnings && continuity.expirationPrevention.warnings.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Expiration Warnings</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {continuity.expirationPrevention.warnings.map((warning: any, idx: number) => (
                        <Alert key={idx} variant="warning">
                          <Clock className="h-4 w-4" />
                          <AlertTitle>{warning.severity.toUpperCase()}</AlertTitle>
                          <AlertDescription>{warning.message}</AlertDescription>
                        </Alert>
                      ))}
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

