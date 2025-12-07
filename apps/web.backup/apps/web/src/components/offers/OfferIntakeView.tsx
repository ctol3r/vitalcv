/**
 * OfferIntakeView Component
 * Phase 3: Clinician offer preview with match score, trust indicators, and credential readiness
 */

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ShieldCheck,
  Clock,
  DollarSign,
  Calendar,
  Building2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import { useOfferIntake } from '@/lib/offers/useOfferIntake';
import type { OfferPreviewData } from '@/lib/offers/types';

interface OfferIntakeViewProps {
  offerId: string;
  onAccept?: () => void;
  onDecline?: () => void;
}

export function OfferIntakeView({ offerId, onAccept, onDecline }: OfferIntakeViewProps) {
  const { offer, previewData, isLoading, error } = useOfferIntake(offerId);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <p>Loading offer...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !offer || !previewData) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <Alert variant="destructive">
              <AlertDescription>{error || 'Failed to load offer'}</AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatSalary = () => {
    const { min, max, currency, period } = offer.salary;
    const periodLabel =
      period === 'hourly'
        ? 'hr'
        : period === 'daily'
        ? 'day'
        : period === 'weekly'
        ? 'wk'
        : period === 'monthly'
        ? 'mo'
        : 'yr';
    return `${currency} ${min.toLocaleString()} - ${max.toLocaleString()} / ${periodLabel}`;
  };

  const formatExpiration = () => {
    if (!offer.expiresAt) return 'No expiration';
    const expires = new Date(offer.expiresAt);
    const now = new Date();
    const hoursLeft = Math.floor((expires.getTime() - now.getTime()) / (1000 * 60 * 60));
    if (hoursLeft < 0) return 'Expired';
    if (hoursLeft < 24) return `Expires in ${hoursLeft} hours`;
    const daysLeft = Math.floor(hoursLeft / 24);
    return `Expires in ${daysLeft} days`;
  };

  return (
    <div className="space-y-6">
      {/* Match Score & Trust Score */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Offer Match Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium mb-2">Match Score</p>
              <div className="flex items-center gap-2">
                <Progress value={previewData.matchScore * 100} className="flex-1" />
                <span className="text-sm font-semibold">
                  {(previewData.matchScore * 100).toFixed(0)}%
                </span>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Trust Score</p>
              <div className="flex items-center gap-2">
                <Progress value={previewData.trustScore * 100} className="flex-1" />
                <span className="text-sm font-semibold">
                  {(previewData.trustScore * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Offer Details */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{offer.roleTitle}</CardTitle>
              <CardDescription>{offer.facilityName}</CardDescription>
            </div>
            <Badge variant="default">New Offer</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Trust Indicators */}
          <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            <ShieldCheck className="h-4 w-4" />
            <span>
              Facility Trust Score: {(previewData.trustScore * 100).toFixed(0)}% • Verified
              Organization
            </span>
          </div>

          {/* Recruiter Identity Card */}
          {offer.recruiterName && (
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground mb-1">Recruiter</p>
              <p className="text-sm font-medium">
                {offer.recruiterName} • {offer.recruiterOrgName || 'Organization'}
              </p>
              <p className="text-xs text-muted-foreground font-mono mt-1">
                {offer.recruiterDid}
              </p>
            </div>
          )}

          {/* Key Details */}
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

            <div className="flex items-start gap-3">
              <DollarSign className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Compensation</p>
                <p className="text-sm text-muted-foreground">{formatSalary()}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Expiration</p>
                <p className="text-sm text-muted-foreground">{formatExpiration()}</p>
              </div>
            </div>
          </div>

          {/* Notes */}
          {offer.notes && (
            <div>
              <p className="text-sm font-medium mb-2">Additional Notes</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{offer.notes}</p>
            </div>
          )}

          {/* Credential Readiness Checklist */}
          {previewData.credentialReadiness && previewData.credentialReadiness.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-3">Your Credential Readiness</p>
              <div className="space-y-2">
                {previewData.credentialReadiness.map((check, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <div className="flex items-center gap-2">
                      {check.status === 'ready' ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      ) : check.status === 'expiring' ? (
                        <AlertTriangle className="h-5 w-5 text-amber-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600" />
                      )}
                      <div>
                        <p className="text-sm font-medium">{check.requirement.name}</p>
                        {check.requirement.jurisdiction && (
                          <p className="text-xs text-muted-foreground">
                            {check.requirement.jurisdiction}
                          </p>
                        )}
                      </div>
                    </div>
                    <Badge
                      variant={
                        check.status === 'ready'
                          ? 'default'
                          : check.status === 'expiring'
                          ? 'secondary'
                          : 'destructive'
                      }
                    >
                      {check.status === 'ready'
                        ? 'Ready'
                        : check.status === 'expiring'
                        ? 'Expiring'
                        : 'Missing'}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Compliance Warnings */}
          {previewData.complianceWarnings && previewData.complianceWarnings.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Compliance Warnings</p>
              <div className="space-y-2">
                {previewData.complianceWarnings.map((warning, index) => (
                  <Alert key={index} variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{warning}</AlertDescription>
                  </Alert>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onDecline} className="flex-1">
              Decline
            </Button>
            <Button onClick={onAccept} className="flex-1">
              Review Offer Details
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

