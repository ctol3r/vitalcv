'use client';

/**
 * NPI Public Card - Displays public NPI information
 */

import ClaimStatusBadge from '@/components/status/ClaimStatusBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatNpi } from '@/lib/npi-client';
import { NpiRecord } from '@/lib/npi-types';
import { cn } from '@/lib/utils';
import { Building2, Info, MapPin, Phone, User } from 'lucide-react';
import Link from 'next/link';

interface NpiPublicCardProps {
  record: NpiRecord;
  showClaimButton?: boolean;
  className?: string;
}

export function NpiPublicCard({ record, showClaimButton = true, className }: NpiPublicCardProps) {
  const primaryAddress =
    record.addresses.find((a) => a.addressType === 'LOCATION') || record.addresses[0];
  const TypeIcon = record.type === 2 ? Building2 : User;

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="space-y-3">
        {/* Warning banner for public records */}
        <div
          className="flex items-start gap-2 rounded-md bg-amber-50 p-3 text-sm dark:bg-amber-950/20"
          role="status"
          aria-live="polite"
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-500" />
          <p className="text-amber-900 dark:text-amber-200">
            <strong>Public NPI record</strong> — not verified as your account.
          </p>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <TypeIcon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              <CardTitle className="text-xl">
                {record.isOrganization
                  ? record.organizationName
                  : `${record.firstName} ${record.lastName}`}
              </CardTitle>
            </div>
            <CardDescription className="text-base">NPI: {formatNpi(record.npi)}</CardDescription>
            <div className="pt-1">
              <ClaimStatusBadge npi={record.npi} />
            </div>
          </div>

          <Badge variant="outline" className="shrink-0">
            Type {record.type}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Taxonomy */}
        <div className="space-y-1">
          <p className="text-sm font-medium">Specialty</p>
          <p className="text-sm text-muted-foreground">{record.taxonomyDescription}</p>
          <p className="text-xs text-muted-foreground">Code: {record.taxonomyCode}</p>
        </div>

        {/* Primary Address */}
        {primaryAddress && (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm font-medium">
                {primaryAddress.addressType === 'LOCATION' ? 'Location' : 'Mailing'} Address
              </p>
            </div>
            <address className="text-sm not-italic text-muted-foreground">
              {primaryAddress.address1}
              {primaryAddress.address2 && <>, {primaryAddress.address2}</>}
              <br />
              {primaryAddress.city}, {primaryAddress.state} {primaryAddress.postalCode}
            </address>
            {primaryAddress.telephoneNumber && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                <a href={`tel:${primaryAddress.telephoneNumber}`} className="hover:underline">
                  {primaryAddress.telephoneNumber}
                </a>
              </div>
            )}
          </div>
        )}

        {/* Last Updated */}
        {record.lastUpdated && (
          <p className="text-xs text-muted-foreground">
            Last updated: {new Date(record.lastUpdated).toLocaleDateString()}
          </p>
        )}

        {/* Claim CTA */}
        {showClaimButton && (
          <div className="pt-2">
            <Link href={`/claim/${record.npi}`}>
              <Button className="w-full" size="lg">
                Claim this NPI (verify identity)
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
