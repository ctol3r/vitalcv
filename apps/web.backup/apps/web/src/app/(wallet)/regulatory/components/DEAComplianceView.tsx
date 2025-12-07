/**
 * DEA Compliance View
 * Phase 3: DEA & MATE Integration
 * Task 17: Create DEAComplianceView
 */

'use client';

import { useState, useEffect } from 'react';
import {
  Pill,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Download,
  Bell,
  Shield,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import type { RegulatoryBundle, DEAStatus } from '@/lib/regulatory/models';

interface DEAComplianceViewProps {
  clinicianId: string | null;
  bundle: RegulatoryBundle | null;
}

export function DEAComplianceView({ clinicianId, bundle }: DEAComplianceViewProps) {
  const [showExpirationAlert, setShowExpirationAlert] = useState(false);

  useEffect(() => {
    if (bundle?.dea) {
      const expDate = new Date(bundle.dea.expirationDate);
      const daysUntilExp = Math.floor((expDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysUntilExp <= 30 && daysUntilExp > 0) {
        setShowExpirationAlert(true);
      }
    }
  }, [bundle]);

  if (!bundle) {
    return null;
  }

  const dea = bundle.dea;

  if (!dea) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Pill className="h-5 w-5" />
            DEA Registration
          </CardTitle>
          <CardDescription>No DEA registration found.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const getStatusBadge = (status: DEAStatus['status']) => {
    const variants = {
      active: 'default',
      expired: 'destructive',
      suspended: 'destructive',
      revoked: 'destructive',
    } as const;

    return <Badge variant={variants[status] || 'secondary'}>{status.toUpperCase()}</Badge>;
  };

  const getDaysUntilExpiration = () => {
    const exp = new Date(dea.expirationDate);
    const now = new Date();
    const diff = Math.floor((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const daysUntilExp = getDaysUntilExpiration();
  const isExpiringSoon = daysUntilExp <= 30 && daysUntilExp > 0;
  const isExpired = daysUntilExp < 0;

  return (
    <div className="space-y-4">
      {/* Expiration Alert - Task 24 */}
      {showExpirationAlert && isExpiringSoon && (
        <Card className="border-l-4 border-l-destructive">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-destructive" />
              <CardTitle className="text-destructive">DEA Expiration Warning</CardTitle>
            </div>
            <CardDescription>
              Your DEA registration expires in {daysUntilExp} days. Renew now to avoid
              interruption.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="default"
              onClick={() => {
                window.open('https://www.deadiversion.usdoj.gov/webforms/regApp/index.html', '_blank');
              }}
            >
              Renew DEA Registration
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Main DEA Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Pill className="h-5 w-5" />
                DEA Registration
              </CardTitle>
              <CardDescription className="mt-1">
                Controlled substance compliance and MATE Act verification
              </CardDescription>
            </div>
            {getStatusBadge(dea.status)}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* DEA Number and Basic Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">DEA Number</p>
              <p className="font-mono font-semibold">{dea.deaNumber}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Schedules</p>
              <div className="flex gap-1 mt-1">
                {dea.schedules.map((schedule) => (
                  <Badge key={schedule} variant="outline">
                    {schedule}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Expiration</p>
              <p className="font-medium">
                {new Date(dea.expirationDate).toLocaleDateString()}
              </p>
              {isExpiringSoon && (
                <Badge variant="destructive" className="mt-1">
                  {daysUntilExp} days left
                </Badge>
              )}
              {isExpired && <Badge variant="destructive" className="mt-1">Expired</Badge>}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Trust Score</p>
              <p className="font-semibold">{Math.round(dea.trustScore * 100)}%</p>
              <Progress value={dea.trustScore * 100} className="mt-1 h-2" />
            </div>
          </div>

          {/* MATE Act Status - Task 19 */}
          <Card className="bg-muted/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4" />
                MATE Act Compliance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {dea.mateActCompleted ? (
                      <span className="flex items-center gap-2 text-green-600 dark:text-green-400">
                        <CheckCircle2 className="h-4 w-4" />
                        MATE Act Training Completed
                      </span>
                    ) : (
                      <span className="flex items-center gap-2 text-destructive">
                        <XCircle className="h-4 w-4" />
                        MATE Act Training Required
                      </span>
                    )}
                  </p>
                  {dea.mateActCompleted && dea.mateActCompletionDate && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Completed: {new Date(dea.mateActCompletionDate).toLocaleDateString()}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground mt-1">
                    Credits: {dea.mateActCredits} / 8 required
                  </p>
                </div>
                {!dea.mateActCompleted && (
                  <Button variant="outline" size="sm">
                    Complete Training
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Sanctions and Flags - Task 22 */}
          {dea.sanctions.length > 0 && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <p className="font-semibold text-destructive">DEA Sanctions</p>
              </div>
              <div className="space-y-2">
                {dea.sanctions.map((sanction) => (
                  <div key={sanction.id} className="text-sm">
                    <p className="font-medium">{sanction.type}</p>
                    <p className="text-muted-foreground">{sanction.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(sanction.date).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {dea.flags.length > 0 && (
            <div className="space-y-2">
              <p className="font-semibold">Active Flags</p>
              {dea.flags.map((flag) => (
                <Badge
                  key={flag.id}
                  variant={
                    flag.severity === 'critical' || flag.severity === 'high'
                      ? 'destructive'
                      : 'secondary'
                  }
                >
                  {flag.type}: {flag.description}
                </Badge>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="default"
              onClick={() => {
                window.open('https://www.deadiversion.usdoj.gov/webforms/regApp/index.html', '_blank');
              }}
            >
              Renew DEA Registration
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                // Task 21: DEA Credential Packet export
                const response = await fetch(`/api/regulatory/dea/credential-packet?clinicianId=${clinicianId}`);
                if (response.ok) {
                  const data = await response.json();
                  const blob = new Blob([JSON.stringify(data, null, 2)], {
                    type: 'application/json',
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `dea-credential-packet-${dea.deaNumber}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              Export Credential Packet
            </Button>
            {dea.chainAnchor && (
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








