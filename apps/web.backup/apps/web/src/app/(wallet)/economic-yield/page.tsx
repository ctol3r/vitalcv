'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Anchor, Download, DollarSign } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

interface ClinicianEconomicYieldData {
  totalYield: number;
  onboardingTimeSaved: number;
  shortageMitigation: number;
  shiftCoverageValue: number;
  systemLevelAttribution: number;
  forecast: Array<{ period: string; predictedYield: number }>;
}

export default function EconomicYieldPage() {
  const [yield_, setYield] = useState<ClinicianEconomicYieldData | null>(null);
  const [loading, setLoading] = useState(true);
  const [clinicianId] = useState('self');

  useEffect(() => {
    loadYield();
  }, [clinicianId]);

  async function loadYield() {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/economics/yield/${clinicianId}`);
      if (res.ok) {
        const data = await res.json();
        setYield(data);
      }
    } catch (error) {
      console.error('Failed to load economic yield', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="container mx-auto p-6">Loading...</div>;
  if (!yield_) return <div className="container mx-auto p-6">No data available</div>;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Economic Yield Engine</h1>
          <p className="text-muted-foreground">Quantify clinician economic impact</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => fetch(`${API_BASE}/api/economics/yield/${clinicianId}/export`).then(r => r.json()).then(d => {
            const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `economic-yield-${clinicianId}.json`;
            a.click();
          })} variant="outline">
            <Download className="w-4 h-4 mr-2" /> Export
          </Button>
          <Button onClick={() => fetch(`${API_BASE}/api/economics/yield/${clinicianId}/anchor`, { method: 'POST' }).then(r => r.json()).then(d => alert(`Anchored: ${d.txHash}`))} variant="outline">
            <Anchor className="w-4 h-4 mr-2" /> Anchor
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Total Economic Yield: ${yield_.totalYield.toLocaleString()}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between mb-2">
              <span>Onboarding Time Saved</span>
              <Badge>{yield_.onboardingTimeSaved.toFixed(1)} hours</Badge>
            </div>
          </div>
          <div>
            <div className="flex justify-between mb-2">
              <span>Shortage Mitigation Score</span>
              <Badge>{(yield_.shortageMitigation * 100).toFixed(1)}%</Badge>
            </div>
            <Progress value={yield_.shortageMitigation * 100} />
          </div>
          <div>
            <div className="flex justify-between mb-2">
              <span>Shift Coverage Value</span>
              <Badge>${yield_.shiftCoverageValue.toLocaleString()}</Badge>
            </div>
          </div>
          <div>
            <div className="flex justify-between mb-2">
              <span>System-Level Attribution</span>
              <Badge>${yield_.systemLevelAttribution.toLocaleString()}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {yield_.forecast.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Yield Forecast</CardTitle>
          </CardHeader>
          <CardContent>
            {yield_.forecast.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center p-2 border rounded mb-2">
                <span>{item.period}</span>
                <Badge>${item.predictedYield.toLocaleString()}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

