'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function AttestationReinforcementPage() {
  const [reinforcement, setReinforcement] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const credentialId = 'cred_123'; // TODO: Get from context
    fetch(`${API_BASE}/api/attestation-reinforcement/${credentialId}`)
      .then((res) => res.json())
      .then((data) => {
        setReinforcement(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton className="h-64 w-full" />;
  if (!reinforcement) return <div>No reinforcement data</div>;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Blockchain Attestation Reinforcement</CardTitle>
          <CardDescription>Reinforcing and hardening attestation proofs across all chains</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">Attestation Strength</span>
              <span className="text-sm font-bold">{reinforcement.strength?.toFixed(1) || 0}/100</span>
            </div>
            <Progress value={reinforcement.strength || 0} />
          </div>
          {reinforcement.tamperDetection?.detected && (
            <Badge variant="destructive">Tampering Detected</Badge>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

