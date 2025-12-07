'use client';

import { useCallback, useEffect, useState } from 'react';
import { Shield, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

interface AuthenticityProof {
  id: string;
  credentialId: string;
  proofs: {
    signatures?: {
      ed25519?: boolean;
      bbsPlus?: boolean;
      sdJwt?: boolean;
    };
    lineage?: {
      issuerPath: string[];
      trustScore: number;
    };
    chainAnchors?: {
      continuity: boolean;
    };
    issuerTrust?: {
      integrityScore: number;
    };
  };
}

interface Anomalies {
  anomalies: any[];
  riskScore: number;
  severity: 'low' | 'medium' | 'high';
}

export default function AuthenticityPage() {
  const [credentialId, setCredentialId] = useState('demo-credential');
  const [proof, setProof] = useState<AuthenticityProof | null>(null);
  const [anomalies, setAnomalies] = useState<Anomalies | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProof = useCallback(async () => {
    if (!credentialId) return;
    setLoading(true);
    setError(null);
    try {
      const [proofRes, anomaliesRes] = await Promise.all([
        fetch(`${API_BASE}/api/authenticity-proof/${credentialId}`),
        fetch(`${API_BASE}/api/authenticity-proof/anomalies/${credentialId}`),
      ]);

      if (!proofRes.ok) throw new Error(`Failed to load proof (${proofRes.status})`);
      if (!anomaliesRes.ok) throw new Error(`Failed to load anomalies (${anomaliesRes.status})`);

      const proofData = await proofRes.json();
      const anomaliesData = await anomaliesRes.json();

      setProof(proofData);
      setAnomalies(anomaliesData);
    } catch (err) {
      console.error('Failed to fetch authenticity proof', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [credentialId]);

  useEffect(() => {
    fetchProof();
  }, [fetchProof]);

  const signatureValidation = proof?.proofs?.signatures
    ? {
        ed25519: proof.proofs.signatures.ed25519 || false,
        bbsPlus: proof.proofs.signatures.bbsPlus || false,
        sdJwt: proof.proofs.signatures.sdJwt || false,
      }
    : null;

  const trustScore = proof?.proofs?.lineage?.trustScore || 0;
  const integrityScore = proof?.proofs?.issuerTrust?.integrityScore || 0;

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Credential Authenticity</h1>
          <p className="text-muted-foreground">
            Deep authenticity proofing: signatures, lineage, chain anchors, issuer trust.
          </p>
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Input
            value={credentialId}
            onChange={(e) => setCredentialId(e.target.value)}
            placeholder="Credential ID"
            className="md:w-56"
          />
          <Button onClick={fetchProof} variant="secondary">
            <RefreshCw className="mr-2 h-4 w-4" />
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

      {loading && (
        <div className="text-center py-8">
          <p className="text-muted-foreground">Loading authenticity proof...</p>
        </div>
      )}

      {!loading && proof && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Trust Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(trustScore * 100).toFixed(0)}%</div>
                <Progress value={trustScore * 100} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Integrity Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(integrityScore * 100).toFixed(0)}%</div>
                <Progress value={integrityScore * 100} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Risk Level</CardTitle>
              </CardHeader>
              <CardContent>
                {anomalies && (
                  <Badge variant={anomalies.severity === 'high' ? 'destructive' : anomalies.severity === 'medium' ? 'secondary' : 'outline'}>
                    {anomalies.severity.toUpperCase()}
                  </Badge>
                )}
                {anomalies && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Risk Score: {anomalies.riskScore}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Signature Validation</CardTitle>
              <CardDescription>Multi-signature validator results</CardDescription>
            </CardHeader>
            <CardContent>
              {signatureValidation ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Ed25519</span>
                    <Badge variant={signatureValidation.ed25519 ? 'outline' : 'destructive'}>
                      {signatureValidation.ed25519 ? 'Valid' : 'Invalid'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">BBS+</span>
                    <Badge variant={signatureValidation.bbsPlus ? 'outline' : 'destructive'}>
                      {signatureValidation.bbsPlus ? 'Valid' : 'Invalid'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">SD-JWT</span>
                    <Badge variant={signatureValidation.sdJwt ? 'outline' : 'destructive'}>
                      {signatureValidation.sdJwt ? 'Valid' : 'Invalid'}
                    </Badge>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No signature data available</p>
              )}
            </CardContent>
          </Card>

          {proof.proofs.lineage && (
            <Card>
              <CardHeader>
                <CardTitle>Issuer Lineage</CardTitle>
                <CardDescription>Trust path from issuer to root</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Path:</p>
                  <div className="flex gap-2 flex-wrap">
                    {proof.proofs.lineage.issuerPath.map((issuer, idx) => (
                      <Badge key={idx} variant="outline">
                        {issuer}
                        {idx < proof.proofs.lineage!.issuerPath.length - 1 && (
                          <span className="ml-2">→</span>
                        )}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {anomalies && anomalies.anomalies.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Authenticity Anomalies</CardTitle>
                <CardDescription>Issues detected in authenticity proofs</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {anomalies.anomalies.map((anomaly, idx) => (
                    <Alert key={idx} variant={anomalies.severity === 'high' ? 'destructive' : 'default'}>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>{anomaly.type || 'Unknown Anomaly'}</AlertTitle>
                      <AlertDescription>
                        {anomaly.severity && `Severity: ${anomaly.severity}`}
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}








