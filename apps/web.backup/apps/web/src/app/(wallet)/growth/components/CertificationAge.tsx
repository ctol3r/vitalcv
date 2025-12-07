/**
 * Task 14: Certification Age with Predicted Re-certification Needs
 */

'use client';

import { Award, Calendar, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { Credential } from '@/lib/growth/models';

interface CertificationAgeProps {
  credentials: Credential[];
}

export function CertificationAge({ credentials }: CertificationAgeProps) {
  const certifications = credentials.filter(
    (c) => c.type === 'certification' || c.type === 'board_cert',
  );

  const getAge = (issuedAt: string) => {
    const issued = new Date(issuedAt);
    const now = new Date();
    const years = (now.getTime() - issued.getTime()) / (1000 * 60 * 60 * 24 * 365);
    return Math.floor(years);
  };

  const getRecertificationStatus = (cred: Credential) => {
    const age = getAge(cred.issuedAt);
    const expiresAt = cred.expiresAt ? new Date(cred.expiresAt) : null;

    if (expiresAt) {
      const daysUntil = Math.floor(
        (expiresAt.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
      );
      if (daysUntil < 0) return { status: 'expired', urgency: 'critical' };
      if (daysUntil < 90) return { status: 'expiring', urgency: 'high' };
      if (daysUntil < 180) return { status: 'due_soon', urgency: 'medium' };
      return { status: 'current', urgency: 'low' };
    }

    // Predict recertification need based on age
    if (age >= 10) return { status: 'likely_due', urgency: 'high' };
    if (age >= 7) return { status: 'consider_renewal', urgency: 'medium' };
    return { status: 'current', urgency: 'low' };
  };

  const sorted = [...certifications].sort((a, b) => {
    const aStatus = getRecertificationStatus(a);
    const bStatus = getRecertificationStatus(b);
    const urgencyOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    return urgencyOrder[bStatus.urgency] - urgencyOrder[aStatus.urgency];
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="h-5 w-5" />
          Certification Status
        </CardTitle>
        <CardDescription>
          Age and re-certification status of your certifications
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No certifications found
          </p>
        ) : (
          sorted.map((cert) => {
            const age = getAge(cert.issuedAt);
            const status = getRecertificationStatus(cert);
            const expiresAt = cert.expiresAt ? new Date(cert.expiresAt) : null;

            return (
              <div
                key={cert.id}
                className="border rounded-lg p-4 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{cert.name}</h3>
                      {cert.specialty && (
                        <Badge variant="outline" className="text-xs">
                          {cert.specialty}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Issued {age} year{age !== 1 ? 's' : ''} ago
                      </span>
                      {expiresAt && (
                        <span>
                          Expires: {expiresAt.toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge
                    variant={
                      status.urgency === 'critical'
                        ? 'destructive'
                        : status.urgency === 'high'
                        ? 'secondary'
                        : 'outline'
                    }
                  >
                    {status.status.replace('_', ' ')}
                  </Badge>
                </div>

                {expiresAt && (
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span>Time until expiration</span>
                      <span>
                        {Math.floor(
                          (expiresAt.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
                        )}{' '}
                        days
                      </span>
                    </div>
                    <Progress
                      value={
                        Math.min(
                          ((expiresAt.getTime() - new Date().getTime()) /
                            (1000 * 60 * 60 * 24 * 365)) *
                            100,
                          100,
                        )
                      }
                      className="h-2"
                    />
                  </div>
                )}

                {status.urgency !== 'low' && (
                  <div className="flex items-center gap-2 text-sm text-amber-600">
                    <RefreshCw className="h-4 w-4" />
                    <span>
                      {status.urgency === 'critical'
                        ? 'Renewal required immediately'
                        : status.urgency === 'high'
                        ? 'Consider renewal soon'
                        : 'Plan for renewal'}
                    </span>
                  </div>
                )}

                {cert.chainStaleness > 90 && (
                  <div className="text-xs text-muted-foreground">
                    Chain update needed ({cert.chainStaleness} days old)
                  </div>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

