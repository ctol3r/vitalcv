'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';

/**
 * Batch 385.4 - Workforce Stability Field UI
 */

export default function StabilityFieldPage() {
  const [region, setRegion] = useState('US');
  const [field, setField] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchField = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/workforce-stability/${region}`);
      const data = await res.json();
      setField(data);
    } catch (error) {
      console.error('Failed to fetch stability field:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Workforce Stability Field</h1>

      <Card>
        <CardHeader>
          <CardTitle>Stability Analysis</CardTitle>
          <CardDescription>Continuous global measure of workforce stability</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Region"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
            />
            <Button onClick={fetchField} disabled={loading}>
              Analyze
            </Button>
          </div>

          {field && (
            <div className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Overall Stability</CardTitle>
                </CardHeader>
                <CardContent>
                  <Progress value={field.stability * 100} />
                  <p className="text-2xl font-bold mt-2">{(field.stability * 100).toFixed(1)}%</p>
                </CardContent>
              </Card>

              {field.signals && (
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Churn</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Progress value={field.signals.churn * 100} />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Burnout</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Progress value={field.signals.burnout * 100} />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Readiness</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Progress value={field.signals.readiness * 100} />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Hiring Velocity</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Progress value={field.signals.hiringVelocity * 100} />
                    </CardContent>
                  </Card>
                </div>
              )}

              {field.remediation && (
                <Card>
                  <CardHeader>
                    <CardTitle>Remediation Interventions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc list-inside space-y-1">
                      {field.remediation.interventions.map((intervention: string, i: number) => (
                        <li key={i}>{intervention}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

