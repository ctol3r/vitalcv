'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Anchor, Download, AlertTriangle } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

interface ComplianceImpactData {
  ruleImpact: Record<string, { timeImpact: number; costImpact: number; effortImpact: number }>;
  sensitivity: { employer: number; clinician: number };
  scenarios: Array<{ name: string; impact: number; probability: number }>;
  mitigation: Array<{ workflow: string; impactReduction: number }>;
  regionWideImpact: { workforceSupply: number; cost: number };
}

export default function ComplianceImpactPage() {
  const [impact, setImpact] = useState<ComplianceImpactData | null>(null);
  const [loading, setLoading] = useState(true);
  const [region] = useState('US');

  useEffect(() => {
    loadImpact();
  }, [region]);

  async function loadImpact() {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/compliance/impact/${region}`);
      if (res.ok) {
        const data = await res.json();
        setImpact(data);
      }
    } catch (error) {
      console.error('Failed to load compliance impact', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="container mx-auto p-6">Loading...</div>;
  if (!impact) return <div className="container mx-auto p-6">No data available</div>;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Compliance Impact Predictor</h1>
          <p className="text-muted-foreground">Predict operational impact of compliance changes</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => fetch(`${API_BASE}/api/compliance/impact/${region}/export`).then(r => r.json()).then(d => {
            const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `compliance-impact-${region}.json`;
            a.click();
          })} variant="outline">
            <Download className="w-4 h-4 mr-2" /> Export
          </Button>
          <Button onClick={() => fetch(`${API_BASE}/api/compliance/impact/${region}/anchor`, { method: 'POST' }).then(r => r.json()).then(d => alert(`Anchored: ${d.txHash}`))} variant="outline">
            <Anchor className="w-4 h-4 mr-2" /> Anchor
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Region-Wide Impact</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span>Workforce Supply Impact</span>
                <Badge>{(impact.regionWideImpact.workforceSupply * 100).toFixed(1)}%</Badge>
              </div>
              <Progress value={impact.regionWideImpact.workforceSupply * 100} />
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <span>Total Cost Impact</span>
                <Badge>${impact.regionWideImpact.cost.toLocaleString()}</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {impact.scenarios.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Regulatory Shock Scenarios</CardTitle>
          </CardHeader>
          <CardContent>
            {impact.scenarios.map((scenario, idx) => (
              <div key={idx} className="flex justify-between items-center p-2 border rounded mb-2">
                <span>{scenario.name}</span>
                <div className="flex gap-2">
                  <Badge>{(scenario.impact * 100).toFixed(0)}% impact</Badge>
                  <Badge variant="secondary">{(scenario.probability * 100).toFixed(0)}% prob</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

