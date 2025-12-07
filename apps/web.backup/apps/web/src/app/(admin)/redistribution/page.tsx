'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface WorkforceRedistribution {
  region: string;
  redistribution: Array<{
    from: string;
    to: string;
    clinicians: string[];
    reason: string;
  }>;
  multiSpecialty: Record<string, {
    capability: number;
    demand: number;
    gap: number;
  }>;
  crossSystem: {
    networks: string[];
    coordination: string[];
  };
  drift: {
    improvement: number;
    decline: number;
    trend: 'improving' | 'stable' | 'declining';
  };
}

export default function RedistributionPage() {
  const [plan, setPlan] = useState<WorkforceRedistribution | null>(null);
  const [loading, setLoading] = useState(false);
  const [region, setRegion] = useState('');

  const fetchPlan = async () => {
    if (!region) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/workforce-redistribution/${region}`);
      const data = await res.json();
      setPlan(data);
    } catch (error) {
      console.error('Failed to fetch redistribution plan:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Workforce Resilience & Redistribution Engine</h1>
        <p className="text-muted-foreground mt-2">
          Predict workforce resilience and dynamically redistribute clinicians across specialties/employers
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Region</CardTitle>
          <CardDescription>Enter region to view workforce redistribution plan</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <input
              type="text"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="Enter region"
              className="flex-1 px-3 py-2 border rounded-md"
            />
            <button
              onClick={fetchPlan}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Load
            </button>
          </div>
        </CardContent>
      </Card>

      {loading && <div className="text-center py-8">Loading...</div>}

      {plan && (
        <div className="space-y-6">
          {plan.redistribution.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Redistribution Plan</CardTitle>
                <CardDescription>Suggested clinician re-routing to stabilize systems</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {plan.redistribution.map((redist, idx) => (
                    <div key={idx} className="p-3 border rounded-md">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{redist.from}</Badge>
                          <span>→</span>
                          <Badge>{redist.to}</Badge>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {redist.clinicians.length} clinician(s)
                        </span>
                      </div>
                      <div className="text-sm">{redist.reason}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {Object.keys(plan.multiSpecialty).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Multi-Specialty Capability</CardTitle>
                <CardDescription>Capability shifts across specialties</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(plan.multiSpecialty).map(([specialty, data]) => (
                    <div key={specialty} className="p-3 border rounded-md">
                      <div className="flex items-center justify-between mb-2">
                        <Badge>{specialty}</Badge>
                        <span className="text-sm text-muted-foreground">
                          Gap: {data.gap}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>Capability: {data.capability}</div>
                        <div>Demand: {data.demand}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Cross-System Integration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {plan.crossSystem.networks.length > 0 && (
                  <div>
                    <div className="text-sm font-semibold mb-1">Networks:</div>
                    <div className="flex flex-wrap gap-2">
                      {plan.crossSystem.networks.map((network, idx) => (
                        <Badge key={idx} variant="outline">{network}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {plan.crossSystem.coordination.length > 0 && (
                  <div className="mt-2">
                    <div className="text-sm font-semibold mb-1">Coordination:</div>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {plan.crossSystem.coordination.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Resilience Drift</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span>Trend</span>
                  <Badge variant={
                    plan.drift.trend === 'improving' ? 'default' :
                    plan.drift.trend === 'stable' ? 'outline' : 'destructive'
                  }>
                    {plan.drift.trend}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>Improvement: {plan.drift.improvement}</div>
                  <div>Decline: {plan.drift.decline}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}








