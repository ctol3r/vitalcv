/**
 * Facility Privileging Engine - Recruiter View
 * Phase 5: Recruiter view: privilege readiness summary
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Shield,
  TrendingUp,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { PrivilegeEligibilityResult } from '@/lib/privileging/models';
import { PrivilegeEvaluationService } from '@/lib/privileging/PrivilegeEvaluationService';
import { facilityPrivilegeSets } from '@/lib/privileging/facilityPrivilegeSets';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'http://localhost:4000';

interface PrivilegeReadinessSummary {
  clinicianId: string;
  totalPrivileges: number;
  eligible: number;
  conditional: number;
  denied: number;
  overallReadiness: number; // 0-100
  topPrivileges: Array<{
    privilegeCode: string;
    status: 'Eligible' | 'Conditional' | 'Denied';
    confidence: number;
  }>;
  recommendations: string[];
}

export default function RecruiterPrivilegeReadinessPage() {
  const params = useParams();
  const clinicianId = params.clinicianId as string;

  const [summary, setSummary] = useState<PrivilegeReadinessSummary | null>(null);
  const [eligibilityResults, setEligibilityResults] = useState<PrivilegeEligibilityResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (clinicianId) {
      loadPrivilegeReadiness();
    }
  }, [clinicianId]);

  async function loadPrivilegeReadiness() {
    setLoading(true);
    try {
      // Load clinician profile
      const profileRes = await fetch(`${API_BASE}/api/clinicians/${clinicianId}/profile`);
      if (!profileRes.ok) {
        throw new Error('Failed to load clinician profile');
      }
      const profile = await profileRes.json();

      // Evaluate privileges
      const evaluationService = new PrivilegeEvaluationService();
      const allPrivileges = facilityPrivilegeSets.flatMap((set) => set.privileges);
      const results = evaluationService.evaluateMultiple(allPrivileges, profile);

      setEligibilityResults(results);

      // Calculate summary
      const eligible = results.filter((r) => r.status === 'Eligible').length;
      const conditional = results.filter((r) => r.status === 'Conditional').length;
      const denied = results.filter((r) => r.status === 'Denied').length;

      const overallReadiness = results.length > 0
        ? Math.round(
            (results.reduce((sum, r) => sum + r.confidenceScore, 0) / results.length)
          )
        : 0;

      const topPrivileges = results
        .sort((a, b) => b.confidenceScore - a.confidenceScore)
        .slice(0, 5)
        .map((r) => ({
          privilegeCode: r.privilege.privilegeCode,
          status: r.status,
          confidence: r.confidenceScore,
        }));

      const recommendations = results
        .filter((r) => r.status !== 'Eligible')
        .flatMap((r) => r.nextSteps)
        .slice(0, 5);

      setSummary({
        clinicianId,
        totalPrivileges: results.length,
        eligible,
        conditional,
        denied,
        overallReadiness,
        topPrivileges,
        recommendations: [...new Set(recommendations)],
      });
    } catch (error) {
      console.error('Failed to load privilege readiness:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
        <p className="text-sm text-muted-foreground">Loading privilege readiness...</p>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
        <p className="text-sm text-muted-foreground">No privilege data available</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="space-y-2">
        <Badge variant="secondary">Recruiter · Privilege Readiness</Badge>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Privilege Readiness Summary</h1>
          <p className="text-sm text-muted-foreground">
            Clinician: {clinicianId.slice(0, 12)}...
          </p>
        </div>
      </header>

      {/* Overall Readiness */}
      <Card>
        <CardHeader>
          <CardTitle>Overall Readiness</CardTitle>
          <CardDescription>Privilege eligibility summary</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Readiness Score</span>
              <span className="font-semibold">{summary.overallReadiness}/100</span>
            </div>
            <Progress value={summary.overallReadiness} className="h-3" />
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-bold text-green-600">{summary.eligible}</p>
              <p className="text-xs text-muted-foreground">Eligible</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-bold text-amber-600">{summary.conditional}</p>
              <p className="text-xs text-muted-foreground">Conditional</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-bold text-red-600">{summary.denied}</p>
              <p className="text-xs text-muted-foreground">Denied</p>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <p className="text-2xl font-bold">{summary.totalPrivileges}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Privileges */}
      <Card>
        <CardHeader>
          <CardTitle>Top Privileges</CardTitle>
          <CardDescription>Highest confidence privilege evaluations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {summary.topPrivileges.map((priv) => (
              <div
                key={priv.privilegeCode}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center gap-3">
                  {priv.status === 'Eligible' ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : priv.status === 'Conditional' ? (
                    <Clock className="h-5 w-5 text-amber-600" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  )}
                  <div>
                    <p className="text-sm font-medium">{priv.privilegeCode}</p>
                    <Badge
                      variant={
                        priv.status === 'Eligible'
                          ? 'default'
                          : priv.status === 'Conditional'
                          ? 'secondary'
                          : 'destructive'
                      }
                      className="text-xs"
                    >
                      {priv.status}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Progress value={priv.confidence} className="w-24 h-2" />
                  <span className="text-sm font-semibold">{priv.confidence}%</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      {summary.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recommendations</CardTitle>
            <CardDescription>Actions to improve privilege readiness</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {summary.recommendations.map((rec, idx) => (
                <div key={idx} className="flex items-start gap-2 rounded-lg border p-3">
                  <TrendingUp className="h-4 w-4 mt-0.5 text-primary" />
                  <p className="text-sm">{rec}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detailed Eligibility Results */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Eligibility</CardTitle>
          <CardDescription>Complete privilege evaluation results</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {eligibilityResults.map((result) => (
              <div
                key={result.privilege.privilegeCode}
                className="rounded-lg border p-4"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium">{result.privilege.procedureName}</p>
                    <p className="text-xs text-muted-foreground">
                      {result.privilege.privilegeCode} · {result.privilege.specialty}
                    </p>
                  </div>
                  <Badge
                    variant={
                      result.status === 'Eligible'
                        ? 'default'
                        : result.status === 'Conditional'
                        ? 'secondary'
                        : 'destructive'
                    }
                  >
                    {result.status}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Progress value={result.confidenceScore} className="flex-1 h-2" />
                    <span className="text-xs font-semibold">{result.confidenceScore}%</span>
                  </div>
                  {result.blockers.length > 0 && (
                    <div className="rounded bg-red-50 border border-red-200 p-2">
                      <p className="text-xs font-medium text-red-900 mb-1">Blockers:</p>
                      <ul className="text-xs text-red-700 space-y-0.5">
                        {result.blockers.map((blocker, idx) => (
                          <li key={idx}>• {blocker}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
