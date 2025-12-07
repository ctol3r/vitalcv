/**
 * Payer Enrollment View
 * Phase 5: Payer Enrollment Sync
 * Task 33: Create PayerEnrollmentView
 */

'use client';

import { Building2, CheckCircle2, Clock, XCircle, Download, FileText, Shield } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import type { RegulatoryBundle, PayerEnrollment } from '@/lib/regulatory/models';

interface PayerEnrollmentViewProps {
  clinicianId: string | null;
  bundle: RegulatoryBundle | null;
}

export function PayerEnrollmentView({ clinicianId, bundle }: PayerEnrollmentViewProps) {
  if (!bundle) {
    return null;
  }

  const payers = bundle.payers;

  const getStatusIcon = (status: PayerEnrollment['enrollmentStatus']) => {
    switch (status) {
      case 'active':
        return <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />;
      case 'declined':
      case 'terminated':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: PayerEnrollment['enrollmentStatus']) => {
    const variants = {
      active: 'default',
      pending: 'secondary',
      declined: 'destructive',
      terminated: 'destructive',
    } as const;

    return <Badge variant={variants[status] || 'secondary'}>{status.toUpperCase()}</Badge>;
  };

  const getRiskBadge = (risk: PayerEnrollment['riskLevel']) => {
    const variants = {
      low: 'default',
      medium: 'secondary',
      high: 'destructive',
    } as const;

    return <Badge variant={variants[risk] || 'secondary'}>{risk.toUpperCase()} RISK</Badge>;
  };

  // Group payers by state - Task 34
  const payersByState = payers.reduce((acc, payer) => {
    if (!acc[payer.state]) {
      acc[payer.state] = [];
    }
    acc[payer.state].push(payer);
    return acc;
  }, {} as Record<string, PayerEnrollment[]>);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Payer Enrollments
          </CardTitle>
          <CardDescription>
            Commercial and Medicaid payer enrollment status by state
          </CardDescription>
        </CardHeader>
        <CardContent>
          {payers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No payer enrollments found.
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(payersByState).map(([state, statePayers]) => (
                <div key={state}>
                  <h3 className="text-lg font-semibold mb-3">{state}</h3>
                  <div className="space-y-4">
                    {(statePayers as PayerEnrollment[]).map((payer) => (
                      <Card key={payer.id} className="border-l-4 border-l-primary">
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              {getStatusIcon(payer.enrollmentStatus)}
                              <div>
                                <CardTitle className="text-lg">{payer.payerName}</CardTitle>
                                <CardDescription className="mt-1">
                                  {payer.payerType.replace(/_/g, ' ').toUpperCase()}
                                </CardDescription>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              {getStatusBadge(payer.enrollmentStatus)}
                              {getRiskBadge(payer.riskLevel)}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {/* Enrollment Info */}
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div>
                              <p className="text-sm text-muted-foreground">Enrollment Status</p>
                              <p className="font-medium">{payer.enrollmentStatus}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Enrollment Date</p>
                              <p className="font-medium">
                                {payer.enrollmentDate
                                  ? new Date(payer.enrollmentDate).toLocaleDateString()
                                  : 'N/A'}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Compliance Score</p>
                              <div className="flex items-center gap-2">
                                <p className="font-semibold">{Math.round(payer.complianceScore * 100)}%</p>
                                <Progress value={payer.complianceScore * 100} className="flex-1 h-2" />
                              </div>
                            </div>
                          </div>

                          {/* Required Documents - Task 36 */}
                          {payer.requiredDocuments.length > 0 && (
                            <div>
                              <p className="font-semibold mb-2">Required Documents</p>
                              <div className="space-y-1">
                                {payer.requiredDocuments.map((doc, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded"
                                  >
                                    <span>{doc.description}</span>
                                    {doc.provided ? (
                                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                                    ) : (
                                      <XCircle className="h-4 w-4 text-destructive" />
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Missing Documents */}
                          {payer.missingDocuments.length > 0 && (
                            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                              <p className="font-semibold text-destructive mb-2">Missing Documents</p>
                              <ul className="list-disc list-inside text-sm space-y-1">
                                {payer.missingDocuments.map((doc, idx) => (
                                  <li key={idx}>{doc}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Actions */}
                          <div className="flex gap-2 pt-2">
                            {payer.enrollmentStatus === 'pending' && (
                              <Button
                                variant="outline"
                                onClick={async () => {
                                  // Task 37: Application packet auto-build
                                  const response = await fetch(
                                    `/api/regulatory/payers/${payer.id}/application-packet?clinicianId=${clinicianId}`,
                                  );
                                  if (response.ok) {
                                    const data = await response.json();
                                    const blob = new Blob([JSON.stringify(data, null, 2)], {
                                      type: 'application/json',
                                    });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `payer-application-packet-${payer.payerName}-${payer.id}.json`;
                                    a.click();
                                    URL.revokeObjectURL(url);
                                  }
                                }}
                              >
                                <FileText className="h-4 w-4 mr-2" />
                                Build Application Packet
                              </Button>
                            )}
                            {payer.applicationPacketId && (
                              <Button
                                variant="outline"
                                onClick={async () => {
                                  // Task 38: Chain anchor summary for submitted packets
                                  const response = await fetch(
                                    `/api/regulatory/payers/${payer.id}/packet-summary?packetId=${payer.applicationPacketId}`,
                                  );
                                  if (response.ok) {
                                    const data = await response.json();
                                    const blob = new Blob([JSON.stringify(data, null, 2)], {
                                      type: 'application/json',
                                    });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `payer-packet-summary-${payer.payerName}-${payer.id}.json`;
                                    a.click();
                                    URL.revokeObjectURL(url);
                                  }
                                }}
                              >
                                <Download className="h-4 w-4 mr-2" />
                                Download Packet Summary
                              </Button>
                            )}
                            {payer.chainAnchor && (
                              <Badge variant="outline" className="ml-auto">
                                <Shield className="h-3 w-3 mr-1" />
                                Chain Anchored
                              </Badge>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}








