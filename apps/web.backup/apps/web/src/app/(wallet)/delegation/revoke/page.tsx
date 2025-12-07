'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function RevokeDelegationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const edgeId = searchParams.get('edgeId');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [revokedBy, setRevokedBy] = useState('');

  useEffect(() => {
    // In production, get from session
    setRevokedBy('current_user_id');
  }, []);

  const handleRevoke = async () => {
    if (!edgeId) {
      setError('Edge ID is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/delegation/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          edgeId,
          revokedBy,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to revoke delegation');
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/delegation/graph');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  if (!edgeId) {
    return (
      <div className="container mx-auto max-w-2xl py-8 px-4">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            No delegation edge ID provided. Please navigate from the delegation graph.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl py-8 px-4">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Revoke Delegation</h1>
        <p className="text-muted-foreground mt-2">
          Permanently revoke a delegation of authority
        </p>
      </div>

      {error && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-900">
              <XCircle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {success && (
        <Card className="mb-6 border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-green-900">
              <CheckCircle2 className="h-5 w-5" />
              <span>Delegation revoked successfully! Redirecting...</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Confirm Revocation</CardTitle>
          <CardDescription>
            This action will immediately revoke the delegation. The delegatee will no longer
            have the delegated authority.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border p-4">
            <div className="text-sm text-muted-foreground mb-2">Delegation Edge ID</div>
            <code className="text-sm font-mono">{edgeId}</code>
          </div>

          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              This action cannot be undone. The delegation will be permanently revoked and
              all delegated actions will be invalidated.
            </AlertDescription>
          </Alert>

          <div className="flex gap-4">
            <Button
              variant="destructive"
              onClick={handleRevoke}
              disabled={loading || success}
            >
              {loading ? 'Revoking...' : 'Revoke Delegation'}
            </Button>
            <Button
              variant="outline"
              onClick={() => router.back()}
              disabled={loading}
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

