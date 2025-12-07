'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Clock, XCircle, Settings, Shield, Users, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

interface OnboardingStep {
  id: string;
  name: string;
  status: string;
  required: boolean;
  estimatedMinutes: number;
}

interface EmployerOnboardingData {
  orgId: string;
  steps: OnboardingStep[];
  status: string;
  progress: number;
}

export default function EmployerOnboardingPage() {
  const [onboarding, setOnboarding] = useState<EmployerOnboardingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [atsType, setAtsType] = useState<'greenhouse' | 'lever' | 'workday' | ''>('');
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    fetchOnboarding();
  }, []);

  const fetchOnboarding = async () => {
    try {
      const orgId = 'self'; // Would get from auth context
      const res = await fetch(`${API_BASE}/api/onboarding/employer/${orgId}`);
      if (res.ok) {
        const data = await res.json();
        setOnboarding(data);
      }
    } catch (error) {
      console.error('Failed to fetch onboarding', error);
    } finally {
      setLoading(false);
    }
  };

  const handleATSConnect = async () => {
    if (!atsType) return;
    try {
      const orgId = 'self';
      const res = await fetch(`${API_BASE}/api/onboarding/employer/${orgId}/ats-connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ atsType, apiKey }),
      });
      if (res.ok) {
        await fetchOnboarding();
      }
    } catch (error) {
      console.error('Failed to connect ATS', error);
    }
  };

  const handleAutoVerify = async () => {
    try {
      const orgId = 'self';
      const res = await fetch(`${API_BASE}/api/onboarding/employer/${orgId}/auto-verify`, {
        method: 'POST',
      });
      if (res.ok) {
        await fetchOnboarding();
      }
    } catch (error) {
      console.error('Failed to setup auto-verify', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'in_progress':
        return <Clock className="h-5 w-5 text-blue-600" />;
      case 'pending':
        return <XCircle className="h-5 w-5 text-gray-400" />;
      default:
        return <XCircle className="h-5 w-5 text-gray-400" />;
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Employer Onboarding</h1>
        <p className="text-muted-foreground mt-2">Zero-friction setup for instant clinician verification</p>
      </div>

      {onboarding && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Onboarding Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">{onboarding.progress.toFixed(0)}%</span>
                  <Badge variant={onboarding.status === 'complete' ? 'default' : 'secondary'}>
                    {onboarding.status}
                  </Badge>
                </div>
                <Progress value={onboarding.progress} />
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Zap className="h-4 w-4" />
                  Quick Connect ATS
                </CardTitle>
                <CardDescription>One-click setup for Greenhouse, Lever, or Workday</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>ATS Type</Label>
                  <select
                    value={atsType}
                    onChange={(e) => setAtsType(e.target.value as any)}
                    className="w-full p-2 border rounded-md mt-1"
                  >
                    <option value="">Select ATS...</option>
                    <option value="greenhouse">Greenhouse</option>
                    <option value="lever">Lever</option>
                    <option value="workday">Workday</option>
                  </select>
                </div>
                <div>
                  <Label>API Key (Optional)</Label>
                  <Input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter API key"
                    className="mt-1"
                  />
                </div>
                <Button onClick={handleATSConnect} disabled={!atsType} className="w-full">
                  Connect ATS
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Shield className="h-4 w-4" />
                  Auto-Verify Integration
                </CardTitle>
                <CardDescription>Automatically verify all incoming applicants via OIDC</CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={handleAutoVerify} className="w-full" variant="outline">
                  Setup Auto-Verify
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Onboarding Steps</CardTitle>
              <CardDescription>Complete these steps to finish onboarding</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {onboarding.steps.map((step) => (
                  <div key={step.id} className="flex items-start gap-4 p-4 border rounded-lg">
                    <div className="mt-1">{getStatusIcon(step.status)}</div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold">{step.name}</h3>
                        <div className="flex items-center gap-2">
                          {step.required && <Badge variant="outline">Required</Badge>}
                          <Badge variant={step.status === 'complete' ? 'default' : 'secondary'}>
                            {step.status}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Estimated: {step.estimatedMinutes} minutes
                      </p>
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

