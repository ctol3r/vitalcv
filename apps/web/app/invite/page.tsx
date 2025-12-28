'use client'

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield } from 'lucide-react';
import Link from 'next/link';

export default function InviteAcceptPage() {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const resp = await fetch('/api/invite/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data?.error || 'Invite not accepted');
      setMessage(`Invite accepted for ${data.email}. Role: ${data.role}.`);
      setToken('');
      setTimeout(() => router.push(data.role === 'verifier' ? '/verify' : '/issuer'), 750);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to accept invite.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-emerald-50 flex items-center justify-center px-4 py-10">
      <Card className="w-full max-w-xl border-0 shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Shield className="h-6 w-6 text-emerald-600" />
            Accept your invite
          </CardTitle>
          <CardDescription>Paste the invite token you received to activate issuer/verifier access.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAccept} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-token">Invite token</Label>
              <Input
                id="invite-token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste invite token"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Activating...' : 'Accept invite'}
            </Button>
            {message && (
              <Alert>
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            )}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <p className="text-xs text-muted-foreground">
              Need an invite? Ask an admin to call <code>/api/invite/create</code> or request early access from the{' '}
              <Link href="/#early-access" className="text-emerald-700 font-medium">
                homepage
              </Link>
              .
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
