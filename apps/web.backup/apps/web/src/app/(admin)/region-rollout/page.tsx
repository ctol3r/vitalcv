'use client';

import { useEffect, useState } from 'react';
import { Globe, RefreshCcw, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  'http://localhost:4000';

interface RegionAnalysis {
  expansionReadiness: number;
  factors: {
    regulatoryComplexity: number;
    workforceDensity: number;
    partnerAvailability: number;
  };
  recommendations: string[];
}

export default function RegionRolloutPage() {
  const [selectedRegion, setSelectedRegion] = useState('us-west-2');
  const [analysis, setAnalysis] = useState<RegionAnalysis | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedRegion) {
      loadAnalysis(selectedRegion);
    }
  }, [selectedRegion]);

  async function loadAnalysis(region: string) {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/market-expansion/region/${region}/analyze`);
      if (response.ok) {
        const data = await response.json();
        setAnalysis(data);
      }
    } catch (error) {
      console.error('Failed to load analysis:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="space-y-2">
        <Badge variant="secondary">Admin · Market Expansion</Badge>
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <h1 className="text-3xl font-semibold leading-tight">Regional Rollout Console</h1>
            <p className="text-muted-foreground">
              Scale VitalCV into national networks, international markets, and multi-system deployments
            </p>
          </div>
          <Button
            variant="outline"
            className="ml-auto gap-2"
            onClick={() => loadAnalysis(selectedRegion)}
            disabled={loading}
          >
            <RefreshCcw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Select Region</CardTitle>
        </CardHeader>
        <CardContent>
          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            className="w-full rounded-md border px-3 py-2"
          >
            <option value="us-west-2">US West Region</option>
            <option value="us-east-1">US East Region</option>
            <option value="eu-central-1">EU Central Region</option>
            <option value="au-southeast-1">Australia Southeast</option>
            <option value="gb-south-1">UK South</option>
          </select>
        </CardContent>
      </Card>

      {analysis && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Expansion Readiness
              </CardTitle>
              <CardDescription>Overall readiness score for region launch</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-semibold">{analysis.expansionReadiness}%</span>
                  <Badge variant={analysis.expansionReadiness > 70 ? 'default' : 'secondary'}>
                    {analysis.expansionReadiness > 70 ? 'Ready' : 'Needs Work'}
                  </Badge>
                </div>
                <Progress value={analysis.expansionReadiness} />
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Regulatory Complexity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">
                  {(analysis.factors.regulatoryComplexity * 100).toFixed(0)}%
                </div>
                <p className="text-sm text-muted-foreground">
                  {analysis.factors.regulatoryComplexity < 0.5 ? 'Low' : 'High'} complexity
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Workforce Density</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">
                  {analysis.factors.workforceDensity.toFixed(1)}
                </div>
                <p className="text-sm text-muted-foreground">Clinicians per sq. mile</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Partner Availability</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">
                  {(analysis.factors.partnerAvailability * 100).toFixed(0)}%
                </div>
                <p className="text-sm text-muted-foreground">Partner network coverage</p>
              </CardContent>
            </Card>
          </div>

          {analysis.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {analysis.recommendations.map((rec, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-emerald-600">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

