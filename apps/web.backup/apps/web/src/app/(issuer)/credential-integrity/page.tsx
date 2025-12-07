'use client';

import { useCallback, useEffect, useState } from 'react';
import { Shield, AlertTriangle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function CredentialIntegrityPage() {
  const [credentialId, setCredentialId] = useState('');
  const [integrity, setIntegrity] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchIntegrity = useCallback(async () => {
    if (!credentialId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/credential-integrity/${credentialId}`);
      if (!response.ok) {
        throw new Error(`Failed to load integrity (${response.status})`);
      }
      const data = await response.json();
      setIntegrity(data);
    } catch (err) {
      console.error('Failed to fetch integrity', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [credentialId]);

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Credential Integrity Verification</h1>
          <p className="text-muted-foreground">
            Deep verification of documents, signatures, metadata, provenance, and tamper evidence
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Check Credential Integrity</CardTitle>
          <CardDescription>Enter a credential ID to verify integrity</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={credentialId}
              onChange={(e) => setCredentialId(e.target.value)}
              placeholder="Credential ID"
              className="flex-1"
            />
            <Button onClick={fetchIntegrity} disabled={!credentialId || loading}>
              Verify
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading && <p className="text-muted-foreground">Verifying integrity...</p>}

          {integrity && (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Integrity Score</span>
                  <Badge variant={integrity.integrity >= 0.8 ? 'default' : integrity.integrity >= 0.5 ? 'secondary' : 'destructive'}>
                    {(integrity.integrity * 100).toFixed(1)}%
                  </Badge>
                </div>
                <Progress value={integrity.integrity * 100} />
              </div>

              {integrity.details && (
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Validation Results</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Metadata</span>
                        {integrity.details.metadataValid ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Signature</span>
                        {integrity.details.signatureValid ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Provenance</span>
                        {integrity.details.provenanceValid ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Chain of Custody</span>
                        {integrity.details.chainOfCustodyValid ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {integrity.details.tamperEvidence && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Tamper Evidence</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {integrity.details.tamperEvidence.detected ? (
                          <Alert variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Tampering Detected</AlertTitle>
                            <AlertDescription>
                              {integrity.details.tamperEvidence.artifacts?.join(', ')}
                            </AlertDescription>
                          </Alert>
                        ) : (
                          <div className="flex items-center gap-2 text-green-600">
                            <CheckCircle className="h-4 w-4" />
                            <span className="text-sm">No tampering detected</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}








