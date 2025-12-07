/**
 * AcceptedOfferView Component
 * Phase 5: Post-acceptance view for clinician and recruiter
 */

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Calendar, Building2, FileText, Download, CheckCircle2 } from 'lucide-react';
import type { ClinicianAcceptedOfferView, RecruiterOfferView } from '@/lib/offers/types';

interface AcceptedOfferViewProps {
  view: ClinicianAcceptedOfferView | RecruiterOfferView;
  mode: 'clinician' | 'recruiter';
  onExportPDF?: () => void;
}

export function AcceptedOfferView({ view, mode, onExportPDF }: AcceptedOfferViewProps) {
  const offer = view.offer;

  if (mode === 'clinician') {
    const clinicianView = view as ClinicianAcceptedOfferView;
    return (
      <div className="space-y-6">
        <Card className="border-emerald-200 bg-emerald-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-900">
              <CheckCircle2 className="h-5 w-5" />
              Offer Accepted
            </CardTitle>
            <CardDescription className="text-emerald-700">
              Your acceptance has been recorded and anchored to the trust ledger.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Offer Details */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-start gap-3">
                <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Facility</p>
                  <p className="text-sm text-muted-foreground">{offer.facilityName}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Start Date</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(offer.startDate).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Acceptance Timestamp */}
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground mb-1">Accepted At</p>
              <p className="text-sm font-medium">
                {new Date(clinicianView.acceptanceTimestamp).toLocaleString()}
              </p>
            </div>

            {/* Trust Ledger Entry */}
            {clinicianView.trustLedgerEntry && (
              <div className="rounded-md border p-3">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  <p className="text-sm font-medium">Trust Ledger Entry</p>
                </div>
                <p className="text-xs text-muted-foreground mb-1">Entry ID</p>
                <p className="text-xs font-mono">{clinicianView.trustLedgerEntry.entryId}</p>
                <p className="text-xs text-muted-foreground mt-2 mb-1">Chain Hash</p>
                <p className="text-xs font-mono">{clinicianView.trustLedgerEntry.chainHash}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  {new Date(clinicianView.trustLedgerEntry.timestamp).toLocaleString()}
                </p>
              </div>
            )}

            {/* Next Steps */}
            {clinicianView.nextSteps && (
              <div className="space-y-3">
                <p className="text-sm font-medium">Next Steps</p>
                {clinicianView.nextSteps.credentialOnboardingPacket && (
                  <Button variant="outline" className="w-full">
                    <FileText className="h-4 w-4 mr-2" />
                    Download Credential Onboarding Packet
                  </Button>
                )}
                {clinicianView.nextSteps.facilityContact && (
                  <div className="rounded-md border p-3">
                    <p className="text-sm font-medium mb-2">Facility Contact</p>
                    <p className="text-sm">{clinicianView.nextSteps.facilityContact.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {clinicianView.nextSteps.facilityContact.email}
                    </p>
                    {clinicianView.nextSteps.facilityContact.phone && (
                      <p className="text-xs text-muted-foreground">
                        {clinicianView.nextSteps.facilityContact.phone}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Export PDF */}
            {onExportPDF && (
              <Button variant="outline" onClick={onExportPDF} className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Export Offer Summary (PDF)
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Recruiter view
  const recruiterView = view as RecruiterOfferView;
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            Candidate Accepted Offer
          </CardTitle>
          <CardDescription>
            {offer.roleTitle} at {offer.facilityName}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Candidate Info */}
          <div className="rounded-md border p-3">
            <p className="text-sm font-medium mb-2">Candidate</p>
            <p className="text-sm text-muted-foreground">
              {offer.clinicianId || 'Clinician ID'}
            </p>
            {offer.clinicianDid && (
              <p className="text-xs text-muted-foreground font-mono mt-1">
                {offer.clinicianDid}
              </p>
            )}
          </div>

          {/* Trust Score at Acceptance */}
          {recruiterView.clinicianTrustScore !== undefined && (
            <div className="rounded-md border p-3">
              <p className="text-sm font-medium mb-2">Trust Score at Acceptance</p>
              <div className="flex items-center gap-2">
                <Badge variant="default">
                  {(recruiterView.clinicianTrustScore * 100).toFixed(0)}%
                </Badge>
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
              </div>
            </div>
          )}

          {/* Credential Readiness Snapshot */}
          {recruiterView.credentialReadinessSnapshot &&
            recruiterView.credentialReadinessSnapshot.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Credential Readiness Snapshot</p>
                <div className="space-y-2">
                  {recruiterView.credentialReadinessSnapshot.map((check, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between rounded-md border p-2"
                    >
                      <span className="text-sm">{check.requirement.name}</span>
                      <Badge
                        variant={
                          check.status === 'ready'
                            ? 'default'
                            : check.status === 'expiring'
                            ? 'secondary'
                            : 'destructive'
                        }
                      >
                        {check.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* Tracking Events */}
          {recruiterView.tracking && recruiterView.tracking.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Timeline</p>
              <div className="space-y-2">
                {recruiterView.tracking.map((event, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <Badge variant="outline">{event.event}</Badge>
                    <span className="text-muted-foreground">
                      {new Date(event.timestamp).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1">
              View Candidate Profile
            </Button>
            {onExportPDF && (
              <Button variant="outline" onClick={onExportPDF}>
                <Download className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

