'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Clock, XCircle, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

interface PathwayStep {
  id: string;
  type: string;
  title: string;
  description: string;
  status: string;
  estimatedDays: number;
}

interface PathwayPlan {
  clinicianId: string;
  targetRole: string;
  steps: PathwayStep[];
  totalEstimatedDays: number;
  readinessScore: number;
}

export default function PathwayPage() {
  const [targetRole, setTargetRole] = useState('attending_physician');
  const [plan, setPlan] = useState<PathwayPlan | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (targetRole) {
      fetchPathway();
    }
  }, [targetRole]);

  const fetchPathway = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/pathway/self/${targetRole}`);
      if (res.ok) {
        const data = await res.json();
        setPlan(data);
      }
    } catch (error) {
      console.error('Failed to fetch pathway', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!plan) return;
    try {
      const res = await fetch(`${API_BASE}/api/pathway/self/${targetRole}/export`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pathway-${targetRole}-${Date.now()}.json`;
        a.click();
      }
    } catch (error) {
      console.error('Failed to export', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'in_progress':
        return <Clock className="h-5 w-5 text-blue-600" />;
      case 'missing':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <FileText className="h-5 w-5 text-gray-600" />;
    }
  };

  if (loading && !plan) {
    return (
      <div className="container mx-auto p-6">
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Credential Pathway Generator</h1>
          <p className="text-muted-foreground mt-2">Automated roadmap to job readiness</p>
        </div>
        {plan && (
          <Button onClick={handleExport} variant="outline">
            <FileText className="mr-2 h-4 w-4" />
            Export Report
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Target Role</CardTitle>
          <CardDescription>Select the role you want to become ready for</CardDescription>
        </CardHeader>
        <CardContent>
          <select
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value)}
            className="w-full p-2 border rounded-md"
          >
            <option value="attending_physician">Attending Physician</option>
            <option value="chief_medical_officer">Chief Medical Officer</option>
            <option value="specialist">Specialist</option>
            <option value="surgeon">Surgeon</option>
          </select>
        </CardContent>
      </Card>

      {plan && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Readiness Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(plan.readinessScore * 100).toFixed(1)}%</div>
                <Progress value={plan.readinessScore * 100} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Estimated Days</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{plan.totalEstimatedDays}</div>
                <p className="text-sm text-muted-foreground">To complete all steps</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Steps Remaining</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {plan.steps.filter((s) => s.status !== 'complete').length}
                </div>
                <p className="text-sm text-muted-foreground">Out of {plan.steps.length} total</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Pathway Steps</CardTitle>
              <CardDescription>Steps required to become ready for {plan.targetRole}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {plan.steps.map((step, idx) => (
                  <div key={step.id} className="flex items-start gap-4 p-4 border rounded-lg">
                    <div className="mt-1">{getStatusIcon(step.status)}</div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold">{step.title}</h3>
                        <Badge variant={step.status === 'complete' ? 'default' : 'secondary'}>
                          {step.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{step.description}</p>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-xs text-muted-foreground">
                          Estimated: {step.estimatedDays} days
                        </span>
                        <Badge variant="outline">{step.type}</Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

