/**
 * TrustExplainerSheet Component
 * Explains why a credential is trusted
 */

'use client';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Shield, ShieldCheck, Link as LinkIcon, FileText, Clock } from 'lucide-react';
import type { TrustScore } from '@/lib/services/trust-service';
import type { Credential } from '@/lib/repositories/credential-repository';

interface TrustExplainerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trustScore: TrustScore;
  credential: Credential;
}

export function TrustExplainerSheet({
  open,
  onOpenChange,
  trustScore,
  credential,
}: TrustExplainerSheetProps) {
  const breakdownItems = [
    {
      label: 'Issuer Reputation',
      value: trustScore.breakdown.issuer,
      icon: Shield,
      description: 'Trust level of the credential issuer',
    },
    {
      label: 'Blockchain Anchor',
      value: trustScore.breakdown.anchor,
      icon: LinkIcon,
      description: 'Verification on the VitalCV Trust Ledger',
    },
    {
      label: 'Evidence Completeness',
      value: trustScore.breakdown.evidence,
      icon: FileText,
      description: 'Quality and completeness of supporting evidence',
    },
    {
      label: 'Data Freshness',
      value: trustScore.breakdown.freshness,
      icon: Clock,
      description: 'Recency of the credential data',
    },
    {
      label: 'Third-Party Verification',
      value: trustScore.breakdown.verification,
      icon: ShieldCheck,
      description: 'External verification and validation',
    },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Why This Credential is Trusted
          </SheetTitle>
          <SheetDescription>
            Detailed breakdown of trust factors and verification status
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Overall Trust Score */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Overall Trust Score</span>
              <Badge
                variant={trustScore.tier === 'high' ? 'default' : 'secondary'}
                className={
                  trustScore.tier === 'high'
                    ? 'bg-emerald-100 text-emerald-700'
                    : trustScore.tier === 'medium'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-red-100 text-red-700'
                }
              >
                {(trustScore.overall * 100).toFixed(0)}%
              </Badge>
            </div>
            <Progress value={trustScore.overall * 100} className="h-2" />
            <p className="text-sm text-muted-foreground">
              {trustScore.tier === 'high'
                ? 'High trust - This credential has strong verification and evidence'
                : trustScore.tier === 'medium'
                ? 'Medium trust - This credential has moderate verification'
                : 'Low trust - This credential needs additional verification'}
            </p>
          </div>

          {/* Trust Breakdown */}
          <div className="space-y-4">
            <h3 className="font-semibold">Trust Breakdown</h3>
            {breakdownItems.map((item) => (
              <div key={item.label} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <item.icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{item.label}</span>
                  </div>
                  <span className="text-sm font-semibold">
                    {(item.value * 100).toFixed(0)}%
                  </span>
                </div>
                <Progress value={item.value * 100} className="h-1.5" />
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>

          {/* Trust Reasons */}
          {trustScore.reasons.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold">Key Trust Factors</h3>
              <ul className="space-y-2">
                {trustScore.reasons.map((reason, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <span className="text-emerald-600 mt-0.5">✓</span>
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Issuer Information */}
          <div className="space-y-2 pt-4 border-t">
            <h3 className="font-semibold">Issuer Information</h3>
            <div className="space-y-1 text-sm">
              <div>
                <span className="text-muted-foreground">Issuer:</span>{' '}
                <span className="font-medium">{credential.issuer.name}</span>
              </div>
              {credential.issuer.trustTier && (
                <div>
                  <span className="text-muted-foreground">Trust Tier:</span>{' '}
                  <Badge variant="outline" className="ml-2">
                    {credential.issuer.trustTier}
                  </Badge>
                </div>
              )}
              {credential.issuer.trustBadge && (
                <div>
                  <span className="text-muted-foreground">Badge:</span>{' '}
                  <Badge variant="secondary" className="ml-2">
                    {credential.issuer.trustBadge}
                  </Badge>
                </div>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

