'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_BASE_URL || '';

interface OrbitDimension {
  id: string;
  name: string;
  category: string;
  value: number; // -1 to 1
  confidence: number;
  evidence: string[];
  lastUpdated: string;
}

interface RiskOrbit {
  dimensions: OrbitDimension[];
  metadata: {
    version: string;
    fusedAt: string;
    signalSources: string[];
    stabilityScore: number;
  };
}

export default function RiskOrbitPage() {
  const [orbit, setOrbit] = useState<RiskOrbit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // In production, would fetch from API with orgId
    const fetchOrbit = async () => {
      try {
        // Mock data for demonstration
        const mockOrbit: RiskOrbit = {
          dimensions: [
            { id: 'fairness-001', name: 'Hiring Fairness', category: 'Fairness', value: 0.7, confidence: 0.8, evidence: ['hiringInconsistency'], lastUpdated: new Date().toISOString() },
            { id: 'fairness-002', name: 'Compensation Equity', category: 'Fairness', value: 0.6, confidence: 0.75, evidence: ['compensationInstability'], lastUpdated: new Date().toISOString() },
            { id: 'safety-001', name: 'Clinical Safety', category: 'Safety', value: 0.85, confidence: 0.9, evidence: ['safetyEventCorrelation'], lastUpdated: new Date().toISOString() },
            { id: 'safety-002', name: 'Workplace Safety', category: 'Safety', value: 0.8, confidence: 0.85, evidence: ['safetyEventCorrelation'], lastUpdated: new Date().toISOString() },
            { id: 'compliance-001', name: 'Regulatory Compliance', category: 'Compliance', value: 0.9, confidence: 0.95, evidence: ['verificationAccuracy'], lastUpdated: new Date().toISOString() },
            { id: 'compliance-002', name: 'Verification Discipline', category: 'Compliance', value: 0.85, confidence: 0.9, evidence: ['verificationAccuracy'], lastUpdated: new Date().toISOString() },
            { id: 'stability-001', name: 'Operational Stability', category: 'Stability', value: 0.75, confidence: 0.8, evidence: ['hiringInconsistency', 'compensationInstability'], lastUpdated: new Date().toISOString() },
            { id: 'stability-002', name: 'Staffing Stability', category: 'Stability', value: 0.7, confidence: 0.75, evidence: ['burnoutPropagation'], lastUpdated: new Date().toISOString() },
            { id: 'experience-001', name: 'Candidate Experience', category: 'Experience', value: 0.65, confidence: 0.7, evidence: ['hiringInconsistency', 'atsAnomalies'], lastUpdated: new Date().toISOString() },
            { id: 'trust-001', name: 'Trust Coherence', category: 'Trust', value: 0.8, confidence: 0.85, evidence: ['verificationAccuracy'], lastUpdated: new Date().toISOString() },
            { id: 'trust-002', name: 'Transparency', category: 'Trust', value: 0.7, confidence: 0.75, evidence: ['hiringInconsistency'], lastUpdated: new Date().toISOString() },
            { id: 'volatility-001', name: 'Staffing Volatility', category: 'Volatility', value: -0.2, confidence: 0.8, evidence: ['burnoutPropagation'], lastUpdated: new Date().toISOString() },
            { id: 'performance-001', name: 'Performance Correlation', category: 'Performance', value: 0.85, confidence: 0.9, evidence: ['safetyEventCorrelation'], lastUpdated: new Date().toISOString() },
            { id: 'ethics-001', name: 'Ethical Conduct', category: 'Ethics', value: 0.8, confidence: 0.85, evidence: ['hiringInconsistency', 'verificationAccuracy'], lastUpdated: new Date().toISOString() },
            { id: 'operations-001', name: 'Operational Excellence', category: 'Operations', value: 0.75, confidence: 0.8, evidence: ['verificationAccuracy', 'atsAnomalies'], lastUpdated: new Date().toISOString() },
          ],
          metadata: {
            version: 'v9',
            fusedAt: new Date().toISOString(),
            signalSources: ['burnoutPropagation', 'hiringInconsistency', 'privilegeMisalignment', 'verificationAccuracy', 'atsAnomalies', 'compensationInstability', 'safetyEventCorrelation'],
            stabilityScore: 0.75,
          },
        };
        setOrbit(mockOrbit);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load risk orbit');
      } finally {
        setLoading(false);
      }
    };

    fetchOrbit();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!orbit) {
    return null;
  }

  // Prepare data for radar chart
  const radarData = orbit.dimensions.map((dim) => ({
    dimension: dim.name,
    value: (dim.value + 1) * 50, // Convert -1 to 1 range to 0-100
    fullMark: 100,
  }));

  const avgValue = orbit.dimensions.reduce((sum, d) => sum + d.value, 0) / orbit.dimensions.length;
  const negativeZones = orbit.dimensions.filter((d) => d.value < -0.3);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Workforce Risk-Orbit Engine</h1>
        <p className="text-muted-foreground mt-2">
          30-dimension risk orbit describing how an employer pulls or repels talent based on integrity, safety, performance, and fairness
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Stability Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(orbit.metadata.stabilityScore * 100)}%</div>
            <Progress value={orbit.metadata.stabilityScore * 100} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Average Orbit Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round((avgValue + 1) * 50)}%</div>
            <Progress value={(avgValue + 1) * 50} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {avgValue > 0 ? 'Attracts talent' : 'Repels talent'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Negative Gravity Zones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{negativeZones.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Dimensions repelling talent
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Risk-Orbit Radar Chart</CardTitle>
          <CardDescription>30-dimension risk orbit visualization (values from -1 to 1, displayed as 0-100%)</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={500}>
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 10 }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} />
              <Radar
                name="Risk Orbit"
                dataKey="value"
                stroke="#8884d8"
                fill="#8884d8"
                fillOpacity={0.6}
              />
              <Tooltip />
              <Legend />
            </RadarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {negativeZones.length > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-800">Negative Gravity Zones</CardTitle>
            <CardDescription className="text-red-600">
              These dimensions are repelling talent and require immediate attention
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {negativeZones.map((dim) => (
                <div key={dim.id} className="p-3 border border-red-200 rounded-lg bg-white">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{dim.name}</span>
                    <Badge variant="destructive">{dim.value.toFixed(2)}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Strong negative value indicates talent repulsion
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Orbit Dimensions by Category</CardTitle>
          <CardDescription>Detailed breakdown of all 30 dimensions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(
              orbit.dimensions.reduce((acc, dim) => {
                if (!acc[dim.category]) acc[dim.category] = [];
                acc[dim.category].push(dim);
                return acc;
              }, {} as Record<string, OrbitDimension[]>)
            ).map(([category, dimensions]) => (
              <div key={category}>
                <h3 className="font-semibold mb-2">{category}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {dimensions.map((dim) => {
                    const normalizedValue = (dim.value + 1) * 50; // Convert to 0-100
                    return (
                      <div
                        key={dim.id}
                        className={`p-3 border rounded-lg ${
                          dim.value < -0.3 ? 'border-red-200 bg-red-50' : dim.value > 0.7 ? 'border-green-200 bg-green-50' : ''
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-medium">{dim.name}</span>
                          <Badge variant={dim.value < 0 ? 'destructive' : 'default'}>
                            {dim.value.toFixed(2)}
                          </Badge>
                        </div>
                        <Progress value={normalizedValue} className="h-2" />
                        <div className="mt-2 text-xs text-muted-foreground">
                          Confidence: {Math.round(dim.confidence * 100)}%
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}








