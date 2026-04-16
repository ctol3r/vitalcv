'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Shield, Upload, XCircle } from 'lucide-react';
import { useRef } from 'react';
import type { ManualVerificationRecord } from './verifier-types';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface ManualVerificationProps {
  subject: string;
  onSubjectChange: (v: string) => void;
  attestor: 'Employer' | 'CVO';
  onAttestorChange: (v: 'Employer' | 'CVO') => void;
  file: File | null;
  onFileChange: (f: File | null) => void;
  submitting: boolean;
  onSubmit: () => void;
  verifications: ManualVerificationRecord[];
  disableActions?: boolean;
}

/* ------------------------------------------------------------------ */
/*  ManualVerification — form + receipts table                         */
/* ------------------------------------------------------------------ */

export function ManualVerification({
  subject,
  onSubjectChange,
  attestor,
  onAttestorChange,
  file,
  onFileChange,
  submitting,
  onSubmit,
  verifications,
  disableActions = false,
}: ManualVerificationProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-muted-foreground" />
          Manual Verification
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Upload a document for preview review. This creates a recorded receipt.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-sm">Subject</Label>
            <Input
              type="text"
              placeholder="e.g., License – State, Education"
              value={subject}
              onChange={(e) => onSubjectChange(e.target.value)}
              className="text-sm"
              disabled={disableActions}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Attestor</Label>
            <select
              aria-label="Attestor"
              value={attestor}
              onChange={(e) =>
                onAttestorChange(e.target.value as 'Employer' | 'CVO')
              }
              className="flex h-9 w-full rounded-lg border border-[var(--vt-border)] bg-transparent px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              disabled={disableActions}
            >
              <option value="Employer">Employer</option>
              <option value="CVO">CVO</option>
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm">Document</Label>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 rounded-lg border-2 border-dashed border-border/40 bg-muted/20 px-4 py-2 cursor-pointer hover:border-border/60 transition-colors flex-1">
              <Upload className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {file ? file.name : 'Select PDF or DOCX'}
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
                className="hidden"
              />
            </label>
            {file && (
              <button
                type="button"
                onClick={() => {
                  onFileChange(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="text-muted-foreground hover:text-destructive transition-colors"
                aria-label="Remove file"
                disabled={disableActions}
              >
                <XCircle className="h-4 w-4" />
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            File is not stored in this preview.
          </p>
        </div>

        <Button
          onClick={onSubmit}
          disabled={submitting || !subject.trim() || !file || disableActions}
          className="w-full"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Recording verification...
            </>
          ) : (
            <>
              <Shield className="h-4 w-4 mr-2" />
              Submit Manual Verification
            </>
          )}
        </Button>

        {/* Receipts table */}
        {verifications.length > 0 && (
          <div className="rounded-xl border border-border/40 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 border-b border-border/30">
                  <Th>Subject</Th>
                  <Th>Attestor</Th>
                  <Th>Status</Th>
                  <Th>Timestamp</Th>
                  <Th>Receipt</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {verifications.map((v) => (
                  <tr
                    key={v.id}
                    className={
                      v.status === 'FAILED' ? 'bg-destructive/5' : ''
                    }
                  >
                    <td className="px-4 py-2.5 font-medium">{v.subject}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {v.attestor}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={v.status} />
                      {v.status === 'FAILED' && v.reason && (
                        <p className="text-xs text-destructive mt-1">
                          {v.reason}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono">
                      {new Date(v.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="px-4 py-2.5">
                      {v.status === 'COMPLETE' ? (
                        <span className="text-xs flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-[var(--trust-green)]" />
                          Recorded
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          &mdash;
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
      {children}
    </th>
  );
}

function StatusBadge({ status }: { status: 'PENDING' | 'COMPLETE' | 'FAILED' }) {
  const config = {
    PENDING: {
      dot: 'bg-[var(--trust-yellow)]',
      label: 'PENDING',
      cls: 'bg-[var(--trust-yellow)]/10 text-[var(--trust-yellow)] border-[var(--trust-yellow)]/20',
    },
    COMPLETE: {
      dot: 'bg-[var(--trust-green)]',
      label: 'PASS',
      cls: 'bg-[var(--trust-green)]/10 text-[var(--trust-green)] border-[var(--trust-green)]/20',
    },
    FAILED: {
      dot: 'bg-destructive',
      label: 'FAIL',
      cls: 'bg-destructive/10 text-destructive border-destructive/20',
    },
  }[status];

  return (
    <Badge variant="outline" className={`text-[11px] border ${config.cls}`}>
      <span className={`inline-block h-2 w-2 rounded-full mr-1.5 ${config.dot}`} />
      {config.label}
    </Badge>
  );
}
