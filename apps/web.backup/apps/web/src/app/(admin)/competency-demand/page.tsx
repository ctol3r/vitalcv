'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, Map, AlertCircle, BarChart3 } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function CompetencyDemandPage() {
  const [loading, setLoading] = useState(true);
  const [mesh, setMesh] = useState<any>(null);
  const [pressure, setPressure] = useState<any[]>([]);
  const [scarcity, setScarcity] = useState<Record<string, number>>({});

  useEffect(() => {
    loadMesh();
  }, []);

  async function loadMesh() {
    try {
      setLoading(true);
      const [meshRes, pressureRes, scarcityRes] = await Promise.all([
        fetch(`${API_BASE}/api/competency-demand/mesh`),
        fetch(`${API_BASE}/api/competency-demand/pressure`),
        fetch(`${API_BASE}/api/competency-demand/scarcity`),
      ]);

      const meshData = await meshRes.json();
      if (meshData.success) {
        setMesh(meshData.mesh);
      }

      const pressureData = await pressureRes.json();
      if (pressureData.success) {
        setPressure(pressureData.pressure || []);
      }

      const scarcityData = await scarcityRes.json();
      if (scarcityData.success) {
        setScarcity(scarcityData.scarcity || {});
      }
    } catch (error) {
      console.error('Failed to load mesh:', error);
    } finally {
      setLoading(false);
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
        <h1 className="text-3xl font-bold">Nationwide Competency Demand Mesh</h1>
        <p className="text-muted-foreground mt-2">
          A mesh showing which competencies are needed where, right now and in the future
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Competency Demand
            </CardTitle>
            <CardDescription>Current and projected demand by competency</CardDescription>
          </CardHeader>
          <CardContent>
            {mesh && mesh.competencies && (
              <div className="space-y-2">
                {mesh.competencies.slice(0, 5).map((comp: any, i: number) => (
                  <div key={i} className="p-2 border rounded">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{comp.competency}</span>
                      <Badge variant="outline">{comp.region}</Badge>
                    </div>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-sm text-muted-foreground">
                        Current: {comp.currentDemand}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        Projected: {comp.projectedDemand}
                      </span>
                    </div>
                    <Progress value={comp.scarcity} className="mt-2" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Demand Pressure
            </CardTitle>
            <CardDescription>Rising competency shortages</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pressure.length > 0 ? (
                pressure.map((p, i) => (
                  <div key={i} className="p-2 border rounded">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium">{p.competency}</span>
                        <Badge variant="outline" className="ml-2">
                          {p.region}
                        </Badge>
                      </div>
                      <Badge
                        variant={p.severity === 'critical' ? 'destructive' : 'default'}
                      >
                        {p.severity}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Growth: {p.growthRate}% • Scarcity: {p.scarcity}%
                    </div>
                  </div>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">No pressure points detected</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Scarcity Scores
            </CardTitle>
            <CardDescription>Competency scarcity levels</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(scarcity)
                .slice(0, 5)
                .map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between p-2 border rounded">
                    <span className="text-sm">{key.replace(/_/g, ' ')}</span>
                    <div className="flex items-center gap-2">
                      <Progress value={value} className="w-24" />
                      <span className="text-sm font-medium">{value}%</span>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Map className="h-5 w-5" />
              Region Mapping
            </CardTitle>
            <CardDescription>Competencies needed by region</CardDescription>
          </CardHeader>
          <CardContent>
            {mesh && mesh.regionMapping && (
              <div className="space-y-2">
                {Object.entries(mesh.regionMapping).map(([region, comps]: [string, any]) => (
                  <div key={region} className="p-2 border rounded">
                    <div className="font-medium mb-1">{region}</div>
                    <div className="flex flex-wrap gap-1">
                      {(comps as string[]).slice(0, 3).map((comp, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {comp}
                        </Badge>
                      ))}
                      {(comps as string[]).length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{(comps as string[]).length - 3} more
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

