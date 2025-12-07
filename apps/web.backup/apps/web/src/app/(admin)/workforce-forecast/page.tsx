'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, AlertTriangle, TrendingUp, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function WorkforceForecastPage() {
  const [region, setRegion] = useState('US-CA');
  const [forecast, setForecast] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchForecast = useCallback(async () => {
    if (!region) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/workforce-forecast/${region}`);
      if (!response.ok) {
        throw new Error(`Failed to load forecast (${response.status})`);
      }
      const data = await response.json();
      setForecast(data);
    } catch (err) {
      console.error('Failed to fetch forecast', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [region]);

  useEffect(() => {
    fetchForecast();
  }, [fetchForecast]);

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Workforce Forecast Engine</h1>
          <p className="text-muted-foreground">
            Predict supply, demand, churn, surges, and onboarding timelines across regions
          </p>
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Input
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="Region (e.g., US-CA)"
            className="md:w-56"
          />
          <Button onClick={fetchForecast} variant="secondary">
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && <p className="text-muted-foreground">Loading forecast...</p>}

      {forecast && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Supply</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {forecast.forecast?.supply ?? '--'}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Demand</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {forecast.forecast?.demand ?? '--'}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Churn Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {forecast.forecast?.churn ? `${(forecast.forecast.churn * 100).toFixed(1)}%` : '--'}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Onboarding Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {forecast.forecast?.onboardingTimeline ? `${forecast.forecast.onboardingTimeline} days` : '--'}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {forecast && forecast.forecast?.specialties && (
        <Card>
          <CardHeader>
            <CardTitle>Specialty Forecast</CardTitle>
            <CardDescription>Supply and demand by specialty</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Specialty</TableHead>
                  <TableHead>Supply</TableHead>
                  <TableHead>Demand</TableHead>
                  <TableHead>Shortage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(forecast.forecast.specialties).map(([specialty, data]: [string, any]) => (
                  <TableRow key={specialty}>
                    <TableCell className="font-semibold">{specialty}</TableCell>
                    <TableCell>{data.supply}</TableCell>
                    <TableCell>{data.demand}</TableCell>
                    <TableCell>
                      <Badge variant={data.shortage > 0 ? 'destructive' : 'outline'}>
                        {data.shortage > 0 ? `-${data.shortage}` : 'Surplus'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}








