'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Anchor, Download, Timeline } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

interface CredentialContinuumData {
  stages: Array<{ stage: string; credentials: string[]; regulators: string[] }>;
  mappings: Record<string, any>;
  drift: number;
  forecast: Array<{ credential: string; probability: number; timeframe: string }>;
}

export default function ContinuumPage() {
  const [continuum, setContinuum] = useState<CredentialContinuumData | null>(null);
  const [loading, setLoading] = useState(true);
  const [clinicianId] = useState('self');

  useEffect(() => {
    loadContinuum();
  }, [clinicianId]);

  async function loadContinuum() {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/continuum/${clinicianId}`);
      if (res.ok) {
        const data = await res.json();
        setContinuum(data);
      }
    } catch (error) {
      console.error('Failed to load continuum', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="container mx-auto p-6">Loading...</div>;
  if (!continuum) return <div className="container mx-auto p-6">No data available</div>;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Credential Continuum Mapper</h1>
          <p className="text-muted-foreground">Map credentials across life stages and regulators</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => fetch(`${API_BASE}/api/continuum/${clinicianId}/export`).then(r => r.json()).then(d => {
            const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `continuum-${clinicianId}.json`;
            a.click();
          })} variant="outline">
            <Download className="w-4 h-4 mr-2" /> Export
          </Button>
          <Button onClick={() => fetch(`${API_BASE}/api/continuum/${clinicianId}/anchor`, { method: 'POST' }).then(r => r.json()).then(d => alert(`Anchored: ${d.txHash}`))} variant="outline">
            <Anchor className="w-4 h-4 mr-2" /> Anchor
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Life Stages</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {continuum.stages.map((stage, idx) => (
            <div key={idx} className="border rounded p-4">
              <div className="flex items-center gap-2 mb-2">
                <Timeline className="w-4 h-4" />
                <span className="font-bold capitalize">{stage.stage}</span>
                <Badge>{stage.credentials.length} credentials</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{stage.regulators.length} regulators</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {continuum.forecast.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Credential Forecast</CardTitle>
          </CardHeader>
          <CardContent>
            {continuum.forecast.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center p-2 border rounded mb-2">
                <span>{item.credential}</span>
                <Badge>{(item.probability * 100).toFixed(0)}% - {item.timeframe}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

