'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity, AlertTriangle, TrendingUp } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function StaffingPressurePage() {
  const [loading, setLoading] = useState(true);
  const [pressure, setPressure] = useState<any>(null);
  const [region, setRegion] = useState('US-West');

  useEffect(() => {
    loadPressure();
  }, [region]);

  async function loadPressure() {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/staffing-pressure/${region}`);
      if (res.ok) {
        const data = await res.json();
        setPressure(data.pressure);
      }
    } catch (error) {
      console.error('Failed to load pressure:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading && !pressure) {
    return (
      <div className="container mx-auto p-6 space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const aggregated = pressure?.aggregated || {};
  const facilities = pressure?.facilities || [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Staffing Pressure Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Detect, predict, and relieve staffing pressure at facility, system, region, and specialty levels
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="px-4 py-2 border rounded"
          >
            <option value="US-West">US-West</option>
            <option value="US-East">US-East</option>
            <option value="US-Central">US-Central</option>
          </select>
          <Button variant="outline" onClick={loadPressure}>
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Total Pressure</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{aggregated.totalPressure?.toFixed(1) || 0}</div>
            <div className="text-sm text-muted-foreground mt-2">Average pressure score</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Critical Facilities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-500">{aggregated.criticalCount || 0}</div>
            <div className="text-sm text-muted-foreground mt-2">In critical state</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>High Pressure</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-500">{aggregated.highCount || 0}</div>
            <div className="text-sm text-muted-foreground mt-2">High pressure facilities</div>
          </CardContent>
        </Card>
      </div>

      {pressure?.reliefSuggestions && pressure.reliefSuggestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Relief Suggestions</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {pressure.reliefSuggestions.map((suggestion: any, idx: number) => (
                <li key={idx} className="p-3 border rounded flex items-center justify-between">
                  <span>{suggestion.action}</span>
                  <Badge>Impact: {suggestion.impact}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {facilities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Facilities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {facilities.slice(0, 10).map((facility: any, idx: number) => (
                <div key={idx} className="p-3 border rounded flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{facility.facilityName}</div>
                    <div className="text-sm text-muted-foreground">{facility.specialty}</div>
                  </div>
                  <Badge
                    variant={
                      facility.urgency === 'critical' ? 'destructive' :
                      facility.urgency === 'high' ? 'default' : 'secondary'
                    }
                  >
                    {facility.pressure.toFixed(0)}%
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}








