'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_BASE_URL || '';

interface CompetencyAxis {
  id: string;
  name: string;
  category: string;
  value: number;
  confidence: number;
  evidence: string[];
  lastUpdated: string;
}

interface CompetencyTensor {
  axes: CompetencyAxis[];
  metadata: {
    version: string;
    synthesizedAt: string;
    signalSources: string[];
    integrityScore: number;
  };
}

export default function CompetencyTensorPage() {
  const [tensor, setTensor] = useState<CompetencyTensor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // In production, would fetch from API with clinicianId
    const fetchTensor = async () => {
      try {
        // Mock data for demonstration
        const mockTensor: CompetencyTensor = {
          axes: [
            { id: 'clinical-001', name: 'Patient Assessment', category: 'Clinical', value: 0.85, confidence: 0.9, evidence: ['procedureLogs'], lastUpdated: new Date().toISOString() },
            { id: 'clinical-002', name: 'Diagnostic Accuracy', category: 'Clinical', value: 0.75, confidence: 0.8, evidence: ['procedureLogs'], lastUpdated: new Date().toISOString() },
            { id: 'clinical-003', name: 'Treatment Planning', category: 'Clinical', value: 0.8, confidence: 0.85, evidence: ['privilegeApprovals'], lastUpdated: new Date().toISOString() },
            { id: 'clinical-004', name: 'Procedure Execution', category: 'Clinical', value: 0.9, confidence: 0.95, evidence: ['procedureLogs'], lastUpdated: new Date().toISOString() },
            { id: 'clinical-005', name: 'Clinical Decision Making', category: 'Clinical', value: 0.75, confidence: 0.8, evidence: ['ehrVolume'], lastUpdated: new Date().toISOString() },
            { id: 'clinical-006', name: 'Patient Safety', category: 'Clinical', value: 0.85, confidence: 0.9, evidence: ['procedureLogs'], lastUpdated: new Date().toISOString() },
            { id: 'technical-001', name: 'EHR Proficiency', category: 'Technical', value: 0.9, confidence: 0.95, evidence: ['ehrVolume'], lastUpdated: new Date().toISOString() },
            { id: 'technical-002', name: 'Medical Technology', category: 'Technical', value: 0.7, confidence: 0.75, evidence: ['procedureLogs'], lastUpdated: new Date().toISOString() },
            { id: 'technical-003', name: 'Data Analysis', category: 'Technical', value: 0.65, confidence: 0.7, evidence: ['ehrVolume'], lastUpdated: new Date().toISOString() },
            { id: 'regulatory-001', name: 'License Compliance', category: 'Regulatory', value: 1.0, confidence: 1.0, evidence: ['boardCertHistory'], lastUpdated: new Date().toISOString() },
            { id: 'regulatory-002', name: 'Board Certification', category: 'Regulatory', value: 0.9, confidence: 0.95, evidence: ['boardCertHistory'], lastUpdated: new Date().toISOString() },
            { id: 'regulatory-003', name: 'CME Compliance', category: 'Regulatory', value: 0.85, confidence: 0.9, evidence: ['cmeTraining'], lastUpdated: new Date().toISOString() },
            { id: 'behavioral-001', name: 'Communication', category: 'Behavioral', value: 0.7, confidence: 0.75, evidence: ['ehrVolume'], lastUpdated: new Date().toISOString() },
            { id: 'behavioral-002', name: 'Team Collaboration', category: 'Behavioral', value: 0.75, confidence: 0.8, evidence: ['privilegeApprovals'], lastUpdated: new Date().toISOString() },
            { id: 'specialty-001', name: 'Specialty Expertise', category: 'Specialty', value: 0.9, confidence: 0.95, evidence: ['specialtyData'], lastUpdated: new Date().toISOString() },
          ],
          metadata: {
            version: 'v10',
            synthesizedAt: new Date().toISOString(),
            signalSources: ['procedureLogs', 'privilegeApprovals', 'specialtyData', 'cmeTraining', 'ehrVolume', 'boardCertHistory'],
            integrityScore: 0.85,
          },
        };
        setTensor(mockTensor);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load competency tensor');
      } finally {
        setLoading(false);
      }
    };

    fetchTensor();
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

  if (!tensor) {
    return null;
  }

  // Prepare data for radar chart (group by category)
  const categoryData: Record<string, { name: string; value: number }[]> = {};
  tensor.axes.forEach((axis) => {
    if (!categoryData[axis.category]) {
      categoryData[axis.category] = [];
    }
    categoryData[axis.category].push({
      name: axis.name,
      value: axis.value * 100, // Convert to percentage
    });
  });

  // Create radar chart data
  const radarData = tensor.axes.map((axis) => ({
    axis: axis.name,
    value: axis.value * 100,
    fullMark: 100,
  }));

  const avgValue = tensor.axes.reduce((sum, a) => sum + a.value, 0) / tensor.axes.length;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Competency Tensor Network</h1>
        <p className="text-muted-foreground mt-2">
          Global 30-axis competency network capturing skills, experience, training, privileges, readiness, safety & evolution
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Integrity Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(tensor.metadata.integrityScore * 100)}%</div>
            <Progress value={tensor.metadata.integrityScore * 100} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Average Competency</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(avgValue * 100)}%</div>
            <Progress value={avgValue * 100} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Signal Sources</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tensor.metadata.signalSources.length}</div>
            <div className="flex flex-wrap gap-1 mt-2">
              {tensor.metadata.signalSources.map((source) => (
                <Badge key={source} variant="secondary" className="text-xs">
                  {source}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Competency Radar Chart</CardTitle>
          <CardDescription>30-axis competency visualization</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={500}>
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="axis" tick={{ fontSize: 10 }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} />
              <Radar
                name="Competency"
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

      <Card>
        <CardHeader>
          <CardTitle>Competency Axes by Category</CardTitle>
          <CardDescription>Detailed breakdown of all 30 axes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(categoryData).map(([category, axes]) => (
              <div key={category}>
                <h3 className="font-semibold mb-2">{category}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {axes.map((axis) => {
                    const fullAxis = tensor.axes.find((a) => a.name === axis.name);
                    return (
                      <div key={axis.name} className="p-3 border rounded-lg">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-medium">{axis.name}</span>
                          <Badge variant="outline">{Math.round(axis.value)}%</Badge>
                        </div>
                        <Progress value={axis.value} className="h-2" />
                        {fullAxis && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            Confidence: {Math.round(fullAxis.confidence * 100)}%
                          </div>
                        )}
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








