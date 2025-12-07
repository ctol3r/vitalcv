'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function DidSyncPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const clinicianId = 'demo-clinician-id'; // Replace with actual ID
    fetch(`${API_BASE}/api/did-sync/${clinicianId}`)
      .then((res) => res.json())
      .then((data) => {
        setData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load DID sync', err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Multi-DID Identity Synchronizer</CardTitle>
          <CardDescription>Synchronize identity across wallets, DID methods, and regions</CardDescription>
        </CardHeader>
        <CardContent>
          {data ? (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">DIDs</h3>
                <div className="text-sm text-muted-foreground">
                  {Object.keys(data.dids || {}).length} DID methods synchronized
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Sync Status</h3>
                <div className="text-sm text-muted-foreground">
                  Last synced: {data.updatedAt ? new Date(data.updatedAt).toLocaleString() : 'Never'}
                </div>
              </div>
            </div>
          ) : (
            <div>No DID sync data available</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}








