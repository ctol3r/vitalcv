'use client';

import { useCallback, useEffect, useState } from 'react';
import { Route, TrendingUp, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function RoutingPage() {
  const [clinicianId, setClinicianId] = useState('');
  const [routing, setRouting] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRouting = useCallback(async () => {
    if (!clinicianId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/routing/routing/trust-weighted`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicianId,
          candidateEmployers: ['employer-1', 'employer-2', 'employer-3'],
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to load routing (${response.status})`);
      }

      const data = await response.json();
      setRouting(data);
    } catch (err) {
      console.error('Failed to fetch routing', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [clinicianId]);

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Intelligent Employer Routing Mesh</h1>
          <p className="text-muted-foreground">
            Direct clinicians toward the best-fit employers using readiness, safety, trust, and economic signals
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Find Best-Fit Employers</CardTitle>
          <CardDescription>Enter a clinician ID to find optimal employer matches</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={clinicianId}
              onChange={(e) => setClinicianId(e.target.value)}
              placeholder="Clinician ID"
              className="flex-1"
            />
            <Button onClick={fetchRouting} disabled={!clinicianId || loading}>
              Find Routes
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading && <p className="text-muted-foreground">Finding optimal routes...</p>}

          {routing.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recommended Employers</CardTitle>
                <CardDescription>Sorted by routing score</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employer</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Readiness</TableHead>
                      <TableHead>Trust</TableHead>
                      <TableHead>Demand</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {routing.map((route, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-semibold">{route.employerId}</TableCell>
                        <TableCell>
                          <Badge variant={route.score >= 80 ? 'default' : route.score >= 60 ? 'secondary' : 'outline'}>
                            {route.score}
                          </Badge>
                        </TableCell>
                        <TableCell>{route.factors.readiness}</TableCell>
                        <TableCell>{route.factors.trust}</TableCell>
                        <TableCell>{route.factors.demand}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}








