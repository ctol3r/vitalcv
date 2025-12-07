import React, { Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle2, AlertTriangle, UserCheck, Briefcase } from 'lucide-react';

// Mock data fetcher (in real app, use fetch/axios)
async function getRecommendations(orgId: string) {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Call the actual API if we were in a connected environment
  // const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/hiring/recommend/${orgId}`);
  // return res.json();

  // Return mock data matching the backend shape
  return {
    recommendations: [
      {
        clinician: {
          id: 'c1',
          name: 'Dr. Sarah Chen',
          email: 'sarah.chen@example.com',
          roles: ['clinician'],
        },
        score: 0.92,
        rationale: {
          trustScore: 0.95,
          reputationScore: 0.88,
          credentialValid: true,
          multiStateEligible: true,
          workforceShortageLevel: 'high',
          notes: [
            'High trust score indicates verified history.',
            'Strong reputation in the network.',
            'Credentials are valid and verified.',
            'Eligible for IMLC compact in 12 states.',
            'High demand in this specialty.'
          ]
        },
        readinessFlags: []
      },
      {
        clinician: {
          id: 'c2',
          name: 'Dr. Michael Ross',
          email: 'm.ross@example.com',
          roles: ['clinician'],
        },
        score: 0.85,
        rationale: {
          trustScore: 0.82,
          reputationScore: 0.90,
          credentialValid: true,
          multiStateEligible: false,
          workforceShortageLevel: 'medium',
          notes: [
            'Strong reputation in the network.',
            'Credentials are valid and verified.'
          ]
        },
        readinessFlags: []
      },
      {
        clinician: {
          id: 'c3',
          name: 'Nurse Jackie',
          email: 'jackie@example.com',
          roles: ['clinician'],
        },
        score: 0.78,
        rationale: {
          trustScore: 0.88,
          reputationScore: 0.70,
          credentialValid: true,
          multiStateEligible: true,
          workforceShortageLevel: 'low',
          notes: [
             'Credentials are valid and verified.',
             'Eligible for NLC compact.'
          ]
        },
        readinessFlags: ['Pending Reference Check']
      }
    ]
  };
}

export default async function RecommendationsPage() {
  const orgId = "demo-org"; // Context or auth session
  const data = await getRecommendations(orgId);
  const { recommendations } = data;

  const surgeAlert = recommendations.some(r => r.rationale.workforceShortageLevel === 'high');

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Hiring Recommendations</h1>
          <p className="text-muted-foreground">
            AI-powered candidate ranking based on trust, credentials, and workforce demand.
          </p>
        </div>
        <div className="flex gap-2">
            <Button variant="outline">Export List</Button>
            <Button>Auto-Match</Button>
        </div>
      </div>

      {surgeAlert && (
        <Alert variant="destructive" className="bg-amber-50 border-amber-200 text-amber-900">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800">Hiring Surge Detected</AlertTitle>
          <AlertDescription className="text-amber-700">
            High demand specialty detected. Top candidates have been prioritized.
            An on-chain audit event has been anchored for this surge.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6">
        {recommendations.map((rec: any) => (
          <Card key={rec.clinician.id} className="overflow-hidden">
            <div className="flex flex-col md:flex-row">
                {/* Score Panel */}
                <div className="bg-slate-50 p-6 flex flex-col items-center justify-center min-w-[200px] border-r border-slate-100">
                    <div className="relative h-24 w-24 flex items-center justify-center rounded-full border-4 border-primary/20">
                        <span className="text-3xl font-bold text-primary">
                            {Math.round(rec.score * 100)}
                        </span>
                    </div>
                    <span className="mt-2 text-sm font-medium text-slate-500">Match Score</span>
                </div>

                {/* Details Panel */}
                <CardContent className="flex-1 p-6">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h3 className="text-xl font-semibold flex items-center gap-2">
                                {rec.clinician.name}
                                {rec.rationale.credentialValid && (
                                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                                )}
                            </h3>
                            <p className="text-sm text-muted-foreground">{rec.clinician.email}</p>
                        </div>
                        <div className="flex gap-2">
                            <Button size="sm" variant="outline">View Profile</Button>
                            <Button size="sm">Invite</Button>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                            <h4 className="text-sm font-medium uppercase tracking-wider text-slate-500">Key Factors</h4>
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span>Trust Score</span>
                                    <span className="font-medium">{Math.round(rec.rationale.trustScore * 100)}%</span>
                                </div>
                                <Progress value={rec.rationale.trustScore * 100} className="h-1" />

                                <div className="flex justify-between text-sm mt-2">
                                    <span>Reputation</span>
                                    <span className="font-medium">{Math.round(rec.rationale.reputationScore * 100)}%</span>
                                </div>
                                <Progress value={rec.rationale.reputationScore * 100} className="h-1" />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <h4 className="text-sm font-medium uppercase tracking-wider text-slate-500">Analysis</h4>
                            <ul className="text-sm space-y-1 text-slate-600 list-disc pl-4">
                                {rec.rationale.notes.map((note: string, i: number) => (
                                    <li key={i}>{note}</li>
                                ))}
                            </ul>
                            <div className="flex flex-wrap gap-2 mt-3">
                                {rec.rationale.multiStateEligible && (
                                    <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100">
                                        Multi-State Eligible
                                    </Badge>
                                )}
                                {rec.rationale.workforceShortageLevel === 'high' && (
                                    <Badge variant="secondary" className="bg-orange-50 text-orange-700 hover:bg-orange-100">
                                        High Demand
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
