'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertCircle, XCircle, RefreshCw } from 'lucide-react';

type RequirementDto = {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARNING' | 'NOT_APPLICABLE';
  details: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  met: boolean;
  nextAction?: string | null;
  source?: string;
};

type RequirementsResponse = {
  success: boolean;
  data: {
    enrollment: {
      id: string;
      payerId: string;
      clinicianDid: string;
      status: string;
    };
    payer: {
      id: string;
      name: string;
      requiresCaqh: boolean;
      requiresPecos: boolean;
    };
    clinician: {
      specialty?: string;
      state?: string;
      npi?: string;
    } | null;
    summary: {
      overallStatus: 'PASS' | 'FAIL' | 'WARNING';
      eligible: boolean;
      warnings: string[];
      evaluatedAt: string;
    };
    requirements: RequirementDto[];
  };
};

const statusColors: Record<string, string> = {
  PASS: 'bg-emerald-600 text-white',
  FAIL: 'bg-red-600 text-white',
  WARNING: 'bg-amber-500 text-white',
  NOT_APPLICABLE: 'bg-slate-200 text-slate-700',
};

const statusDescriptions: Record<RequirementDto['status'], string> = {
  PASS: 'Requirement satisfied',
  FAIL: 'Requirement not met',
  WARNING: 'Requirement needs attention',
  NOT_APPLICABLE: 'Requirement not applicable',
};

export default function ClinicianPayerRequirementsPage() {
  const params = useParams();
  const payerId = (params?.id as string) || 'demo';
  const [data, setData] = useState<RequirementsResponse['data'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const summaryRegionId = useId().replace(/:/g, '-');
  const unmetSectionId = useId().replace(/:/g, '-');
  const trackingSectionId = useId().replace(/:/g, '-');
  const checklistSectionId = useId().replace(/:/g, '-');

  useEffect(() => {
    const controller = new AbortController();

    async function loadRequirements() {
      try {
        setLoading(true);
        const response = await fetch(`/api/payer/enroll/${payerId}/requirements`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error('Unable to load requirements');
        }
        const payload: RequirementsResponse = await response.json();
        setData(payload.data);
        setError(null);
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        setError(err.message || 'Unexpected error');
        setData(null);
      } finally {
        setLoading(false);
      }
    }

    loadRequirements();
    return () => controller.abort();
  }, [payerId]);

  const unmetRequirements = useMemo(() => {
    if (!data) return [] as RequirementDto[];
    return data.requirements.filter((req) => req.status === 'FAIL');
  }, [data]);

  const inProgressRequirements = useMemo(() => {
    if (!data) return [] as RequirementDto[];
    return data.requirements.filter((req) => req.status === 'WARNING');
  }, [data]);

  const summaryAnnouncement = useMemo(() => {
    if (!data) return 'No payer requirements loaded yet';
    const warningCount = data.summary.warnings.length;
    const warningCopy = warningCount === 1 ? '1 warning' : `${warningCount} warnings`;
    if (data.summary.overallStatus === 'PASS') {
      return `Eligible for submission, ${warningCopy}`;
    }
    if (data.summary.overallStatus === 'WARNING') {
      return `Eligible with follow-ups, ${warningCopy}`;
    }
    return `Action required, ${warningCopy}`;
  }, [data]);

  return (
    <div className="container mx-auto py-10 px-4" aria-busy={loading}>
      <div className="max-w-4xl mx-auto space-y-6">
        <header>
          <p className="text-sm uppercase text-slate-500">Payer Requirements</p>
          <h1 className="text-3xl font-semibold">
            {data?.payer.name || 'Clinician Payer Requirements'}
          </h1>
          <p className="text-slate-600">
            Review which onboarding requirements are complete and what still needs attention before
            submission.
          </p>
        </header>

        {error && (
          <div role="alert" className="border border-red-200 bg-red-50 text-red-800 rounded-md p-4">
            <p className="font-medium">Unable to load requirements</p>
            <p>{error}</p>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-20" aria-live="polite">
            <RefreshCw className="w-6 h-6 animate-spin text-slate-500" />
            <span className="ml-2 text-slate-600">Checking enrollment readiness…</span>
          </div>
        )}

        {!loading && data && (
          <>
            <Card id={summaryRegionId} role="status" aria-live="polite" aria-atomic="true">
              <CardHeader>
                <p className="sr-only" id={`${summaryRegionId}-announcement`}>{summaryAnnouncement}</p>
                <CardTitle className="flex items-center gap-3">
                  {getStatusIcon(data.summary.overallStatus)}
                  <span>
                    {data.summary.overallStatus === 'PASS'
                      ? 'Ready for submission'
                      : data.summary.overallStatus === 'WARNING'
                      ? 'Eligible with follow-ups'
                      : 'Action required'}
                  </span>
                </CardTitle>
                <CardDescription>
                  {data.summary.eligible
                    ? 'All critical requirements satisfied'
                    : 'Critical blockers must be resolved before submitting this enrollment.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                <div>
                  <p className="text-sm text-slate-500">Clinician specialty</p>
                  <p className="font-medium">
                    {data.clinician?.specialty || 'Internal Medicine (sample)'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Primary state</p>
                  <p className="font-medium">{data.clinician?.state || 'CA'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Warnings</p>
                  <p className="font-medium">{data.summary.warnings.length}</p>
                </div>
              </CardContent>
            </Card>

            {unmetRequirements.length > 0 && (
              <Card className="border-red-200 bg-red-50" aria-labelledby={`${unmetSectionId}-title`}>
                <CardHeader>
                  <CardTitle
                    id={`${unmetSectionId}-title`}
                    className="text-red-800 text-lg flex items-center gap-2"
                  >
                    <XCircle className="w-5 h-5" /> Outstanding actions
                  </CardTitle>
                  <CardDescription className="text-red-700">
                    Resolve these critical gaps before attempting to submit to the payer.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul
                    role="list"
                    aria-labelledby={`${unmetSectionId}-title`}
                    className="space-y-3"
                  >
                    {unmetRequirements.map((req, index) => {
                      const detailsId = `${unmetSectionId}-details-${index}`;
                      const actionId = req.nextAction ? `${unmetSectionId}-action-${index}` : undefined;
                      const describedBy = actionId ? `${detailsId} ${actionId}` : detailsId;
                      return (
                        <li
                          key={`${req.name}-${index}`}
                          className="bg-white rounded-md border border-red-100 p-4"
                          aria-describedby={describedBy}
                        >
                          <div className="flex items-center justify-between">
                            <p className="font-semibold">{req.name}</p>
                            <Badge
                              className={statusColors[req.status]}
                              aria-label={statusDescriptions[req.status]}
                            >
                              {req.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-slate-600 mt-2" id={detailsId}>
                            {req.details}
                          </p>
                          {req.nextAction && (
                            <p className="text-sm text-slate-500 mt-1" id={actionId}>
                              Next action: {req.nextAction}
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>
            )}

            {inProgressRequirements.length > 0 && (
              <Card aria-labelledby={`${trackingSectionId}-title`}>
                <CardHeader>
                  <CardTitle
                    id={`${trackingSectionId}-title`}
                    className="text-slate-900 text-lg flex items-center gap-2"
                  >
                    <AlertCircle className="w-5 h-5 text-amber-500" /> Items to monitor
                  </CardTitle>
                  <CardDescription>
                    These tasks are not blockers but should be refreshed soon to remain compliant.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul role="list" aria-labelledby={`${trackingSectionId}-title`} className="space-y-3">
                    {inProgressRequirements.map((req, index) => {
                      const detailsId = `${trackingSectionId}-details-${index}`;
                      const actionId = req.nextAction ? `${trackingSectionId}-action-${index}` : undefined;
                      const describedBy = actionId ? `${detailsId} ${actionId}` : detailsId;
                      return (
                        <li
                          key={`${req.name}-${index}`}
                          className="border border-slate-200 rounded-md p-4 bg-white"
                          aria-describedby={describedBy}
                        >
                          <div className="flex items-center justify-between">
                            <p className="font-semibold">{req.name}</p>
                            <Badge
                              className={statusColors[req.status]}
                              aria-label={statusDescriptions[req.status]}
                            >
                              {req.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-slate-600 mt-1" id={detailsId}>
                            {req.details}
                          </p>
                          {req.nextAction && (
                            <p className="text-sm text-slate-500 mt-1" id={actionId}>
                              Next action: {req.nextAction}
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>
            )}

            <section className="space-y-3" aria-labelledby={`${checklistSectionId}-title`}>
              <h2 className="text-xl font-semibold" id={`${checklistSectionId}-title`}>
                Complete checklist
              </h2>
              <ul role="list" aria-labelledby={`${checklistSectionId}-title`} className="space-y-3">
                {data.requirements.map((req, index) => {
                  const detailsId = `${checklistSectionId}-details-${index}`;
                  return (
                    <li key={`${req.name}-${req.source}-${index}`} aria-describedby={detailsId}>
                      <Card className="border-slate-200">
                        <CardContent className="py-4">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="font-medium flex items-center gap-2">
                                {req.source === 'template' && (
                                  <Badge variant="outline" className="text-xs">
                                    Payer template
                                  </Badge>
                                )}
                                {req.name}
                              </p>
                              <p className="text-sm text-slate-600 mt-1" id={detailsId}>
                                {req.details}
                              </p>
                            </div>
                            <Badge
                              className={statusColors[req.status]}
                              aria-label={statusDescriptions[req.status]}
                            >
                              {req.status}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            </section>

          </>
        )}
      </div>
    </div>
  );
}

function getStatusIcon(status: 'PASS' | 'FAIL' | 'WARNING') {
  if (status === 'PASS') {
    return <CheckCircle2 className="w-6 h-6 text-emerald-600" aria-hidden />;
  }
  if (status === 'WARNING') {
    return <AlertCircle className="w-6 h-6 text-amber-500" aria-hidden />;
  }
  return <XCircle className="w-6 h-6 text-red-600" aria-hidden />;
}
