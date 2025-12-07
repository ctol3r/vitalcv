'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Shield, AlertCircle, CheckCircle2, XCircle, HelpCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export default function ComplianceSummaryPage() {
  const searchParams = useSearchParams();
  const clinicianId = searchParams.get('clinicianId') || 'self';
  const [state, setState] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCompliance();
  }, [clinicianId]);

  const fetchCompliance = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/compliance/${clinicianId}`);
      if (res.ok) {
        const data = await res.json();
        setState(data.state);
      }
    } catch (error) {
      console.error('Failed to fetch compliance state', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExplain = async (rule: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/compliance/explain/${rule}`);
      if (res.ok) {
        const data = await res.json();
        alert(data.explanation);
      }
    } catch (error) {
      console.error('Failed to get explanation', error);
    }
  };

  const handleAnchor = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/compliance/${clinicianId}/anchor`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        alert(`Compliance state anchored! TX Hash: ${data.txHash}`);
        fetchCompliance();
      }
    } catch (error) {
      console.error('Failed to anchor compliance', error);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const ncqa = state?.ncqa || {};
  const jointCommission = state?.jointCommission || {};
  const dea = state?.dea || {};
  const licenseBoard = state?.licenseBoard || {};
  const conflicts = state?.conflicts || [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Compliance Summary</h1>
          <p className="text-muted-foreground mt-2">
            AI-driven compliance interpreters (NCQA, JC, DEA, FSMB)
          </p>
        </div>
        <Button onClick={handleAnchor}>Anchor Snapshot</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              NCQA Compliance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <span>CR1: Credentialing Verification</span>
              {ncqa.cr1 ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
            </div>
            <div className="flex items-center justify-between">
              <span>CR2: Recredentialing Cycle</span>
              {ncqa.cr2 ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
            </div>
            <div className="flex items-center justify-between">
              <span>CR3: Ongoing Monitoring</span>
              {ncqa.cr3 ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
            </div>
            {ncqa.issues && ncqa.issues.length > 0 && (
              <div className="mt-4 space-y-1">
                <div className="text-sm font-medium text-red-600">Issues:</div>
                {ncqa.issues.map((issue: string, idx: number) => (
                  <div key={idx} className="text-sm text-muted-foreground">
                    • {issue}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Joint Commission</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {jointCommission.privileges &&
              Object.entries(jointCommission.privileges).map(([key, value]: [string, any]) => (
                <div key={key} className="flex items-center justify-between">
                  <span>Privilege: {key}</span>
                  {value ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                </div>
              ))}
            {jointCommission.issues && jointCommission.issues.length > 0 && (
              <div className="mt-4 space-y-1">
                <div className="text-sm font-medium text-red-600">Issues:</div>
                {jointCommission.issues.map((issue: string, idx: number) => (
                  <div key={idx} className="text-sm text-muted-foreground">
                    • {issue}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>DEA/MATE Compliance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <span>MATE Training Complete</span>
              {dea.trainingComplete ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
            </div>
            <div className="flex items-center justify-between">
              <span>Renewal Pattern</span>
              <Badge
                variant={
                  dea.renewalPattern === 'on-time'
                    ? 'default'
                    : dea.renewalPattern === 'late'
                      ? 'destructive'
                      : 'secondary'
                }
              >
                {dea.renewalPattern || 'Unknown'}
              </Badge>
            </div>
            {dea.issues && dea.issues.length > 0 && (
              <div className="mt-4 space-y-1">
                <div className="text-sm font-medium text-red-600">Issues:</div>
                {dea.issues.map((issue: string, idx: number) => (
                  <div key={idx} className="text-sm text-muted-foreground">
                    • {issue}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>License Board Compliance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {licenseBoard.stateRules &&
              Object.entries(licenseBoard.stateRules).map(([state, rule]: [string, any]) => (
                <div key={state} className="flex items-center justify-between">
                  <span>{state}</span>
                  {rule.compliant ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-600" />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleExplain(`State ${state} Board Rules`)}
                      >
                        <HelpCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
          </CardContent>
        </Card>
      </div>

      {conflicts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              Compliance Conflicts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {conflicts.map((conflict: any, idx: number) => (
                <div key={idx} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{conflict.type}</div>
                    <Badge
                      variant={
                        conflict.severity === 'high'
                          ? 'destructive'
                          : conflict.severity === 'medium'
                            ? 'default'
                            : 'secondary'
                      }
                    >
                      {conflict.severity}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {conflict.description}
                  </div>
                  <div className="flex gap-2 mt-2">
                    {conflict.affectedRules.map((rule: string) => (
                      <Badge key={rule} variant="outline">
                        {rule}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

