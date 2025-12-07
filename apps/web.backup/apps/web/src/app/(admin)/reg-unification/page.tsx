'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * Batch 384.4 - Regulatory Unification UI
 */

export default function RegulatoryUnificationPage() {
  const [region, setRegion] = useState('US');
  const [layer, setLayer] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchLayer = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/regulatory-unification/${region}`);
      const data = await res.json();
      setLayer(data);
    } catch (error) {
      console.error('Failed to fetch unification layer:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Regulatory State Unification</h1>

      <Card>
        <CardHeader>
          <CardTitle>Unified Regulatory Rules</CardTitle>
          <CardDescription>Unify conflicting regulatory states into a canonical source of truth</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Region (e.g., US, EU)"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
            />
            <Button onClick={fetchLayer} disabled={loading}>
              Load
            </Button>
          </div>

          {layer && (
            <div className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Unified Rules</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {layer.unified ? `${(layer.unified as any).unified?.length || 0} unified rules` : 'No rules found'}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

