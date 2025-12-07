'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Globe, Clock, DollarSign, CheckCircle, XCircle, ArrowRight } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

interface MigrationTimeline {
  steps: Array<{
    step: number;
    action: string;
    estimatedDays: number;
    dependencies: number[];
    status: 'pending' | 'in_progress' | 'completed';
  }>;
  totalEstimatedDays: number;
  successRate: number;
  costs: Array<{ item: string; amount: number }>;
}

interface Feasibility {
  feasibilityScore: number;
  pathways: Array<{
    id: string;
    pathwayType: string;
    estimatedDuration: number;
    successRate: number;
  }>;
  blockers: string[];
  recommendations: string[];
  estimatedTime: number;
  estimatedCost: number;
}

export default function MigrationPathwayExplorerPage() {
  const [clinicianId, setClinicianId] = useState('');
  const [originJurisdiction, setOriginJurisdiction] = useState('GB-ENG');
  const [targetJurisdiction, setTargetJurisdiction] = useState('US-CA');
  const [feasibility, setFeasibility] = useState<Feasibility | null>(null);
  const [timeline, setTimeline] = useState<MigrationTimeline | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSimulate = async () => {
    if (!clinicianId || !originJurisdiction || !targetJurisdiction) {
      return;
    }

    setLoading(true);
    try {
      // Get feasibility
      const feasRes = await fetch(`${API_BASE}/api/reciprocity/feasibility`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicianId,
          originJurisdiction,
          targetJurisdiction,
        }),
      });
      const feasData = await feasRes.json();
      setFeasibility(feasData);

      // Get timeline
      const timelineRes = await fetch(`${API_BASE}/api/reciprocity/timeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicianId,
          originJurisdiction,
          targetJurisdiction,
        }),
      });
      const timelineData = await timelineRes.json();
      setTimeline(timelineData);
    } catch (error) {
      console.error('Error simulating migration:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Migration Pathway Explorer</h1>
        <p className="text-muted-foreground">
          Simulate licensing pathways and predict migration feasibility
        </p>
      </div>

      {/* Input Form */}
      <Card>
        <CardHeader>
          <CardTitle>Migration Simulation</CardTitle>
          <CardDescription>Enter clinician and jurisdiction details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="clinicianId">Clinician ID</Label>
            <Input
              id="clinicianId"
              value={clinicianId}
              onChange={(e) => setClinicianId(e.target.value)}
              placeholder="clinician-123"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="origin">Origin Jurisdiction</Label>
              <Input
                id="origin"
                value={originJurisdiction}
                onChange={(e) => setOriginJurisdiction(e.target.value)}
                placeholder="GB-ENG"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="target">Target Jurisdiction</Label>
              <Input
                id="target"
                value={targetJurisdiction}
                onChange={(e) => setTargetJurisdiction(e.target.value)}
                placeholder="US-CA"
              />
            </div>
          </div>
          <Button onClick={handleSimulate} disabled={loading || !clinicianId}>
            {loading ? 'Simulating...' : 'Simulate Migration'}
          </Button>
        </CardContent>
      </Card>

      {/* Feasibility Results */}
      {feasibility && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Migration Feasibility
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Feasibility Score</span>
                <span className="text-2xl font-bold">{feasibility.feasibilityScore}/100</span>
              </div>
              <Progress value={feasibility.feasibilityScore} className="h-2" />
            </div>

            {feasibility.blockers.length > 0 && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-semibold mb-2">Blockers:</div>
                  <ul className="list-disc list-inside space-y-1">
                    {feasibility.blockers.map((blocker, idx) => (
                      <li key={idx}>{blocker}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {feasibility.recommendations.length > 0 && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-semibold mb-2">Recommendations:</div>
                  <ul className="list-disc list-inside space-y-1">
                    {feasibility.recommendations.map((rec, idx) => (
                      <li key={idx}>{rec}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-sm text-muted-foreground">Estimated Time</div>
                  <div className="font-semibold">{feasibility.estimatedTime} days</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-sm text-muted-foreground">Estimated Cost</div>
                  <div className="font-semibold">${feasibility.estimatedCost.toLocaleString()}</div>
                </div>
              </div>
            </div>

            {feasibility.pathways.length > 0 && (
              <div>
                <div className="font-semibold mb-2">Available Pathways:</div>
                <div className="space-y-2">
                  {feasibility.pathways.map((pathway) => (
                    <div key={pathway.id} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium capitalize">{pathway.pathwayType}</div>
                          <div className="text-sm text-muted-foreground">
                            {pathway.estimatedDuration} days • {Math.round(pathway.successRate * 100)}% success
                          </div>
                        </div>
                        <Badge>{pathway.id}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      {timeline && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Migration Timeline
            </CardTitle>
            <CardDescription>
              Total: {timeline.totalEstimatedDays} days • Success Rate: {Math.round(timeline.successRate * 100)}%
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {timeline.steps.map((step) => (
                <div key={step.step} className="flex items-start gap-4 p-4 border rounded-lg">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                    {step.step}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{step.action}</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {step.estimatedDays} days
                      {step.dependencies.length > 0 && (
                        <span> • Depends on step {step.dependencies.join(', ')}</span>
                      )}
                    </div>
                  </div>
                  <Badge variant={step.status === 'completed' ? 'default' : 'secondary'}>
                    {step.status}
                  </Badge>
                </div>
              ))}
            </div>

            {timeline.costs.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <div className="font-semibold mb-2">Estimated Costs:</div>
                <div className="space-y-1">
                  {timeline.costs.map((cost, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-sm">{cost.item}</span>
                      <span className="font-semibold">${cost.amount.toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-2 border-t font-semibold">
                    <span>Total</span>
                    <span>${timeline.costs.reduce((sum, c) => sum + c.amount, 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

