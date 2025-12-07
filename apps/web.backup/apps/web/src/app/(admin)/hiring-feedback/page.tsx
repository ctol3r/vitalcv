'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';

/**
 * Batch 383.4 - Hiring Feedback Loop UI
 * Task 383.8 - Multi-Employer Feedback Comparison
 */

export default function HiringFeedbackPage() {
  const [orgId, setOrgId] = useState('');
  const [loop, setLoop] = useState<any>(null);
  const [comparison, setComparison] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLoop = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/hiring-feedback/${orgId}`);
      const data = await res.json();
      setLoop(data);
    } catch (error) {
      console.error('Failed to fetch feedback loop:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchComparison = async () => {
    if (!orgId) return;
    try {
      const res = await fetch(`/api/hiring-feedback/compare?orgIds=${orgId}`);
      const data = await res.json();
      setComparison(data.loops || []);
    } catch (error) {
      console.error('Failed to fetch comparison:', error);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Hiring Feedback Loop</h1>

      <Card>
        <CardHeader>
          <CardTitle>Feedback Loop Analysis</CardTitle>
          <CardDescription>Model and close the loop between clinician performance and employer hiring behavior</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter organization ID"
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
            />
            <Button onClick={fetchLoop} disabled={loading}>
              Load
            </Button>
            <Button variant="outline" onClick={fetchComparison}>
              Compare
            </Button>
          </div>

          {loop && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Employer Satisfaction</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Progress value={loop.feedback?.employerSatisfaction * 100 || 0} />
                    <p className="text-2xl font-bold mt-2">
                      {((loop.feedback?.employerSatisfaction || 0) * 100).toFixed(1)}%
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Clinician Performance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Progress value={loop.feedback?.clinicianPerformance * 100 || 0} />
                    <p className="text-2xl font-bold mt-2">
                      {((loop.feedback?.clinicianPerformance || 0) * 100).toFixed(1)}%
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Readiness Accuracy</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Progress value={loop.feedback?.readinessAccuracy * 100 || 0} />
                    <p className="text-2xl font-bold mt-2">
                      {((loop.feedback?.readinessAccuracy || 0) * 100).toFixed(1)}%
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Performance Alignment</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Progress value={loop.performanceAlignment * 100 || 0} />
                    <p className="text-2xl font-bold mt-2">
                      {((loop.performanceAlignment || 0) * 100).toFixed(1)}%
                    </p>
                  </CardContent>
                </Card>
              </div>

              {loop.corrections && (
                <Card>
                  <CardHeader>
                    <CardTitle>Corrections</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc list-inside space-y-1">
                      {loop.corrections.actions.map((action: string, i: number) => (
                        <li key={i}>{action}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {comparison.length > 0 && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Multi-Employer Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th>Employer</th>
                        <th>Satisfaction</th>
                        <th>Performance</th>
                        <th>Alignment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparison.map((l: any, i: number) => (
                        <tr key={i}>
                          <td>Org {i + 1}</td>
                          <td>{((l.feedback?.employerSatisfaction || 0) * 100).toFixed(1)}%</td>
                          <td>{((l.feedback?.clinicianPerformance || 0) * 100).toFixed(1)}%</td>
                          <td>{((l.performanceAlignment || 0) * 100).toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

