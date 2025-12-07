'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function AccelerationPage() {
  const [readiness, setReadiness] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const clinicianId = 'demo-clinician-id'; // Replace with actual ID

    fetch(`${API_BASE}/api/workforce-acceleration/travel-readiness/${clinicianId}`)
      .then((res) => res.json())
      .then((data) => {
        setReadiness(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load acceleration', err);
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
          <CardTitle>Workforce Acceleration Engine</CardTitle>
          <CardDescription>Predict, recommend, and automate clinician deployment</CardDescription>
        </CardHeader>
        <CardContent>
          {readiness ? (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">
                  Travel Readiness Score: {(readiness.score * 100).toFixed(0)}%
                </h3>
                <div className="space-y-2">
                  <div className="text-sm">
                    Mobility Passport: {(readiness.factors.mobilityPassport * 100).toFixed(0)}%
                  </div>
                  <div className="text-sm">
                    Privileges: {(readiness.factors.privileges * 100).toFixed(0)}%
                  </div>
                  <div className="text-sm">
                    Active Licenses: {(readiness.factors.activeLicenses * 100).toFixed(0)}%
                  </div>
                </div>
                {readiness.readyStates && readiness.readyStates.length > 0 && (
                  <div className="mt-2">
                    <div className="text-sm font-medium">Ready States:</div>
                    <div className="text-sm text-muted-foreground">
                      {readiness.readyStates.join(', ')}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div>No acceleration data available</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

