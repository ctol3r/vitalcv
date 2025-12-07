'use client';

import { Eye, RefreshCw } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_BASE_URL || '';

export default function RegMultiViewPage() {
  const [clinicianId, setClinicianId] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  const fetchViews = async () => {
    if (!clinicianId.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/reg-multiview/${clinicianId}`);
      if (res.ok) setData(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Eye className="h-8 w-8" />
          Regulatory Multi-View Consistency
        </h1>
        <p className="text-muted-foreground mt-2">
          Ensure regulatory states remain consistent across chain, issuer, employer, and regulator views
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Multi-View Analysis</CardTitle>
          <CardDescription>Enter clinician ID to analyze regulatory consistency</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Clinician ID"
              value={clinicianId}
              onChange={(e) => setClinicianId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchViews()}
            />
            <Button onClick={fetchViews} disabled={loading || !clinicianId.trim()}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Analyze
            </Button>
          </div>

          {data && data.harmonization && (
            <Card>
              <CardHeader>
                <CardTitle>Harmonization</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span>Aligned</span>
                    <Badge variant={data.harmonization.aligned ? 'default' : 'destructive'}>
                      {data.harmonization.aligned ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                  <div className="text-3xl font-bold">{data.harmonization.confidence}/100</div>
                  <Progress value={data.harmonization.confidence} />
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

