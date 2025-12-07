/**
 * Unit Detail View Component
 * Phase 3: Unit Detail & Staffing Intelligence
 */

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { UnitDetail } from '@/lib/workforce/models';
import {
  Users,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Send,
  TrendingDown,
} from 'lucide-react';
import { RosterList } from './RosterList';
import { DeficiencyScanner } from './DeficiencyScanner';
import { AnchorFreshnessMap } from './AnchorFreshnessMap';
import { CredentialGapPredictor } from './CredentialGapPredictor';
import { HiringRecommendations } from './HiringRecommendations';

interface UnitDetailViewProps {
  unitDetail: UnitDetail;
}

export function UnitDetailView({ unitDetail }: UnitDetailViewProps) {
  const { unit, roster, deficiencies, anchorFreshness, credentialGaps, recommendedHiring } =
    unitDetail;

  const handleVerifyUnit = async () => {
    // TODO: Implement real-time verification
    console.log('Verifying unit:', unit.id);
  };

  const handleSendTasks = async () => {
    // TODO: Implement task sending to clinicians
    console.log('Sending tasks to clinicians');
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Unit Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{unit.name}</h1>
          <p className="text-muted-foreground mt-1">
            {unit.type} • {unit.providerCount} providers
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleVerifyUnit} className="gap-2">
            <ShieldCheck className="h-4 w-4" />
            Verify Unit Now
          </Button>
          <Button variant="outline" onClick={handleSendTasks} className="gap-2">
            <Send className="h-4 w-4" />
            Send Tasks
          </Button>
        </div>
      </div>

      {/* Unit Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Readiness Status</CardTitle>
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Badge
              variant={
                unit.readinessStatus === 'green'
                  ? 'default'
                  : unit.readinessStatus === 'amber'
                    ? 'secondary'
                    : 'destructive'
              }
              className="text-lg capitalize"
            >
              {unit.readinessStatus}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Trust Score</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{unit.averageTrustScore.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Coverage Deficit</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {unit.coverageDeficit > 0 ? `-${unit.coverageDeficit}` : '0'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Deficiencies Alert */}
      {deficiencies.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {deficiencies.length} deficiency/deficiencies detected. Review the Deficiency Scanner
            below.
          </AlertDescription>
        </Alert>
      )}

      {/* Roster List */}
      <Card>
        <CardHeader>
          <CardTitle>Unit Roster</CardTitle>
          <CardDescription>
            {roster.length} clinicians with trust scores, eligibility, and credential health
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RosterList roster={roster} />
        </CardContent>
      </Card>

      {/* Deficiency Scanner */}
      <Card>
        <CardHeader>
          <CardTitle>Deficiency Scanner</CardTitle>
          <CardDescription>
            Missing certs, expiring licenses, DEA shortages, and chain staleness
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeficiencyScanner deficiencies={deficiencies} />
        </CardContent>
      </Card>

      {/* Anchor Freshness Map */}
      <Card>
        <CardHeader>
          <CardTitle>Anchor Freshness Map</CardTitle>
          <CardDescription>Chain anchor status for unit staff</CardDescription>
        </CardHeader>
        <CardContent>
          <AnchorFreshnessMap anchorFreshness={anchorFreshness} />
        </CardContent>
      </Card>

      {/* Credential Gap Predictor */}
      <Card>
        <CardHeader>
          <CardTitle>Credential Gap Predictor</CardTitle>
          <CardDescription>Forecasted credential gaps for next 30/60/90 days</CardDescription>
        </CardHeader>
        <CardContent>
          <CredentialGapPredictor gaps={credentialGaps} />
        </CardContent>
      </Card>

      {/* Hiring Recommendations */}
      {recommendedHiring.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recommended Hiring Actions</CardTitle>
            <CardDescription>Based on current shortages and projected gaps</CardDescription>
          </CardHeader>
          <CardContent>
            <HiringRecommendations recommendations={recommendedHiring} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}








