/**
 * Batch Bundle #44 - Payer Contract Dashboard
 *
 * Show payer eligibility, missing requirements, reimbursement tiers,
 * analytics, and contract status at a glance.
 */

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, XCircle, AlertCircle, TrendingUp, Download } from 'lucide-react';

interface PayerContract {
  id: string;
  payerName: string;
  payerState: string;
  enrollmentStage: string;
  reimbursementTier?: string;
  requirementsMet: boolean;
  requirementCheckResults?: {
    allMet: boolean;
    checks: Array<{
      requirement: { type: string; description: string };
      met: boolean;
      reason?: string;
    }>;
    missingRequirements: any[];
    recommendation: 'approve' | 'deny' | 'conditional';
  };
  optimizationScore?: number;
}

export default function PayerContractsPage() {
  const [contracts, setContracts] = useState<PayerContract[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadContracts();
  }, []);

  async function loadContracts() {
    try {
      // In production, get clinicianId from session/context
      const clinicianId = 'current-clinician-id';
      const res = await fetch(`/api/payer-contracts/clinician/${clinicianId}`);
      const data = await res.json();
      setContracts(data.contracts || []);
    } catch (error) {
      console.error('Failed to load contracts', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckRequirements(contractId: string) {
    try {
      const res = await fetch(`/api/payer-contracts/${contractId}/check-requirements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicianId: 'current-clinician-id' }),
      });
      const result = await res.json();
      // Reload contracts to show updated results
      loadContracts();
    } catch (error) {
      console.error('Failed to check requirements', error);
    }
  }

  async function handleAutoPopulate(contractId: string) {
    try {
      const res = await fetch(`/api/payer-contracts/${contractId}/auto-populate`, {
        method: 'POST',
      });
      const packet = await res.json();
      // Download or show packet
      window.open(packet.pdf, '_blank');
    } catch (error) {
      console.error('Failed to auto-populate', error);
    }
  }

  if (loading) {
    return <div className="p-6">Loading payer contracts...</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Payer Contracts</h1>
          <p className="text-muted-foreground mt-2">
            Manage payer enrollment, requirements, and reimbursement optimization
          </p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="requirements">Requirements</TabsTrigger>
          <TabsTrigger value="optimization">Optimization</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {contracts.map((contract) => (
              <Card key={contract.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{contract.payerName}</CardTitle>
                    <Badge
                      variant={
                        contract.enrollmentStage === 'active'
                          ? 'default'
                          : contract.enrollmentStage === 'denied'
                          ? 'destructive'
                          : 'secondary'
                      }
                    >
                      {contract.enrollmentStage}
                    </Badge>
                  </div>
                  <CardDescription>{contract.payerState}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {contract.reimbursementTier && (
                    <div>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span>Reimbursement Tier</span>
                        <Badge variant="outline">{contract.reimbursementTier}</Badge>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Requirements Status</span>
                      {contract.requirementsMet ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                    {contract.optimizationScore !== undefined && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span>Optimization Score</span>
                          <span className="font-medium">{contract.optimizationScore.toFixed(0)}/100</span>
                        </div>
                        <Progress value={contract.optimizationScore} />
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCheckRequirements(contract.id)}
                    >
                      Check Requirements
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAutoPopulate(contract.id)}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Get Packet
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="requirements" className="space-y-4">
          {contracts.map((contract) => {
            const results = contract.requirementCheckResults;
            if (!results) return null;

            return (
              <Card key={contract.id}>
                <CardHeader>
                  <CardTitle>{contract.payerName} - Requirements</CardTitle>
                  <CardDescription>
                    Recommendation: <Badge>{results.recommendation}</Badge>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    {results.checks.map((check, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          {check.met ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-500" />
                          )}
                          <div>
                            <div className="font-medium">{check.requirement.description}</div>
                            <div className="text-sm text-muted-foreground">
                              {check.requirement.type}
                            </div>
                          </div>
                        </div>
                        {check.reason && (
                          <span className="text-sm text-muted-foreground">{check.reason}</span>
                        )}
                      </div>
                    ))}
                  </div>

                  {results.missingRequirements.length > 0 && (
                    <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="h-5 w-5 text-yellow-600" />
                        <span className="font-medium">Missing Requirements</span>
                      </div>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        {results.missingRequirements.map((req, idx) => (
                          <li key={idx}>{req.description || req.type}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="optimization" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Reimbursement Optimization</CardTitle>
              <CardDescription>
                Optimize your payer mix for maximum revenue potential
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => {
                // Trigger optimization calculation
                fetch('/api/payer-contracts/optimization/calculate', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ clinicianId: 'current-clinician-id' }),
                });
              }}>
                Calculate Optimization Score
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

