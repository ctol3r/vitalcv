'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Globe, MapPin, TrendingUp } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function MobilityMatrixPage() {
  const [loading, setLoading] = useState(true);
  const [regions, setRegions] = useState<string[]>([]);
  const [clinicianId] = useState('demo-clinician-1'); // In production, get from auth

  useEffect(() => {
    loadMobility();
  }, [clinicianId]);

  async function loadMobility() {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/mobility/${clinicianId}/constraints`);
      const data = await res.json();
      if (data.success) {
        // Mock regions for demo
        setRegions(['US-CA', 'US-TX', 'US-NY', 'US-FL', 'UK', 'AU']);
      }
    } catch (error) {
      console.error('Failed to load mobility:', error);
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
        <h1 className="text-3xl font-bold">Global Provider Mobility Matrix</h1>
        <p className="text-muted-foreground mt-2">
          Cross-border, multi-license movement map for clinicians worldwide
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Eligible Regions
            </CardTitle>
            <CardDescription>Where this clinician can practice</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {regions.map((region) => (
                <Badge key={region} variant="default">
                  {region}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Mobility Score
            </CardTitle>
            <CardDescription>Overall mobility rating</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">85/100</div>
            <p className="text-sm text-muted-foreground mt-2">High mobility</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cross-Border Compatibility</CardTitle>
          <CardDescription>International routing rules</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 border rounded">
              <div>
                <p className="font-medium">US → UK</p>
                <p className="text-sm text-muted-foreground">Direct equivalent</p>
              </div>
              <Badge variant="outline">Compatible</Badge>
            </div>
            <div className="flex items-center justify-between p-3 border rounded">
              <div>
                <p className="font-medium">US → AU</p>
                <p className="text-sm text-muted-foreground">Requires equivalency exam</p>
              </div>
              <Badge variant="outline">Conditional</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

