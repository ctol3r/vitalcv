'use client';

import { useCallback, useEffect, useState } from 'react';
import { Shield, CheckCircle, XCircle, AlertTriangle, Globe } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface IdentityProofProtocol {
  multiproof: {
    faceMatch: boolean;
    idDocument: boolean;
    vc: boolean;
    combined: boolean;
  };
  didHandshake: {
    wallets: Array<{ walletId: string; did: string; verified: boolean }>;
    consistency: number;
  };
  regulatoryCompliance: {
    region: string;
    level: number;
    compliant: boolean;
  };
  trustLevel: number;
  fraudPatterns: Array<{ pattern: string; detected: boolean; confidence: number }>;
  sessionId: string;
  expirationDate: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function IdentityProofPage() {
  const [proof, setProof] = useState<IdentityProofProtocol | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProof = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/identity/proof`);
      if (!response.ok) {
        throw new Error(`Failed to load identity proof (${response.status})`);
      }
      const data = await response.json();
      setProof(data);
    } catch (err) {
      console.error('Failed to fetch identity proof', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProof();
  }, [fetchProof]);

  const getTrustLevelLabel = (level: number) => {
    const labels = ['DPoP', 'VC Proof', 'Biometric', 'DID Anchor'];
    return labels[level] || 'Unknown';
  };

  const getTrustLevelColor = (level: number) => {
    if (level >= 3) return 'text-green-600';
    if (level >= 2) return 'text-blue-600';
    if (level >= 1) return 'text-yellow-600';
    return 'text-gray-600';
  };

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Identity Proof Protocol</h1>
          <p className="text-muted-foreground">
            Next-gen identity + credential proofing for cross-border, multi-wallet usage.
          </p>
        </div>
        <Button onClick={fetchProof} disabled={loading}>
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {proof && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Trust Level</CardTitle>
              <CardDescription>Multi-level identity trust scoring</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className={`text-4xl font-bold ${getTrustLevelColor(proof.trustLevel)}`}>
                  Level {proof.trustLevel}
                </div>
                <div>
                  <Badge variant={proof.trustLevel >= 3 ? 'default' : 'secondary'}>
                    {getTrustLevelLabel(proof.trustLevel)}
                  </Badge>
                  <p className="text-sm text-muted-foreground mt-1">
                    Expires: {new Date(proof.expirationDate).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <Progress value={(proof.trustLevel / 3) * 100} />
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Multi-Proof Components</CardTitle>
                <CardDescription>Face match + ID document + VC verification</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {proof.multiproof.faceMatch ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                    <span>Face Match</span>
                  </div>
                  <Badge variant={proof.multiproof.faceMatch ? 'default' : 'destructive'}>
                    {proof.multiproof.faceMatch ? 'Verified' : 'Not Verified'}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {proof.multiproof.idDocument ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                    <span>ID Document</span>
                  </div>
                  <Badge variant={proof.multiproof.idDocument ? 'default' : 'destructive'}>
                    {proof.multiproof.idDocument ? 'Verified' : 'Not Verified'}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {proof.multiproof.vc ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                    <span>Verifiable Credential</span>
                  </div>
                  <Badge variant={proof.multiproof.vc ? 'default' : 'destructive'}>
                    {proof.multiproof.vc ? 'Verified' : 'Not Verified'}
                  </Badge>
                </div>

                <div className="pt-3 border-t">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Combined Proof</span>
                    <Badge variant={proof.multiproof.combined ? 'default' : 'destructive'}>
                      {proof.multiproof.combined ? 'Complete' : 'Incomplete'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Multi-Wallet DID Handshake</CardTitle>
                <CardDescription>DID consistency across wallets</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold">Consistency Score</span>
                  <span className="text-sm font-bold">
                    {(proof.didHandshake.consistency * 100).toFixed(0)}%
                  </span>
                </div>
                <Progress value={proof.didHandshake.consistency * 100} />

                {proof.didHandshake.wallets.length > 0 && (
                  <div className="space-y-2 mt-4">
                    {proof.didHandshake.wallets.map((wallet, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          {wallet.verified ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600" />
                          )}
                          <span>{wallet.walletId}</span>
                        </div>
                        <Badge variant={wallet.verified ? 'outline' : 'destructive'}>
                          {wallet.verified ? 'Verified' : 'Unverified'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Regulatory Compliance</CardTitle>
              <CardDescription>Region-specific compliance requirements</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  <div>
                    <p className="font-semibold">{proof.regulatoryCompliance.region}</p>
                    <p className="text-sm text-muted-foreground">
                      Level {proof.regulatoryCompliance.level} required
                    </p>
                  </div>
                </div>
                <Badge variant={proof.regulatoryCompliance.compliant ? 'default' : 'destructive'}>
                  {proof.regulatoryCompliance.compliant ? 'Compliant' : 'Non-Compliant'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {proof.fraudPatterns.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Fraud Pattern Detection</CardTitle>
                <CardDescription>Detected synthetic identity patterns</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {proof.fraudPatterns.map((pattern, idx) => (
                    <Alert key={idx} variant={pattern.detected ? 'destructive' : 'default'}>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <div className="flex items-center justify-between">
                          <span>{pattern.pattern}</span>
                          {pattern.detected && (
                            <Badge variant="destructive">
                              {(pattern.confidence * 100).toFixed(0)}% confidence
                            </Badge>
                          )}
                        </div>
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {loading && !proof && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Loading identity proof...</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

