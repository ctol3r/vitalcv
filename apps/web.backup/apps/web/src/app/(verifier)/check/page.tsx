'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function VerifierCheckPage() {
  const [credentialId, setCredentialId] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (!credentialId) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/verifier/check/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credentialId,
          verifierId: 'demo-verifier-id',
        }),
      });

      const data = await res.json();
      setResult(data);
    } catch (error) {
      console.error('Verification failed', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Unified Verifier Screen v3</CardTitle>
          <CardDescription>Instant trust, zero thinking required</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter credential ID or scan QR"
              value={credentialId}
              onChange={(e) => setCredentialId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
            />
            <Button onClick={handleVerify} disabled={loading}>
              {loading ? 'Verifying...' : 'Verify'}
            </Button>
          </div>

          {result && (
            <div className="mt-4 p-4 border rounded">
              <div className="font-semibold mb-2">
                Status: {result.overallValid ? '✅ Valid' : '❌ Invalid'}
              </div>
              <div className="text-sm space-y-1">
                <div>VC Proof: {result.vcProofValid ? '✅' : '❌'}</div>
                <div>Chain Anchor: {result.chainAnchorValid ? '✅' : '❌'}</div>
                <div>Not Expired: {result.notExpired ? '✅' : '❌'}</div>
                <div>Not Revoked: {result.notRevoked ? '✅' : '❌'}</div>
                <div>Confidence: {(result.confidence * 100).toFixed(0)}%</div>
              </div>
              {result.errors && result.errors.length > 0 && (
                <div className="mt-2 text-sm text-destructive">
                  Errors: {result.errors.join(', ')}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

