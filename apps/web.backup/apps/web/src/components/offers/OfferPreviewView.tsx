/**
 * OfferPreviewView Component
 * Phase 1 & 3: Offer preview with recruiter signature & timestamp
 * Shows offer details before sending
 */

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Clock, DollarSign, Calendar, Building2, FileText } from 'lucide-react';
import type { Offer } from '@/lib/offers/types';

interface OfferPreviewViewProps {
  offer: Offer;
  onSend?: () => void;
  onEdit?: () => void;
  mode?: 'recruiter' | 'clinician';
}

export function OfferPreviewView({
  offer,
  onSend,
  onEdit,
  mode = 'recruiter',
}: OfferPreviewViewProps) {
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
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Offer Preview
              </CardTitle>
              <CardDescription>
                Review offer details before sending
              </CardDescription>
            </div>
            <Badge variant={offer.status === 'draft' ? 'secondary' : 'default'}>
              {offer.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Trust Indicators */}
          {offer.signature && (
            <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              <ShieldCheck className="h-4 w-4" />
              <span>
                Digitally signed by {offer.recruiterName || 'Recruiter'} on{' '}
                {new Date(offer.signature.timestamp).toLocaleString()}
              </span>
            </div>
          )}

          {/* Role Information */}
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">{offer.roleTitle}</h3>
              <p className="text-sm text-muted-foreground">Role ID: {offer.roleId}</p>
            </div>

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
          </div>

          {/* Notes */}
          {offer.notes && (
            <div>
              <p className="text-sm font-medium mb-2">Additional Notes</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{offer.notes}</p>
            </div>
          )}

          {/* Credential Requirements */}
          {offer.credentialRequirements && offer.credentialRequirements.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-3">Credential Requirements</p>
              <div className="space-y-2">
                {offer.credentialRequirements.map((req, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 rounded-md border p-2"
                  >
                    <Badge variant="secondary">{req.type}</Badge>
                    <span className="text-sm">{req.name}</span>
                    {req.jurisdiction && (
                      <span className="text-xs text-muted-foreground">
                        ({req.jurisdiction})
                      </span>
                    )}
                    {req.required && (
                      <Badge variant="destructive" className="ml-auto">
                        Required
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recruiter Info */}
          {mode === 'recruiter' && (
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground mb-1">Recruiter Identity</p>
              <p className="text-sm font-medium">
                {offer.recruiterName || 'Recruiter'} • {offer.recruiterOrgName || 'Organization'}
              </p>
              <p className="text-xs text-muted-foreground font-mono mt-1">
                {offer.recruiterDid}
              </p>
            </div>
          )}

          {/* Actions */}
          {mode === 'recruiter' && (
            <div className="flex gap-2">
              {onEdit && (
                <Button variant="outline" onClick={onEdit}>
                  Edit Offer
                </Button>
              )}
              {onSend && (
                <Button onClick={onSend} className="flex-1">
                  Send Offer
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

