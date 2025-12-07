'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface DeploymentKernel {
  region: string;
  recommendations: Array<{
    clinicianId: string;
    targetRegion: string;
    role: string;
    priority: string;
    rationale: string;
  }>;
  thermalMap: Array<{
    region: string;
    heat: number;
    specialty: string;
    urgency: string;
  }>;
  trajectory: {
    predictedDeployments: number;
    timeframe: string;
  };
}

export default function DeploymentKernelPage() {
  const [deployment, setDeployment] = useState<DeploymentKernel | null>(null);
  const [loading, setLoading] = useState(false);
  const [region, setRegion] = useState('');

  const fetchDeployment = async () => {
    if (!region) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/deployment-kernel/${region}`);
      const data = await res.json();
      setDeployment(data);
    } catch (error) {
      console.error('Failed to fetch deployment kernel:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Workforce Adaptive Deployment Kernel</h1>
        <p className="text-muted-foreground mt-2">
          Dynamically deploy clinicians across roles, employers, and regions in real time
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Region</CardTitle>
          <CardDescription>Enter region to view deployment kernel</CardDescription>
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
              onClick={fetchDeployment}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Load
            </button>
          </div>
        </CardContent>
      </Card>

      {loading && <div className="text-center py-8">Loading...</div>}

      {deployment && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Workforce Thermal Map</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {deployment.thermalMap.map((map, idx) => (
                  <div key={idx} className="border rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <div>
                        <span className="font-semibold">{map.specialty}</span>
                        <span className="text-sm text-muted-foreground ml-2">({map.region})</span>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant={map.urgency === 'critical' ? 'destructive' : map.urgency === 'high' ? 'secondary' : 'outline'}>
                          {map.urgency}
                        </Badge>
                        <Badge variant="outline">{Math.round(map.heat * 100)}%</Badge>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          map.heat > 0.9 ? 'bg-red-500' :
                          map.heat > 0.7 ? 'bg-orange-500' :
                          map.heat > 0.5 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${map.heat * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Deployment Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {deployment.recommendations.map((rec, idx) => (
                  <Alert key={idx} variant={rec.priority === 'urgent' ? 'destructive' : rec.priority === 'high' ? 'secondary' : 'default'}>
                    <AlertDescription>
                      <div className="space-y-1">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-semibold">{rec.clinicianId}</div>
                            <div className="text-sm">{rec.role} → {rec.targetRegion}</div>
                            <div className="text-sm text-muted-foreground mt-1">{rec.rationale}</div>
                          </div>
                          <Badge variant={rec.priority === 'urgent' ? 'destructive' : rec.priority === 'high' ? 'secondary' : 'outline'}>
                            {rec.priority}
                          </Badge>
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Deployment Trajectory</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Predicted Deployments</span>
                  <Badge variant="outline">
                    {deployment.trajectory.predictedDeployments}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Timeframe</span>
                  <Badge variant="outline">
                    {deployment.trajectory.timeframe}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}








