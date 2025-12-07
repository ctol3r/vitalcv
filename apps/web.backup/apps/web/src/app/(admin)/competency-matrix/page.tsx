'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Grid3x3, CheckCircle, XCircle } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function CompetencyMatrixPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/competency-matrix`);
      if (res.ok) {
        const matrixData = await res.json();
        setData(matrixData);
      }
    } catch (error) {
      console.error('Failed to load competency matrix:', error);
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

  const matrix = data?.matrix || {};
  const competencies = matrix.competencies || [];
  const mappings = matrix.mappings || [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Global Clinical Competency Matrix</h1>
          <p className="text-muted-foreground mt-2">
            A universal competency framework for all roles, specialties, and regions
          </p>
        </div>
        <Button variant="outline" onClick={loadData} disabled={loading}>
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Competencies</CardTitle>
            <CardDescription>Total competency definitions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{competencies.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Specialty Mappings</CardTitle>
            <CardDescription>Specialty-to-competency mappings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{mappings.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Equivalencies</CardTitle>
            <CardDescription>Cross-country equivalencies</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{matrix.equivalencies?.length || 0}</div>
          </CardContent>
        </Card>
      </div>

      {competencies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Competency Definitions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {competencies.slice(0, 5).map((comp: any, idx: number) => (
                <div key={idx} className="border-b pb-4 last:border-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold">{comp.name}</div>
                    <Badge>{comp.category}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Levels: {comp.levels?.length || 0}
                  </div>
                  {comp.levels && comp.levels.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {comp.levels.slice(0, 3).map((level: any, i: number) => (
                        <div key={i} className="text-xs text-muted-foreground">
                          Level {level.level}: {level.description}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {mappings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Specialty Mappings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {mappings.map((mapping: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-2 border rounded">
                  <div>
                    <div className="font-medium">{mapping.specialty}</div>
                    <div className="text-sm text-muted-foreground">
                      {mapping.requiredCompetencies?.length || 0} required competencies
                    </div>
                  </div>
                  <Badge variant="outline">
                    {Object.keys(mapping.thresholds || {}).length} thresholds
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

