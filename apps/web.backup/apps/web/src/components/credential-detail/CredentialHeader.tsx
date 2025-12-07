/**
 * CredentialHeader Component
 * Displays credential icon, type, issuer, dates, and trust indicators
 */

'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Shield, ShieldCheck, ShieldAlert, Calendar, Building2 } from 'lucide-react';
import type { Credential } from '@/lib/repositories/credential-repository';
import type { TrustScore } from '@/lib/services/trust-service';
import { TrustRing } from './TrustRing';
import { TrustScoreCapsule } from './TrustScoreCapsule';
import { IssuerChip } from './IssuerChip';

interface CredentialHeaderProps {
  credential: Credential;
  trustScore: TrustScore;
  className?: string;
}

export function CredentialHeader({ credential, trustScore, className }: CredentialHeaderProps) {
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getStatusIcon = () => {
    switch (credential.status) {
      case 'valid':
        return <ShieldCheck className="h-5 w-5 text-emerald-600" />;
      case 'expiring':
        return <ShieldAlert className="h-5 w-5 text-amber-600" />;
      case 'expired':
      case 'revoked':
        return <ShieldAlert className="h-5 w-5 text-red-600" />;
      default:
        return <Shield className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusColor = () => {
    switch (credential.status) {
      case 'valid':
        return 'border-emerald-200 bg-emerald-50';
      case 'expiring':
        return 'border-amber-200 bg-amber-50';
      case 'expired':
      case 'revoked':
        return 'border-red-200 bg-red-50';
      default:
        return 'border-muted bg-muted/50';
    }
  };

  return (
    <Card className={cn('relative overflow-hidden', className)}>
      {/* Trust Ring Background Animation */}
      <TrustRing trustScore={trustScore.overall} className="absolute inset-0 pointer-events-none" />

      <CardContent className="p-6 relative z-10">
        <div className="flex items-start justify-between gap-4">
          {/* Left: Icon and Main Info */}
          <div className="flex items-start gap-4 flex-1">
            {/* Credential Icon with Trust Ring */}
            <div className="relative">
              <div
                className={cn(
                  'w-16 h-16 rounded-xl flex items-center justify-center border-2',
                  getStatusColor(),
                )}
              >
                {credential.metadata?.icon ? (
                  <img
                    src={credential.metadata.icon}
                    alt={credential.type}
                    className="w-12 h-12 object-contain"
                  />
                ) : (
                  getStatusIcon()
                )}
              </div>
            </div>

            {/* Main Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <h1 className="text-2xl font-semibold">{credential.type}</h1>
                <TrustScoreCapsule trustScore={trustScore} />
                <Badge
                  variant={
                    credential.status === 'valid'
                      ? 'default'
                      : credential.status === 'expiring'
                      ? 'secondary'
                      : 'destructive'
                  }
                  className="flex items-center gap-1"
                >
                  {getStatusIcon()}
                  <span className="capitalize">{credential.status}</span>
                </Badge>
              </div>

              {/* Issuer Chip */}
              <IssuerChip issuer={credential.issuer} className="mb-3" />

              {/* Dates */}
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  <span>
                    Issued: <span className="font-medium text-foreground">{formatDate(credential.issuedAt)}</span>
                  </span>
                </div>
                {credential.expiresAt && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    <span>
                      Expires:{' '}
                      <span
                        className={cn(
                          'font-medium',
                          credential.status === 'expiring' && 'text-amber-600',
                          credential.status === 'expired' && 'text-red-600',
                          credential.status === 'valid' && 'text-foreground',
                        )}
                      >
                        {formatDate(credential.expiresAt)}
                      </span>
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

