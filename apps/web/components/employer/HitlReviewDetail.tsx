'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfidenceScore } from '@/components/ui/confidence-score';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { SplitView } from '@/components/ui/split-view';
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Pencil,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface HitlField {
  id: string;
  label: string;
  extractedValue: string;
  confidence: number;
  status: 'PENDING' | 'APPROVED' | 'CORRECTED' | 'REJECTED';
  correctedValue?: string;
  sourceHighlight?: string; // text snippet from source doc
}

interface HitlReviewDetailProps {
  clinicianName: string;
  credentialType: string;
  source: string;
  fields: HitlField[];
  onFieldApprove: (fieldId: string) => void;
  onFieldCorrect: (fieldId: string, correctedValue: string) => void;
  onFieldReject: (fieldId: string) => void;
  onBack: () => void;
  onApproveAll: () => void;
}

/* ------------------------------------------------------------------ */
/*  HitlReviewDetail — split view: source doc + AI-extracted fields    */
/* ------------------------------------------------------------------ */

export function HitlReviewDetail({
  clinicianName,
  credentialType,
  source,
  fields,
  onFieldApprove,
  onFieldCorrect,
  onFieldReject,
  onBack,
  onApproveAll,
}: HitlReviewDetailProps) {
  const allReviewed = fields.every((f) => f.status !== 'PENDING');
  const lowConfidenceCount = fields.filter((f) => f.confidence < 95).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            Back
          </Button>
          <div>
            <h2 className="font-heading text-lg font-semibold">{clinicianName}</h2>
            <p className="text-xs text-muted-foreground">
              {credentialType} — {source}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {lowConfidenceCount > 0 && (
            <Badge variant="outline" className="text-xs text-[var(--trust-yellow)]">
              {lowConfidenceCount} low confidence
            </Badge>
          )}
          <Button size="sm" disabled={!allReviewed} onClick={onApproveAll}>
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
            Submit Review
          </Button>
        </div>
      </div>

      {/* Split view */}
      <SplitView
        ratio={0.45}
        className="min-h-[400px]"
        left={<SourceDocPanel />}
        right={
          <FieldReviewPanel
            fields={fields}
            onApprove={onFieldApprove}
            onCorrect={onFieldCorrect}
            onReject={onFieldReject}
          />
        }
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SourceDocPanel — left side: document preview                       */
/* ------------------------------------------------------------------ */

function SourceDocPanel() {
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm">Source Document</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex items-center justify-center min-h-[300px]">
        <div className="text-center space-y-2">
          <FileText className="h-12 w-12 text-muted-foreground/20 mx-auto" />
          <p className="text-sm text-muted-foreground">
            Document preview
          </p>
          <p className="text-xs text-muted-foreground/60">
            PDF / image rendering will be integrated with the document store
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  FieldReviewPanel — right side: AI-extracted fields                  */
/* ------------------------------------------------------------------ */

function FieldReviewPanel({
  fields,
  onApprove,
  onCorrect,
  onReject,
}: {
  fields: HitlField[];
  onApprove: (fieldId: string) => void;
  onCorrect: (fieldId: string, correctedValue: string) => void;
  onReject: (fieldId: string) => void;
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-sm">Extracted Fields</CardTitle>
        <Badge variant="outline" className="text-[10px]">
          {fields.filter((f) => f.status !== 'PENDING').length}/{fields.length} reviewed
        </Badge>
      </CardHeader>
      <CardContent className="space-y-2">
        {fields.map((field) => (
          <FieldRow
            key={field.id}
            field={field}
            onApprove={() => onApprove(field.id)}
            onCorrect={(val) => onCorrect(field.id, val)}
            onReject={() => onReject(field.id)}
          />
        ))}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  FieldRow — individual field with approve/correct/reject            */
/* ------------------------------------------------------------------ */

function FieldRow({
  field,
  onApprove,
  onCorrect,
  onReject,
}: {
  field: HitlField;
  onApprove: () => void;
  onCorrect: (val: string) => void;
  onReject: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(field.extractedValue);
  const isLowConfidence = field.confidence < 95;

  return (
    <div
      className={`rounded-xl border p-3 space-y-2 transition-colors ${
        isLowConfidence
          ? 'border-[var(--trust-yellow)]/30 bg-[var(--trust-yellow)]/5'
          : 'border-[var(--vt-border)] bg-background/50'
      } ${
        field.status === 'APPROVED'
          ? 'opacity-60'
          : field.status === 'REJECTED'
            ? 'opacity-40'
            : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {field.label}
        </span>
        <ConfidenceScore value={field.confidence} />
      </div>

      {editing ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="flex-1 rounded-lg border border-[var(--vt-border)] bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
            autoFocus
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              onCorrect(editValue);
              setEditing(false);
            }}
          >
            Save
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditValue(field.extractedValue);
              setEditing(false);
            }}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <p className="text-sm font-medium">
          {field.correctedValue || field.extractedValue}
          {field.correctedValue && (
            <span className="text-xs text-muted-foreground ml-2 line-through">
              {field.extractedValue}
            </span>
          )}
        </p>
      )}

      {field.status === 'PENDING' && !editing && (
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="outline" className="text-xs h-7" onClick={onApprove}>
            <CheckCircle2 className="h-3 w-3 mr-0.5 text-[var(--trust-green)]" />
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7"
            onClick={() => setEditing(true)}
          >
            <Pencil className="h-3 w-3 mr-0.5" />
            Correct
          </Button>
          <Button size="sm" variant="outline" className="text-xs h-7" onClick={onReject}>
            <XCircle className="h-3 w-3 mr-0.5 text-destructive" />
            Reject
          </Button>
        </div>
      )}

      {field.status !== 'PENDING' && (
        <Badge
          variant="outline"
          className={`text-[10px] h-4 px-1.5 ${
            field.status === 'APPROVED'
              ? 'text-[var(--trust-green)]'
              : field.status === 'CORRECTED'
                ? 'text-[var(--accent)]'
                : 'text-destructive'
          }`}
        >
          {field.status}
        </Badge>
      )}
    </div>
  );
}
