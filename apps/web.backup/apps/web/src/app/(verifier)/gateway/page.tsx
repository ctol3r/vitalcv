'use client';

import { useState } from 'react';
import { Shield, CheckCircle2, AlertTriangle, RefreshCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  'http://localhost:4000';

export default function VerificationGatewayPage() {
  const [proofData, setProofData] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function verify() {
    if (!proofData) return;
    setLoading(true);
    try {
      const parsed = JSON.parse(proofData);
      const res = await fetch(`${API_BASE}/api/verification-gateway/verify/fallback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proofData: parsed }),
      });
      if (res.ok) {
        const data = await res.json();
        setResult(data);
      }
    } catch (error) {
      console.error('Failed to verify:', error);
      alert('Invalid JSON or verification failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="space-y-2">
        <Badge variant="secondary">Verifier · Gateway</Badge>
        <div>
          <h1 className="text-3xl font-semibold leading-tight">Universal Verification Gateway</h1>
          <p className="text-muted-foreground">
            One gateway for all verification: wallets, OIDC, SD-JWT, BBS+, DIDComm, EUDI
          </p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Verify Proof</CardTitle>
          <CardDescription>Supports multiple proof formats with automatic detection</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <textarea
            placeholder="Paste proof data (JSON)"
            value={proofData}
            onChange={(e) => setProofData(e.target.value)}
            className="w-full rounded-md border px-3 py-2 font-mono text-sm"
            rows={10}
          />
          <Button onClick={verify} disabled={loading || !proofData}>
            <Shield className="h-4 w-4 mr-2" />
            Verify
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Verification Result</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`p-3 rounded-md mb-4 ${result.valid ? 'bg-green-50' : 'bg-red-50'}`}>
              <div className="flex items-center gap-2">
                {result.valid ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                )}
                <span className={`font-medium ${result.valid ? 'text-green-900' : 'text-red-900'}`}>
                  {result.valid ? 'Valid Proof' : 'Invalid Proof'}
                </span>
              </div>
              <p className="text-sm mt-1">Format: {result.format}</p>
            </div>
            {result.trace && result.trace.length > 0 && (
              <div className="space-y-2">
                <p className="font-medium">Verification Trace</p>
                {result.trace.map((step: any, i: number) => (
                  <div key={i} className="text-sm p-2 bg-gray-50 rounded">
                    <p className="font-medium">{step.step}</p>
                    <p className="text-muted-foreground">{step.result}</p>
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

