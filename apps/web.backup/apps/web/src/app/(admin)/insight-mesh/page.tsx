'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, Building2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export default function InsightMeshPage() {
  const [mesh, setMesh] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMesh();
  }, []);

  const fetchMesh = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/insight-mesh`);
      if (res.ok) {
        const data = await res.json();
        setMesh(data.mesh);
      }
    } catch (error) {
      console.error('Failed to fetch insight mesh', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAnchor = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/insight-mesh/anchor`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        alert(`Mesh anchored! TX Hash: ${data.txHash}`);
        fetchMesh();
      }
    } catch (error) {
      console.error('Failed to anchor mesh', error);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const employers = mesh?.employers || {};
  const anomalies = mesh?.anomalies || [];
  const predictions = mesh?.predictions || {};

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Employer Insight Mesh</h1>
          <p className="text-muted-foreground mt-2">
            Federated intelligence layer for employer performance, hiring efficiency, compliance
          </p>
        </div>
        <Button onClick={handleAnchor}>Anchor Snapshot</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Employers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Object.keys(employers).length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Anomalies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{anomalies.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Last Updated</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm">{mesh?.lastUpdated || 'Never'}</div>
          </CardContent>
        </Card>
      </div>

      {anomalies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Anomalies
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {anomalies.map((anomaly: any, idx: number) => (
                <div key={idx} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{anomaly.type}</div>
                    <Badge
                      variant={
                        anomaly.severity === 'high'
                          ? 'destructive'
                          : anomaly.severity === 'medium'
                            ? 'default'
                            : 'secondary'
                      }
                    >
                      {anomaly.severity}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {anomaly.description}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Org: {anomaly.orgId} | Detected: {new Date(anomaly.detectedAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Object.entries(employers).slice(0, 5).map(([orgId, insights]: [string, any]) => (
          <Card key={orgId}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                {orgId}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <span className="font-medium">Time to Fill: </span>
                {insights.hiringEfficiency?.timeToFill || 0} days
              </div>
              <div>
                <span className="font-medium">Conversion Rate: </span>
                {((insights.hiringEfficiency?.conversionRate || 0) * 100).toFixed(1)}%
              </div>
              <div>
                <span className="font-medium">Stability Score: </span>
                {insights.stability?.score || 0}/100
              </div>
              {predictions.futureHiring?.[orgId] && (
                <div>
                  <span className="font-medium">Predicted Hires (3mo): </span>
                  {predictions.futureHiring[orgId].predicted} (
                  {(predictions.futureHiring[orgId].confidence * 100).toFixed(0)}% confidence)
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

