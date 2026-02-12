'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useEffect, useState } from 'react';

export default function HolderPage() {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
  const [subjectId, setSubjectId] = useState('');

  // Generate a random ID on mount for demo purposes
  useEffect(() => {
    setSubjectId(`did:vitalcv:demo-${Math.floor(Math.random() * 100000)}`);
  }, []);

  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async (id: string) => {
    try {
      const res = await fetch(`${backendUrl}/status/${id}`);
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handlePresent = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = {
        recognition: {
          subjectId: subjectId,
          employerId: 'did:vitalcv:employer-demo',
          recognizedAt: new Date().toISOString(),
          verification: {
            verifiedAt: new Date().toISOString(),
            verificationRef: 'demo-verification',
          },
          expiresAt: null,
        },
      };

      const response = await fetch(`${backendUrl}/recognitions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to present recognition');
      }

      await fetchStatus(subjectId);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!subjectId) return;
    fetchStatus(subjectId);
    const interval = setInterval(() => fetchStatus(subjectId), 1000);
    return () => clearInterval(interval);
  }, [subjectId, backendUrl]);

  if (!subjectId) return null;

  return (
    <div className="min-h-screen bg-slate-50 p-8 flex items-center justify-center">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle>Holder — Present VitalCV</CardTitle>
          <div className="mt-2 rounded bg-slate-100 p-2 text-center text-xs font-mono text-slate-600">
            {subjectId}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Status</Label>
            <div className="flex gap-2">
              <Badge variant={status?.recognized ? 'default' : 'secondary'}>Recognized</Badge>
              <Badge variant={status?.accepted ? 'default' : 'secondary'}>Accepted</Badge>
              <Badge variant={status?.started ? 'default' : 'secondary'}>Started</Badge>
            </div>
          </div>

          {status?.recognized && (
            <div className="space-y-3 rounded-md border p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Recorded</span>
                <span>{new Date().toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Scope</span>
                <span>Clinical Practice</span>
              </div>
            </div>
          )}

          {!status?.recognized && (
            <Button className="w-full" onClick={handlePresent} disabled={loading}>
              {loading ? 'Presenting...' : 'Present Recognition'}
            </Button>
          )}

          {error && <div className="text-sm text-red-500">{error}</div>}
        </CardContent>
      </Card>
    </div>
  );
}
