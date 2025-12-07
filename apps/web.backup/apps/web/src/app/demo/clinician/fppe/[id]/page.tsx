'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { AlertCircle, CheckCircle2, UploadCloud } from 'lucide-react';

interface PageProps {
  params: {
    id: string;
  };
}

type ChecklistStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETE';

interface ChecklistItem {
  key: string;
  label: string;
  description?: string;
  status: ChecklistStatus;
  targetCount?: number;
  completedCount?: number;
}

interface ClinicianFppeCase {
  id: string;
  clinicianId: string;
  clinicianName: string;
  privilegeName: string;
  privilegeCode: string;
  startAt: string;
  dueAt: string;
  status: 'OPEN' | 'IN_REVIEW' | 'COMPLETED' | 'FAILED';
  checklist: ChecklistItem[];
}

const statusLabel: Record<ClinicianFppeCase['status'], string> = {
  OPEN: 'Open',
  IN_REVIEW: 'Under review',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
};

export default function ClinicianFppeCasePage({ params }: PageProps) {
  const { id } = params;
  const [caseData, setCaseData] = useState<ClinicianFppeCase | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [uploadMessage, setUploadMessage] = useState<string>('');

  useEffect(() => {
    let ignore = false;
    async function fetchCase() {
      try {
        const response = await fetch(`/api/org/demo-org-001/fppe/cases/${id}`, { cache: 'no-store' });
        if (!response.ok) {
          throw new Error('case not found');
        }
        const payload = await response.json();
        const normalized: ClinicianFppeCase = {
          id: payload.case.id,
          clinicianId: payload.case.clinicianId,
          clinicianName: payload.case.clinicianName,
          privilegeName: payload.case.privilegeName ?? payload.case.privilegeCode,
          privilegeCode: payload.case.privilegeCode,
          startAt: payload.case.startAt,
          dueAt: payload.case.dueAt,
          status: payload.case.status,
          checklist: payload.case.checklist.items,
        };
        if (!ignore) {
          setCaseData(normalized);
          setChecklist(normalized.checklist);
        }
      } catch (error) {
        console.warn('[FPPE clinician] using mock case', error);
        if (!ignore) {
          const mock = getMockClinicianCase(id);
          setCaseData(mock);
          setChecklist(mock.checklist);
        }
      }
    }
    fetchCase();
    return () => {
      ignore = true;
    };
  }, [id]);

  const completionPercent = useMemo(() => {
    if (!checklist.length) return 0;
    const completed = checklist.filter((item) => item.status === 'COMPLETE').length;
    return Math.round((completed / checklist.length) * 100);
  }, [checklist]);

  const toggleChecklist = (key: string) => {
    setChecklist((items) =>
      items.map((item) => {
        if (item.key !== key) return item;
        const nextStatus: ChecklistStatus =
          item.status === 'COMPLETE' ? 'IN_PROGRESS' : 'COMPLETE';
        return {
          ...item,
          status: nextStatus,
          completedCount:
            nextStatus === 'COMPLETE'
              ? item.targetCount ?? item.completedCount ?? 1
              : Math.min(item.completedCount ?? 0, (item.targetCount ?? 0) / 2),
        };
      })
    );
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    setUploadedFiles((previous) => [...previous, ...files.map((file) => file.name)]);
    setUploadMessage(`${files.length} file${files.length > 1 ? 's' : ''} ready for reviewer upload (demo only).`);
    event.target.value = '';
  };

  if (!caseData) {
    return (
      <div className="container mx-auto space-y-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Loading FPPE case…</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Fetching details for this FPPE case.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 py-8">
      <header className="space-y-1">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Clinician workspace</p>
        <h1 className="text-3xl font-bold">
          FPPE: {caseData.privilegeName}{' '}
          <span className="block text-base text-muted-foreground font-normal">{caseData.privilegeCode}</span>
        </h1>
        <p className="text-muted-foreground">
          Share progress with your reviewer by checking off each requirement and attaching supporting evidence.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3" aria-live="polite">
        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Badge variant="secondary" className="w-fit">
              {statusLabel[caseData.status]}
            </Badge>
            <p className="text-sm text-muted-foreground">
              Due {formatDate(caseData.dueAt)} · Started {formatDate(caseData.startAt)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Checklist completion</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{completionPercent}%</div>
            <p className="text-sm text-muted-foreground">
              {checklist.filter((item) => item.status === 'COMPLETE').length} of {checklist.length} tasks complete
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Reviewer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="font-medium">Org Privileging Committee</p>
            <p className="text-sm text-muted-foreground">Updates are shared automatically in demo mode.</p>
            <Link href="/demo/org/fppe">
              <Button variant="link" className="px-0">
                View org dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </section>

      <section aria-live="polite" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Evidence checklist</h2>
          <p className="text-sm text-muted-foreground">
            Mark each item once evidence is ready. Changes are local in this demo.
          </p>
        </div>
        <div className="space-y-3">
          {checklist.map((item) => (
            <div key={item.key} className="rounded-lg border p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={item.key}
                    checked={item.status === 'COMPLETE'}
                    onCheckedChange={() => toggleChecklist(item.key)}
                    aria-label={`Mark ${item.label} as complete`}
                  />
                  <label htmlFor={item.key} className="font-medium cursor-pointer">
                    {item.label}
                  </label>
                </div>
                {item.description && <p className="text-sm text-muted-foreground">{item.description}</p>}
                {typeof item.targetCount === 'number' && (
                  <p className="text-xs text-muted-foreground">
                    {Math.min(item.completedCount ?? 0, item.targetCount)} / {item.targetCount} documented
                  </p>
                )}
              </div>
              <Badge variant={item.status === 'COMPLETE' ? 'default' : 'outline'} className="w-fit">
                {item.status === 'COMPLETE' ? 'Complete' : item.status === 'IN_PROGRESS' ? 'In progress' : 'Pending'}
              </Badge>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <UploadCloud className="h-5 w-5 text-primary" aria-hidden="true" />
          Upload supporting files <span className="text-sm font-normal text-muted-foreground">(demo stub)</span>
        </h2>
        <div className="rounded-lg border border-dashed p-6 space-y-3 text-sm">
          <p>
            Drag PDFs or imaging snapshots here, or use the button below. Files stay in the browser for demo purposes
            (no backend upload).
          </p>
          <Input type="file" accept=".pdf,image/*" multiple onChange={handleFileUpload} />
          <div className="space-y-2" aria-live="polite">
            {uploadMessage && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
                {uploadMessage}
              </p>
            )}
            {uploadedFiles.length > 0 && (
              <ul className="list-disc pl-5 text-sm">
                {uploadedFiles.map((file) => (
                  <li key={file}>{file}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-primary" aria-hidden="true" />
          Need help?
        </h2>
        <p className="text-sm text-muted-foreground">
          Share this link with your reviewer or open the org dashboard to see how evaluators view your case.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/demo/org/fppe">
            <Button variant="secondary">Open org FPPE dashboard</Button>
          </Link>
          <Button disabled>Submit evidence (disabled in demo)</Button>
        </div>
      </section>
    </div>
  );
}

function formatDate(date: string | Date) {
  const instance = typeof date === 'string' ? new Date(date) : date;
  return instance.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function getMockClinicianCase(id: string): ClinicianFppeCase {
  return {
    id,
    clinicianId: 'did:example:demo',
    clinicianName: 'Dr. Demo Clinician',
    privilegeName: 'Adult Cardiac Cath',
    privilegeCode: 'CARD-CATH-ADULT',
    startAt: new Date('2025-01-01').toISOString(),
    dueAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'IN_REVIEW',
    checklist: [
      {
        key: 'chartsReviewed',
        label: 'Charts reviewed',
        description: 'Provide 10 representative cases with reviewer comments.',
        status: 'IN_PROGRESS',
        targetCount: 10,
        completedCount: 6,
      },
      {
        key: 'supervisedCases',
        label: 'Supervised cases',
        description: 'Cases performed under proctor observation.',
        status: 'PENDING',
        targetCount: 5,
        completedCount: 2,
      },
      {
        key: 'outcomes',
        label: 'Outcome tracking',
        description: 'Document patient outcomes for cath procedures.',
        status: 'PENDING',
        targetCount: 3,
        completedCount: 0,
      },
    ],
  };
}

