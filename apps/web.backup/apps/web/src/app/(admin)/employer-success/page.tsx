'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, Target, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function EmployerSuccessPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [orgId, setOrgId] = useState('');

  useEffect(() => {
    if (orgId) {
      loadData();
    }
  }, [orgId]);

  async function loadData() {
    if (!orgId) return;
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/success-probability/${orgId}`);
      if (res.ok) {
        const successData = await res.json();
        setData(successData);
      }
    } catch (error) {
      console.error('Failed to load success probability:', error);
    } finally {
      setLoading(false);
    }
  }

  if (!orgId) {
    return (
      <div className="container mx-auto p-6 space-y-4">
        <div>
          <h1 className="text-3xl font-bold">Employer Success Probability</h1>
          <p className="text-muted-foreground mt-2">
            Predict which employers will successfully hire, retain, and support clinicians
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Enter Organization ID</CardTitle>
          </CardHeader>
          <CardContent>
            <input
              type="text"
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              placeholder="Enter organization ID"
              className="w-full p-2 border rounded"
            />
            <Button onClick={loadData} className="mt-4">
              Load Success Data
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const factors = data?.factors || {};
  const score = data?.score || 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Employer Success Probability</h1>
          <p className="text-muted-foreground mt-2">
            Organization: {orgId}
          </p>
        </div>
        <Button variant="outline" onClick={loadData} disabled={loading}>
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Success Score</CardTitle>
            <CardDescription>Overall probability of success</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-bold mb-2">{score}%</div>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div
                className={cn(
                  'h-4 rounded-full',
                  score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                )}
                style={{ width: `${score}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Key Factors</CardTitle>
            <CardDescription>Contributing factors</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span>Retention Rate</span>
                <Badge>{(factors.retentionRate * 100).toFixed(0)}%</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Offer Acceptance</span>
                <Badge>{(factors.offerAcceptanceRate * 100).toFixed(0)}%</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Compliance Score</span>
                <Badge>{(factors.complianceScore * 100).toFixed(0)}%</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Safety Score</span>
                <Badge>{(factors.safetyScore * 100).toFixed(0)}%</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Success Factors Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span>Hiring Speed</span>
                <span>{factors.hiringSpeed || 0} days</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full"
                  style={{ width: `${Math.max(0, 100 - (factors.hiringSpeed || 0))}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span>Retention Rate</span>
                <span>{(factors.retentionRate * 100 || 0).toFixed(0)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-500 h-2 rounded-full"
                  style={{ width: `${(factors.retentionRate * 100 || 0)}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span>Clinician Satisfaction</span>
                <span>{(factors.clinicianSatisfaction * 100 || 0).toFixed(0)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-purple-500 h-2 rounded-full"
                  style={{ width: `${(factors.clinicianSatisfaction * 100 || 0)}%` }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

