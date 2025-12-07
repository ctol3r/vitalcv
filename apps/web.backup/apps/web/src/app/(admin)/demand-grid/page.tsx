'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, MapPin, AlertCircle } from 'lucide-react';
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

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  'http://localhost:4000';

export default function DemandGridPage() {
  const [region, setRegion] = useState('West');
  const [grid, setGrid] = useState<any>(null);
  const [pressure, setPressure] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadGrid() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/demand-grid/${region}`);
      if (res.ok) {
        const data = await res.json();
        setGrid(data);
      }
    } catch (error) {
      console.error('Failed to load grid:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadPressure() {
    try {
      const res = await fetch(`${API_BASE}/api/demand-grid/${region}/pressure`);
      if (res.ok) {
        const data = await res.json();
        setPressure(data.score);
      }
    } catch (error) {
      console.error('Failed to load pressure:', error);
    }
  }

  useEffect(() => {
    loadGrid();
    loadPressure();
  }, [region]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="space-y-2">
        <Badge variant="secondary">Admin · Demand Grid</Badge>
        <div>
          <h1 className="text-3xl font-semibold leading-tight">Clinician Demand Projection Grid</h1>
          <p className="text-muted-foreground">
            Predict future demand by specialty, location, privileges, & emergent care needs
          </p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Demand Grid</CardTitle>
          <CardDescription>Select region to view demand projections</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="flex-1 rounded-md border px-3 py-2"
            >
              <option value="West">West</option>
              <option value="East">East</option>
              <option value="Central">Central</option>
              <option value="South">South</option>
            </select>
            <Button onClick={loadGrid} disabled={loading}>
              <TrendingUp className="h-4 w-4 mr-2" />
              Load
            </Button>
          </div>
          {pressure !== null && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Demand Pressure Score</span>
                <span className="text-sm">{pressure}%</span>
              </div>
              <Progress value={pressure} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

