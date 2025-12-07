'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle, Circle, ArrowRight, User } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function OnboardingHubPage() {
  const [loading, setLoading] = useState(true);
  const [flow, setFlow] = useState<any>(null);
  const [prediction, setPrediction] = useState<any>(null);
  const [userId] = useState('demo-user-1');
  const [role] = useState('clinician');

  useEffect(() => {
    loadOnboardingData();
  }, [userId, role]);

  async function loadOnboardingData() {
    try {
      setLoading(true);

      const [flowRes, predictionRes] = await Promise.all([
        fetch(`${API_BASE}/api/onboarding-orchestrator/${userId}/${role}/flow`),
        fetch(`${API_BASE}/api/onboarding-orchestrator/${userId}/${role}/predict`),
      ]);

      const flowData = await flowRes.json();
      const predictionData = await predictionRes.json();

      if (flowData.success) {
        setFlow(flowData.flow);
      }
      if (predictionData.success) {
        setPrediction(predictionData.prediction);
      }
    } catch (error) {
      console.error('Failed to load onboarding data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Onboarding Hub</h1>
        <p className="text-muted-foreground mt-2">
          One orchestrator that guides clinicians, issuers, verifiers, recruiters, and employers
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Onboarding Progress
            </CardTitle>
            <CardDescription>Role: {role}</CardDescription>
          </CardHeader>
          <CardContent>
            {flow && (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Progress</span>
                    <span className="text-sm text-muted-foreground">{flow.progress?.toFixed(0) || 0}%</span>
                  </div>
                  <Progress value={flow.progress || 0} />
                </div>
                <div className="space-y-2">
                  {flow.steps?.map((step: string, i: number) => (
                    <div key={i} className="flex items-center gap-2">
                      {i < (flow.currentStep || 0) ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : i === (flow.currentStep || 0) ? (
                        <Circle className="h-4 w-4 text-blue-500 fill-blue-500" />
                      ) : (
                        <Circle className="h-4 w-4 text-gray-300" />
                      )}
                      <span className={i <= (flow.currentStep || 0) ? 'font-medium' : 'text-muted-foreground'}>
                        {step}
                      </span>
                    </div>
                  ))}
                </div>
                <Button className="w-full">
                  {flow.nextAction} <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Success Prediction</CardTitle>
            <CardDescription>Probability of completion</CardDescription>
          </CardHeader>
          <CardContent>
            {prediction && (
              <div className="space-y-4">
                <div>
                  <div className="text-3xl font-bold">
                    {(prediction.probability * 100).toFixed(0)}%
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">Completion probability</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Key Factors:</p>
                  {prediction.factors?.map((factor: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span>{factor.factor}</span>
                      <span className="text-muted-foreground">{(factor.impact * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4">
                  <p className="text-sm font-medium mb-2">Recommendations:</p>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    {prediction.recommendations?.map((rec: string, i: number) => (
                      <li key={i}>• {rec}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

