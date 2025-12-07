'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Shield, AlertTriangle, FileText } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function RegulatoryFusionPage() {
  const [loading, setLoading] = useState(true);
  const [fusion, setFusion] = useState<any>(null);

  useEffect(() => {
    loadFusion();
  }, []);

  async function loadFusion() {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/regulatory-fusion`);
      if (res.ok) {
        const data = await res.json();
        setFusion(data.fusion);
      }
    } catch (error) {
      console.error('Failed to load fusion:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading && !fusion) {
    return (
      <div className="container mx-auto p-6 space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const rules = fusion?.rules || [];
  const conflicts = fusion?.conflicts || [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Regulatory Fusion Intelligence</h1>
          <p className="text-muted-foreground mt-2">
            Fused regulatory signals, rules, and compliance across regions
          </p>
        </div>
        <Button variant="outline" onClick={loadFusion}>
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Total Rules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{rules.length}</div>
            <div className="text-sm text-muted-foreground mt-2">Regulatory rules</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Conflicts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-500">{conflicts.length}</div>
            <div className="text-sm text-muted-foreground mt-2">Detected conflicts</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Last Updated</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold">
              {fusion?.lastUpdated ? new Date(fusion.lastUpdated).toLocaleDateString() : 'N/A'}
            </div>
          </CardContent>
        </Card>
      </div>

      {conflicts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Regulatory Conflicts</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {conflicts.map((conflict: any, idx: number) => (
                <li key={idx} className="p-3 border rounded flex items-start">
                  <AlertTriangle className="h-5 w-5 text-yellow-500 mr-2 mt-0.5" />
                  <div>
                    <div className="font-semibold">{conflict.conflict}</div>
                    <div className="text-sm text-muted-foreground">
                      Rules: {conflict.rule1} vs {conflict.rule2}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}








