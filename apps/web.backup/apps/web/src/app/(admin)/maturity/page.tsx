'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function MaturityPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const orgId = 'demo-org-id'; // Replace with actual org ID
    fetch(`${API_BASE}/api/credential-maturity/${orgId}`)
      .then((res) => res.json())
      .then((data) => {
        setData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load maturity', err);
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
          <CardTitle>Employer Credential Maturity Model</CardTitle>
          <CardDescription>Score organizations on credentialing rigor, automation, and compliance</CardDescription>
        </CardHeader>
        <CardContent>
          {data ? (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Maturity Score</h3>
                <div className="text-2xl font-bold">
                  {(data.score * 100).toFixed(0)}%
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Signals</h3>
                <div className="text-sm text-muted-foreground">
                  {Object.keys(data.signals || {}).length} maturity signals tracked
                </div>
              </div>
            </div>
          ) : (
            <div>No maturity data available</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}








