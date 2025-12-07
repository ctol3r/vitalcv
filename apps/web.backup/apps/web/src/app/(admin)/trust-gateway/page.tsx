'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Shield, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function TrustGatewayPage() {
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<any>(null);
  const [decision, setDecision] = useState<any>(null);
  const [orgId] = useState('demo-org-1');

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/trust-gateway/${orgId}`);
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      }
    } catch (error) {
      console.error('Failed to load trust gateway:', error);
    } finally {
      setLoading(false);
    }
  }

  async function testDecision() {
    try {
      const res = await fetch(`${API_BASE}/api/trust-gateway/${orgId}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issuerId: 'issuer_001',
          chainAnchors: [{ chain: 'substrate', finality: 12, txHash: '0x123' }],
          safetyFlags: [],
          licenseStatus: 'active',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setDecision(data);
      }
    } catch (error) {
      console.error('Failed to test decision:', error);
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">High-Assurance Trust Gateway</h1>
        <p className="text-muted-foreground mt-2">
          Enterprise-grade trust decision engine for credentialing, compliance & verification
        </p>
      </div>

      {config && (
        <Card>
          <CardHeader>
            <CardTitle>Trust Policies</CardTitle>
            <CardDescription>Current trust decision configuration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="font-medium mb-2">Issuer Trust</div>
              <div className="text-sm text-muted-foreground">
                Minimum Score: {config.policies?.issuerTrust?.minScore || 'N/A'}
              </div>
            </div>
            <div>
              <div className="font-medium mb-2">Chain Anchor Quality</div>
              <div className="text-sm text-muted-foreground">
                Minimum Finality: {config.policies?.chainAnchorQuality?.minFinality || 'N/A'}
              </div>
            </div>
            <div>
              <div className="font-medium mb-2">Safety Flags</div>
              <div className="text-sm text-muted-foreground">
                Max Sanctions: {config.policies?.safetyFlags?.maxSanctions || 'N/A'}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Test Trust Decision</CardTitle>
          <CardDescription>Evaluate a credential against trust policies</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={testDecision} className="mb-4">
            Test Decision
          </Button>
          {decision && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant={decision.decision === 'trusted' ? 'default' : 'secondary'}>
                  {decision.decision}
                </Badge>
                <span className="font-medium">Score: {decision.score}/100</span>
              </div>
              {decision.reasons && decision.reasons.length > 0 && (
                <div className="mt-4">
                  <div className="font-medium mb-2">Reasons:</div>
                  <ul className="list-disc list-inside space-y-1">
                    {decision.reasons.map((r: string, i: number) => (
                      <li key={i} className="text-sm text-muted-foreground">{r}</li>
                    ))}
                  </ul>
                </div>
              )}
              {decision.path && decision.path.length > 0 && (
                <div className="mt-4">
                  <div className="font-medium mb-2">Trust Path:</div>
                  <div className="space-y-1">
                    {decision.path.map((p: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        {p.result === 'pass' ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                        <span>{p.step}: {p.result} (score: {p.score})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

