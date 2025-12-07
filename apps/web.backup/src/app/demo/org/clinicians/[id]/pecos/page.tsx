'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle2, Clock, FileText, RefreshCcw } from 'lucide-react';

type PecosDocument = {
  documentType: string;
  submittedAt?: string | null;
  parsedFields?: Record<string, unknown>;
};

type PecosPanelSummary = {
  clinicianId: string;
  status: 'ENROLLED' | 'PENDING' | 'REJECTED' | 'DEACTIVATED';
  medicareId?: string | null;
  npi?: string | null;
  effectiveDate?: string | null;
  revalidationDate?: string | null;
  lastCheckedAt?: string | null;
  documents: PecosDocument[];
};

const STATUS_LABELS: Record<PecosPanelSummary['status'], { label: string; variant: 'success' | 'warning' | 'danger' }> = {
  ENROLLED: { label: 'Enrolled', variant: 'success' },
  PENDING: { label: 'Pending Review', variant: 'warning' },
  REJECTED: { label: 'Rejected', variant: 'danger' },
  DEACTIVATED: { label: 'Deactivated', variant: 'danger' },
};

function formatDate(value?: string | null): string {
  if (!value) return 'Not available';
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function buildMockSummary(clinicianId: string): PecosPanelSummary {
  return {
    clinicianId,
    status: 'ENROLLED',
    medicareId: 'MED-245-778',
    npi: '1234567890',
    effectiveDate: new Date('2022-06-15').toISOString(),
    revalidationDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
    lastCheckedAt: new Date().toISOString(),
    documents: [
      {
        documentType: 'CMS855I',
        submittedAt: new Date('2022-05-01').toISOString(),
        parsedFields: { controlNumber: 'CMS855I-XYZ', practiceAddress: 'Austin, TX' },
      },
      {
        documentType: 'CMS855R',
        submittedAt: new Date('2024-01-10').toISOString(),
        parsedFields: { payToGroup: 'Example Medical Group PLLC' },
      },
    ],
  };
}

export default function ClinicianPecosPanel({ params }: { params: { id: string } }) {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<PecosPanelSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSummary() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/demo/org/clinicians/${params.id}/pecos`, {
          headers: { Accept: 'application/json' },
        });

        if (!response.ok) {
          throw new Error(`API responded with ${response.status}`);
        }

        const data = await response.json();
        setSummary({
          clinicianId: params.id,
          status: data.status ?? 'PENDING',
          medicareId: data.medicareId,
          npi: data.npi,
          effectiveDate: data.effectiveDate,
          revalidationDate: data.revalidationDate,
          lastCheckedAt: data.lastCheckedAt,
          documents: data.documents ?? [],
        });
      } catch (err) {
        console.warn('Falling back to PECOS mock data', err);
        setSummary(buildMockSummary(params.id));
        setError('Showing demo data until the PECOS API is connected.');
      } finally {
        setLoading(false);
      }
    }

    loadSummary();
  }, [params.id]);

  const statusMeta = useMemo(() => {
    if (!summary) return null;
    return STATUS_LABELS[summary.status];
  }, [summary]);

  return (
    <div className="container mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">PECOS Enrollment</h1>
          <p className="text-muted-foreground">
            Medicare enrollment status for clinician{' '}
            <span className="font-mono text-sm">{params.id}</span>
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => {
            setLoading(true);
            setSummary(null);
            setTimeout(() => {
              setSummary(buildMockSummary(params.id));
              setLoading(false);
            }, 400);
          }}
        >
          <RefreshCcw className="mr-2 h-4 w-4" aria-hidden="true" />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-dashed border-yellow-500/60 bg-yellow-50 p-4 text-sm text-yellow-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{error}</p>
        </div>
      )}

      <Card aria-live="polite">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            PECOS Status
            {statusMeta && (
              <Badge
                variant={statusMeta.variant === 'success' ? 'default' : 'secondary'}
                className={
                  statusMeta.variant === 'success'
                    ? 'bg-green-600 text-white'
                    : statusMeta.variant === 'warning'
                      ? 'bg-amber-500 text-black'
                      : 'bg-red-600 text-white'
                }
              >
                {statusMeta.label}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>CMS PECOS enrollment snapshot</CardDescription>
        </CardHeader>
        <CardContent>
          {loading || !summary ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4 animate-spin" aria-hidden="true" />
              Loading PECOS summary…
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Medicare ID</p>
                  <p className="font-medium">{summary.medicareId ?? 'Not on file'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">NPI</p>
                  <p className="font-medium">{summary.npi ?? 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Effective Date</p>
                  <p className="font-medium">{formatDate(summary.effectiveDate)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Next Revalidation</p>
                  <p className="font-medium">{formatDate(summary.revalidationDate)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Last Checked</p>
                  <p className="font-medium">{formatDate(summary.lastCheckedAt)}</p>
                </div>
              </div>

              <Separator />

              <section aria-labelledby="pecos-documents-heading">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" aria-hidden="true" />
                  <h2 id="pecos-documents-heading" className="text-lg font-semibold">
                    CMS 855 Documentation
                  </h2>
                </div>

                {summary.documents.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    No documents have been uploaded for this enrollment yet.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-3">
                    {summary.documents.map((doc, index) => (
                      <li
                        key={`${doc.documentType}-${index}`}
                        className="rounded-lg border bg-card p-3 text-sm"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{doc.documentType}</span>
                          <Badge variant="outline">{formatDate(doc.submittedAt)}</Badge>
                        </div>
                        {doc.parsedFields && (
                          <dl className="mt-2 space-y-1 text-muted-foreground">
                            {Object.entries(doc.parsedFields)
                              .slice(0, 3)
                              .map(([key, value]) => (
                                <div key={key} className="flex gap-2">
                                  <dt className="w-32 capitalize">{key}</dt>
                                  <dd className="flex-1">
                                    {typeof value === 'string' ? value : JSON.stringify(value)}
                                  </dd>
                                </div>
                              ))}
                          </dl>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                {summary.status === 'ENROLLED' ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden="true" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-yellow-600" aria-hidden="true" />
                )}
                <span>
                  Status last verified {formatDate(summary.lastCheckedAt)}. PECOS updates run daily at 02:00 PT.
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
