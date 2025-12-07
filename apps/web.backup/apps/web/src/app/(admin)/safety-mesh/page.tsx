'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function SafetyMeshPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/safety-mesh`)
      .then((res) => res.json())
      .then((data) => {
        setData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load safety mesh', err);
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
          <CardTitle>Safety & Compliance Mesh</CardTitle>
          <CardDescription>Federated network connecting sanctions, safety events, and regulators</CardDescription>
        </CardHeader>
        <CardContent>
          {data ? (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Sanctions</h3>
                <div className="text-sm text-muted-foreground">
                  {data.mesh?.sanctions?.length ?? 0} active sanctions
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Safety Events</h3>
                <div className="text-sm text-muted-foreground">
                  {data.mesh?.safetyEvents?.length ?? 0} safety events tracked
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Regulators</h3>
                <div className="text-sm text-muted-foreground">
                  {data.mesh?.regulators?.length ?? 0} regulatory sources connected
                </div>
              </div>
            </div>
          ) : (
            <div>No safety mesh data available</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}








