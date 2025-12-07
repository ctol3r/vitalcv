'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function FlexibilityPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const clinicianId = 'demo-clinician-id'; // Replace with actual clinician ID
    fetch(`${API_BASE}/api/flexibility/${clinicianId}`)
      .then((res) => res.json())
      .then((data) => {
        setData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load flexibility', err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Clinician Flexibility & Mobility Engine</CardTitle>
          <CardDescription>Analyze how flexibly and quickly you can move into new roles, regions, or specialties</CardDescription>
        </CardHeader>
        <CardContent>
          {data ? (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2">Role Switchability</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span>Score</span>
                    <span className="font-bold">{(data.roleSwitchability?.score * 100).toFixed(0)}%</span>
                  </div>
                  <Progress value={data.roleSwitchability?.score * 100} />
                  <p className="text-sm text-muted-foreground">
                    Time to switch: {data.roleSwitchability?.timeToSwitch} days
                  </p>
                  <div className="flex gap-2 mt-2">
                    {data.roleSwitchability?.targetRoles?.map((role: string, idx: number) => (
                      <Badge key={idx} variant="outline">{role}</Badge>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Cross-Privilege Flexibility</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span>Score</span>
                    <span className="font-bold">{data.crossPrivilegeFlexibility?.score}/100</span>
                  </div>
                  <Progress value={data.crossPrivilegeFlexibility?.score} />
                  <div className="flex gap-2 mt-2">
                    {data.crossPrivilegeFlexibility?.expandablePrivileges?.map((priv: string, idx: number) => (
                      <Badge key={idx} variant="outline">{priv}</Badge>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Location Readiness</h3>
                <div className="space-y-2">
                  {Object.entries(data.locationReadiness?.readinessScores || {}).map(([region, score]: [string, any]) => (
                    <div key={region} className="flex items-center justify-between p-2 border rounded">
                      <span>{region}</span>
                      <Badge>{(score * 100).toFixed(0)}%</Badge>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">CME Mobility Enhancements</h3>
                <div className="space-y-2">
                  {data.cmeMobilityEnhancements?.map((enhancement: any, idx: number) => (
                    <div key={idx} className="p-3 border rounded">
                      <div className="font-medium">{enhancement.cme}</div>
                      <p className="text-sm text-muted-foreground">
                        Unlocks: {enhancement.unlocks.join(', ')}
                      </p>
                      <Badge variant="outline" className="mt-2">{enhancement.impact}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div>No flexibility data available</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}








