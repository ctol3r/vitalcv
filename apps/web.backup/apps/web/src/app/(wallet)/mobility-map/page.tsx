'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Map, Globe, TrendingDown, CheckCircle, XCircle } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function MobilityMapPage() {
  const [loading, setLoading] = useState(true);
  const [compactEligibility, setCompactEligibility] = useState<any>(null);
  const [frictionScore, setFrictionScore] = useState<number | null>(null);
  const [concurrency, setConcurrency] = useState<any>(null);
  const [clinicianId] = useState('demo-clinician-1');

  useEffect(() => {
    loadMobilityData();
  }, [clinicianId]);

  async function loadMobilityData() {
    try {
      setLoading(true);

      const [eligibilityRes, concurrencyRes] = await Promise.all([
        fetch(`${API_BASE}/api/credential-mobility/${clinicianId}/compact-eligibility`),
        fetch(`${API_BASE}/api/credential-mobility/${clinicianId}/concurrency`),
      ]);

      const eligibilityData = await eligibilityRes.json();
      const concurrencyData = await concurrencyRes.json();

      if (eligibilityData.success) {
        setCompactEligibility(eligibilityData.eligible);
      }
      if (concurrencyData.success) {
        setConcurrency(concurrencyData.concurrency);
      }
    } catch (error) {
      console.error('Failed to load mobility data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function checkFriction(targetState: string) {
    try {
      const res = await fetch(`${API_BASE}/api/credential-mobility/${clinicianId}/friction-score?targetState=${targetState}`);
      const data = await res.json();
      if (data.success) {
        setFrictionScore(data.score);
      }
    } catch (error) {
      console.error('Failed to check friction:', error);
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Credential Mobility Map</h1>
        <p className="text-muted-foreground mt-2">
          Instantly determine where you can practice, today, across jurisdictions and compacts
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Compact Eligibility
            </CardTitle>
            <CardDescription>Real-time compact eligibility calculator</CardDescription>
          </CardHeader>
          <CardContent>
            {compactEligibility && (
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium mb-2">NLC States</p>
                  <div className="flex flex-wrap gap-2">
                    {compactEligibility.nlc?.slice(0, 10).map((state: string) => (
                      <Badge key={state} variant="default">{state}</Badge>
                    ))}
                    {compactEligibility.nlc?.length > 10 && (
                      <Badge variant="outline">+{compactEligibility.nlc.length - 10} more</Badge>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">IMLC States</p>
                  <div className="flex flex-wrap gap-2">
                    {compactEligibility.imlc?.slice(0, 10).map((state: string) => (
                      <Badge key={state} variant="default">{state}</Badge>
                    ))}
                    {compactEligibility.imlc?.length > 10 && (
                      <Badge variant="outline">+{compactEligibility.imlc.length - 10} more</Badge>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Map className="h-5 w-5" />
              Multi-State Concurrency
            </CardTitle>
            <CardDescription>Simultaneous eligibility across states</CardDescription>
          </CardHeader>
          <CardContent>
            {concurrency && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  {concurrency.concurrent ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                  <span className="font-medium">
                    {concurrency.concurrent ? 'Concurrent practice allowed' : 'Single state only'}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">Eligible States ({concurrency.eligibleStates?.length || 0})</p>
                  <div className="flex flex-wrap gap-2">
                    {concurrency.eligibleStates?.slice(0, 15).map((state: string) => (
                      <Badge key={state} variant="secondary">{state}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5" />
              Regulatory Friction Score
            </CardTitle>
            <CardDescription>Mobility barriers (0-100)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter state code (e.g., CA)"
                  className="flex-1 px-3 py-2 border rounded"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      checkFriction((e.target as HTMLInputElement).value);
                    }
                  }}
                />
                <Button onClick={() => {
                  const input = document.querySelector('input') as HTMLInputElement;
                  if (input?.value) checkFriction(input.value);
                }}>
                  Check
                </Button>
              </div>
              {frictionScore !== null && (
                <div>
                  <div className="text-3xl font-bold">{frictionScore}/100</div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {frictionScore < 30 ? 'Low friction' : frictionScore < 60 ? 'Moderate friction' : 'High friction'}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

