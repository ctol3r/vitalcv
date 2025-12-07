'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function AutomationKernelPage() {
  const [forecasts, setForecasts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const clinicianId = 'demo-clinician-id'; // Replace with actual ID

    fetch(`${API_BASE}/api/automation-kernel/renewals/${clinicianId}`)
      .then((res) => res.json())
      .then((data) => {
        setForecasts(data.forecasts || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load automation kernel', err);
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
          <CardTitle>Automation Kernel Dashboard</CardTitle>
          <CardDescription>Credentialing automation and renewal forecasts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Renewal Forecasts ({forecasts.length})</h3>
              <div className="space-y-2">
                {forecasts.map((forecast, i) => (
                  <div key={i} className="p-3 border rounded">
                    <div className="font-medium">{forecast.credentialType}</div>
                    <div className="text-sm text-muted-foreground">
                      Expires: {new Date(forecast.currentExpiration).toLocaleDateString()} •{' '}
                      {forecast.daysUntilExpiration} days remaining • Urgency: {forecast.urgency}
                    </div>
                    <div className="text-sm mt-1">
                      Tasks: {forecast.tasksRequired.join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

