/**
 * CMS/PECOS View
 * Phase 4: CMS / PECOS / Medicare Enrollment
 * Task 25: Create CMSPECOSView
 */

'use client';

import { FileText, Building2, CheckCircle2, AlertTriangle, Download, Shield } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { RegulatoryBundle, CMSPECOSStatus } from '@/lib/regulatory/models';

interface CMSPECOSViewProps {
  clinicianId: string | null;
  bundle: RegulatoryBundle | null;
}

export function CMSPECOSView({ clinicianId, bundle }: CMSPECOSViewProps) {
  if (!bundle) {
    return null;
  }

  const cms = bundle.cms;

  if (!cms) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            CMS/PECOS Enrollment
          </CardTitle>
          <CardDescription>No CMS/PECOS enrollment found.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const getEnrollmentBadge = (status: CMSPECOSStatus['pecosEnrollmentStatus']) => {
    const variants = {
      enrolled: 'default',
      pending: 'secondary',
      inactive: 'destructive',
      terminated: 'destructive',
    } as const;

    return <Badge variant={variants[status] || 'secondary'}>{status.toUpperCase()}</Badge>;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                CMS/PECOS Enrollment
              </CardTitle>
              <CardDescription className="mt-1">
                Medicare provider enrollment and PECOS status
              </CardDescription>
            </div>
            {getEnrollmentBadge(cms.pecosEnrollmentStatus)}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* NPI and Basic Info - Task 26 */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">NPI</p>
              <p className="font-mono font-semibold">{cms.npi}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Provider Type</p>
              <p className="font-medium">{cms.providerType}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Enrollment Date</p>
              <p className="font-medium">
                {cms.pecosEnrollmentDate
                  ? new Date(cms.pecosEnrollmentDate).toLocaleDateString()
                  : 'N/A'}
              </p>
            </div>
          </div>

          {/* Revalidation Status - Task 29 */}
          {cms.revalidationDue && (
            <Card className="border-l-4 border-l-destructive">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <CardTitle className="text-base text-destructive">Revalidation Required</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm mb-3">
                  Your PECOS enrollment requires revalidation.
                  {cms.revalidationDueDate && (
                    <span>
                      {' '}
                      Due: {new Date(cms.revalidationDueDate).toLocaleDateString()}
                    </span>
                  )}
                </p>
                <Button variant="default" size="sm">
                  Begin Revalidation
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Compliance Badges - Task 30 */}
          <div>
            <p className="font-semibold mb-3">Compliance Status</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {cms.complianceBadges.map((badge) => (
                <Card key={badge.type} className="bg-muted/50">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{badge.type.replace(/_/g, ' ')}</p>
                        <p className="text-xs text-muted-foreground mt-1">{badge.description}</p>
                      </div>
                      {badge.status === 'verified' ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Last verified: {new Date(badge.lastVerified).toLocaleDateString()}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Medicare Reassignments - Task 27 */}
          {cms.reassignments.length > 0 && (
            <div>
              <p className="font-semibold mb-3">Medicare Reassignments (NPI → TIN)</p>
              <div className="space-y-2">
                {cms.reassignments.map((reassignment) => (
                  <Card key={reassignment.id} className="bg-muted/50">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{reassignment.tinName}</p>
                          <p className="text-sm text-muted-foreground">
                            TIN: {reassignment.tin}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Effective: {new Date(reassignment.effectiveDate).toLocaleDateString()}
                            {reassignment.terminationDate &&
                              ` - Terminated: ${new Date(reassignment.terminationDate).toLocaleDateString()}`}
                          </p>
                        </div>
                        <Badge
                          variant={reassignment.status === 'active' ? 'default' : 'secondary'}
                        >
                          {reassignment.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* CMS-855 Form Data - Task 28 */}
          {cms.cms855FormData && (
            <Card className="bg-muted/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  CMS-855 Form Data
                </CardTitle>
                <CardDescription>
                  Auto-populated from VitalCV profile data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Provider Name</p>
                    <p className="font-medium">{cms.cms855FormData.providerName}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">TIN</p>
                    <p className="font-medium">{cms.cms855FormData.tin}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Specialty</p>
                    <p className="font-medium">{cms.cms855FormData.specialty}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Practice Type</p>
                    <p className="font-medium">{cms.cms855FormData.practiceType}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Address</p>
                    <p className="font-medium">
                      {cms.cms855FormData.address.street}, {cms.cms855FormData.address.city},{' '}
                      {cms.cms855FormData.address.state} {cms.cms855FormData.address.zip}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="default"
              onClick={() => {
                window.open('https://pecos.cms.hhs.gov/pecos/login.do', '_blank');
              }}
            >
              Open PECOS Portal
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                // Task 31: Chain-backed PECOS attestation receipt
                const response = await fetch(
                  `/api/regulatory/cms/attestation-receipt?clinicianId=${clinicianId}`,
                );
                if (response.ok) {
                  const data = await response.json();
                  const blob = new Blob([JSON.stringify(data, null, 2)], {
                    type: 'application/json',
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `pecos-attestation-receipt-${cms.npi}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              Export Attestation Receipt
            </Button>
            {cms.chainAnchor && (
              <Badge variant="outline" className="ml-auto">
                <Shield className="h-3 w-3 mr-1" />
                Chain Anchored
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}








