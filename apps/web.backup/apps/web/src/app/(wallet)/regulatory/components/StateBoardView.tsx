/**
 * State Board View
 * Phase 2: State Board Integration
 * Task 9: Create StateBoardView
 */

'use client';

import { useState } from 'react';
import {
  Building2,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Upload,
  FileText,
  Shield,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { RegulatoryBundle, StateBoardLicense } from '@/lib/regulatory/models';

interface StateBoardViewProps {
  clinicianId: string | null;
  bundle: RegulatoryBundle | null;
}

export function StateBoardView({ clinicianId, bundle }: StateBoardViewProps) {
  const [selectedLicense, setSelectedLicense] = useState<StateBoardLicense | null>(null);

  if (!bundle) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const licenses = bundle.stateBoards;

  const getStatusBadge = (status: StateBoardLicense['status']) => {
    const variants = {
      active: 'default',
      expired: 'destructive',
      pending: 'secondary',
      suspended: 'destructive',
      revoked: 'destructive',
    } as const;

    return (
      <Badge variant={variants[status] || 'secondary'}>{status.toUpperCase()}</Badge>
    );
  };

  const getDaysUntilExpiration = (expirationDate: string) => {
    const exp = new Date(expirationDate);
    const now = new Date();
    const diff = Math.floor((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            State Board Licenses
          </CardTitle>
          <CardDescription>
            Manage your professional licenses by state. Track expiration, compact eligibility, and
            renewal requirements.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {licenses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No state board licenses found.
            </div>
          ) : (
            <div className="space-y-4">
              {licenses.map((license) => {
                const daysUntilExp = getDaysUntilExpiration(license.expirationDate);
                const isExpiringSoon = daysUntilExp <= 90 && daysUntilExp > 0;
                const isExpired = daysUntilExp < 0;

                return (
                  <Card key={license.id} className="border-l-4 border-l-primary">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{license.state}</CardTitle>
                          <CardDescription className="mt-1">
                            License #{license.licenseNumber}
                          </CardDescription>
                        </div>
                        {getStatusBadge(license.status)}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Status Info */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Status</p>
                          <p className="font-medium">{license.status}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Expiration</p>
                          <p className="font-medium">
                            {new Date(license.expirationDate).toLocaleDateString()}
                          </p>
                          {isExpiringSoon && (
                            <Badge variant="destructive" className="mt-1">
                              {daysUntilExp} days left
                            </Badge>
                          )}
                          {isExpired && (
                            <Badge variant="destructive" className="mt-1">
                              Expired
                            </Badge>
                          )}
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Compact</p>
                          <p className="font-medium">
                            {license.compactEligible ? (
                              <Badge variant="default" className="mt-1">
                                {license.compactStatus}
                              </Badge>
                            ) : (
                              'Not Eligible'
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Re-verification</p>
                          <p className="font-medium">{license.reVerificationCycle} days</p>
                        </div>
                      </div>

                      {/* Missing Documents */}
                      {license.missingDocuments.length > 0 && (
                        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="h-4 w-4 text-destructive" />
                            <p className="font-semibold text-destructive">Missing Documents</p>
                          </div>
                          <ul className="list-disc list-inside text-sm space-y-1">
                            {license.missingDocuments.map((doc, idx) => (
                              <li key={idx}>{doc}</li>
                            ))}
                          </ul>
                          <Button variant="outline" size="sm" className="mt-3">
                            <Upload className="h-4 w-4 mr-2" />
                            Upload Documents
                          </Button>
                        </div>
                      )}

                      {/* Sanctions */}
                      {license.sanctions.length > 0 && (
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Shield className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                            <p className="font-semibold">Sanctions</p>
                          </div>
                          <div className="space-y-2">
                            {license.sanctions.map((sanction) => (
                              <div key={sanction.id} className="text-sm">
                                <p className="font-medium">{sanction.type.toUpperCase()}</p>
                                <p className="text-muted-foreground">{sanction.description}</p>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(sanction.date).toLocaleDateString()}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="default"
                          onClick={() => {
                            // Task 11: Begin Renewal flow
                            window.open(
                              `https://www.fsmb.org/licensure/state-medical-boards/${license.stateCode.toLowerCase()}`,
                              '_blank',
                            );
                          }}
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Begin Renewal
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            // Task 15: State verification packet builder
                            fetch(`/api/regulatory/state-boards/${license.id}/verification-packet`)
                              .then((res) => res.json())
                              .then((data) => {
                                // Download packet
                                const blob = new Blob([JSON.stringify(data, null, 2)], {
                                  type: 'application/json',
                                });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `state-verification-packet-${license.state}-${license.id}.json`;
                                a.click();
                                URL.revokeObjectURL(url);
                              });
                          }}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          Export Verification Packet
                        </Button>
                        {license.chainAnchor && (
                          <Badge variant="outline" className="ml-auto">
                            <Shield className="h-3 w-3 mr-1" />
                            Chain Anchored
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}








