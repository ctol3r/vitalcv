/**
 * Workforce Predictions View Component
 * Phase 4: Workforce Forecasting & Predictions
 */

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import type { WorkforcePrediction } from '@/lib/workforce/models';
import { AlertTriangle, TrendingDown, Calendar, Users } from 'lucide-react';
import { PredictiveHiringDashboard } from './PredictiveHiringDashboard';
import { ComplianceDipGraphs } from './ComplianceDipGraphs';
import { ScenarioSimulator } from './ScenarioSimulator';

interface WorkforcePredictionsViewProps {
  prediction: WorkforcePrediction;
}

export function WorkforcePredictionsView({ prediction }: WorkforcePredictionsViewProps) {
  // Check for critical alerts (e.g., "in 30 days, your ICU will be understaffed")
  const criticalShortages = prediction.forecastedShortages.filter(
    (s) => s.urgency === 'critical' && s.daysUntilGap <= 30,
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Workforce Predictions</h1>
        <p className="text-muted-foreground mt-1">
          Predictive intelligence for shortages, compliance dips, and staffing risk
        </p>
      </div>

      {/* Critical Alerts */}
      {criticalShortages.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Critical Shortage Alert</AlertTitle>
          <AlertDescription>
            {criticalShortages.map((shortage) => (
              <div key={shortage.specialty} className="mt-2">
                In {shortage.daysUntilGap} days, your {shortage.specialty} unit will be understaffed
                by {shortage.deficit} clinicians.
              </div>
            ))}
          </AlertDescription>
        </Alert>
      )}

      {/* Forecasted Shortages */}
      <Card>
        <CardHeader>
          <CardTitle>Forecasted Shortages by Specialty</CardTitle>
          <CardDescription>Projected staffing gaps by specialty</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {prediction.forecastedShortages.map((shortage) => (
              <div
                key={shortage.specialty}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold">{shortage.specialty}</span>
                    <Badge
                      variant={
                        shortage.urgency === 'critical'
                          ? 'destructive'
                          : shortage.urgency === 'high'
                            ? 'default'
                            : 'secondary'
                      }
                    >
                      {shortage.urgency}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>
                      Current: {shortage.currentCount} → Projected: {shortage.projectedCount}
                    </span>
                    <span className="text-destructive font-medium">Deficit: {shortage.deficit}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Forecast date: {new Date(shortage.forecastDate).toLocaleDateString()}
                  </p>
                </div>
                <TrendingDown className="h-5 w-5 text-muted-foreground" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Expiring Licensure */}
      <Card>
        <CardHeader>
          <CardTitle>Expiring Licensure Forecast</CardTitle>
          <CardDescription>Licenses expiring by state</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {prediction.expiringLicensure.map((exp) => (
              <div
                key={exp.state}
                className="flex items-center justify-between p-2 border rounded hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{exp.state}</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span>{exp.count} licenses</span>
                  <span className="text-muted-foreground">
                    {exp.daysUntilExpiration} days until expiration
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* DEA Renewal Waves */}
      <Card>
        <CardHeader>
          <CardTitle>DEA Renewal Waves</CardTitle>
          <CardDescription>Projected DEA renewal volumes by month</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {prediction.deaRenewalWaves.map((wave) => (
              <div
                key={wave.month}
                className="flex items-center justify-between p-2 border rounded hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{wave.month}</span>
                  <Badge
                    variant={
                      wave.urgency === 'critical' ? 'destructive' : wave.urgency === 'high' ? 'default' : 'secondary'
                    }
                  >
                    {wave.urgency}
                  </Badge>
                </div>
                <span className="text-sm">{wave.count} renewals</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Annual Credential Cycles */}
      <Card>
        <CardHeader>
          <CardTitle>Annual Credential Cycles</CardTitle>
          <CardDescription>Expected credential renewal patterns</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {prediction.annualCredentialCycles.map((cycle) => (
              <div
                key={cycle.type}
                className="flex items-center justify-between p-2 border rounded hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium capitalize">{cycle.type.replace(/_/g, ' ')}</span>
                  <span className="text-sm text-muted-foreground">{cycle.renewalMonth}</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span>{cycle.count} credentials</span>
                  <span className="text-muted-foreground">
                    Avg {cycle.averageProcessingDays} days processing
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Chain Inconsistencies */}
      <Card>
        <CardHeader>
          <CardTitle>Chain Inconsistency Forecasting</CardTitle>
          <CardDescription>Projected chain integrity issues</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {prediction.chainInconsistencies.map((inconsistency) => (
              <div
                key={`${inconsistency.unitId}-${inconsistency.inconsistencyType}`}
                className="flex items-center justify-between p-2 border rounded hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{inconsistency.unitId}</span>
                  <Badge
                    variant={
                      inconsistency.severity === 'critical'
                        ? 'destructive'
                        : inconsistency.severity === 'high'
                          ? 'default'
                          : 'secondary'
                    }
                  >
                    {inconsistency.severity}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="capitalize">{inconsistency.inconsistencyType.replace(/_/g, ' ')}</span>
                  <span className="text-muted-foreground">
                    Affects {inconsistency.affectedCount} clinicians
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Predictive Hiring Dashboard */}
      <PredictiveHiringDashboard shortages={prediction.forecastedShortages} />

      {/* Compliance Dip Graphs */}
      <ComplianceDipGraphs prediction={prediction} />

      {/* Scenario Simulator */}
      <ScenarioSimulator basePrediction={prediction} />
    </div>
  );
}








