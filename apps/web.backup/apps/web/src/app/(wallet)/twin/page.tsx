'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { User, Shield, TrendingUp, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export default function DigitalTwinPage() {
  const searchParams = useSearchParams();
  const clinicianId = searchParams.get('clinicianId') || 'self';
  const [twin, setTwin] = useState<any>(null);
  const [projected, setProjected] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTwin();
  }, [clinicianId]);

  const fetchTwin = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/digital-twin/${clinicianId}`);
      if (res.ok) {
        const data = await res.json();
        setTwin(data.model);
      }
    } catch (error) {
      console.error('Failed to fetch digital twin', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProject = async (days: number) => {
    try {
      const res = await fetch(`${API_BASE}/api/digital-twin/${clinicianId}/project?days=${days}`);
      if (res.ok) {
        const data = await res.json();
        setProjected(data);
      }
    } catch (error) {
      console.error('Failed to project future state', error);
    }
  };

  const handleAnchor = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/digital-twin/${clinicianId}/anchor`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        alert(`Twin anchored! TX Hash: ${data.txHash}`);
        fetchTwin();
      }
    } catch (error) {
      console.error('Failed to anchor twin', error);
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

  if (!twin) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <p>No digital twin found. Creating one...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Digital Twin</h1>
          <p className="text-muted-foreground mt-2">
            Real-time digital model of credentials, readiness, risks, privileges, and history
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => handleProject(30)} variant="outline">
            Project 30 Days
          </Button>
          <Button onClick={() => handleProject(90)} variant="outline">
            Project 90 Days
          </Button>
          <Button onClick={handleAnchor}>Anchor Snapshot</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Credentials</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{twin.credentials?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Readiness Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {twin.readiness?.score || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Conflicts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {twin.conflicts?.length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {twin.readiness && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Readiness
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <span className="font-medium">Score: </span>
                {twin.readiness.score || 0}/100
              </div>
              {twin.readiness.indicators && (
                <div>
                  <span className="font-medium">Indicators: </span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {Object.keys(twin.readiness.indicators).map((key) => (
                      <Badge key={key} variant="outline">
                        {key}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {twin.compliance && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Compliance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {twin.compliance.ncqa && (
                <div>
                  <span className="font-medium">NCQA: </span>
                  <Badge variant={twin.compliance.ncqa.cr1 ? 'default' : 'destructive'}>
                    {twin.compliance.ncqa.cr1 ? 'Compliant' : 'Issues'}
                  </Badge>
                </div>
              )}
              {twin.compliance.conflicts && twin.compliance.conflicts.length > 0 && (
                <div className="mt-4">
                  <div className="text-sm font-medium text-red-600">Conflicts:</div>
                  {twin.compliance.conflicts.map((conflict: any, idx: number) => (
                    <div key={idx} className="text-sm text-muted-foreground mt-1">
                      • {conflict.description}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {twin.conflicts && twin.conflicts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Conflicts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {twin.conflicts.map((conflict: any, idx: number) => (
                <div key={idx} className="p-3 border rounded-lg">
                  <div className="font-medium">{conflict.type}</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {conflict.description}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {projected && (
        <Card>
          <CardHeader>
            <CardTitle>Projected Future State</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {projected.credentials?.map((cred: any) => (
                <div key={cred.id} className="p-2 border rounded">
                  <div className="font-medium">{cred.type}</div>
                  {cred.projectedStatus && (
                    <Badge variant={cred.projectedStatus === 'expired' ? 'destructive' : 'default'}>
                      {cred.projectedStatus}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

