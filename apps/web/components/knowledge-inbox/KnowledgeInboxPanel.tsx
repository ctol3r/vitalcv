import * as React from 'react';
import type { KnowledgeInboxItem } from '@/lib/knowledge-inbox/types';
import type { FieldProvenance } from '@/lib/profile/provenance';
import { FileText, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';

/**
 * GOD-3 / GOD-3F — Knowledge Inbox panel.
 *
 * Renders inbox items with human-safe provenance labels. The panel
 * never echoes the raw enum tag (USER_ENTERED, INFERRED, etc.) into
 * the user-visible chip; it always uses the friendly form mapped
 * here. Buttons offer profile-context actions only — accepting an
 * item never flips it to a verified state.
 */

const PROVENANCE_LABEL: Record<FieldProvenance, string> = {
  VERIFIED: 'Source-backed',
  USER_ENTERED: 'User-entered · not PSV',
  INFERRED: 'Inferred · needs confirmation',
  UNKNOWN: 'Unknown',
  CONFLICT: 'Conflict',
};

const STATUS_LABEL: Record<KnowledgeInboxItem['status'], string> = {
  captured: 'Captured',
  classified: 'Classified',
  needs_review: 'Needs review',
  suggested_to_profile: 'Profile context suggested',
  accepted_to_profile: 'Profile context accepted',
  rejected: 'Rejected',
  needs_source_evidence: 'Needs source evidence',
  verified_by_source: 'Source-backed',
};

function provenanceLabel(provenance: KnowledgeInboxItem['provenance']): string {
  return PROVENANCE_LABEL[provenance] ?? 'Unknown';
}

function statusLabel(status: KnowledgeInboxItem['status']): string {
  return STATUS_LABEL[status] ?? status;
}

const FOOTER_NOTE =
  'Classification organizes information. Source checks decide what becomes verified.';

export function KnowledgeInboxPanel({ items }: { items: KnowledgeInboxItem[] }) {
  if (items.length === 0) {
    return (
      <div
        className="rounded-2xl border border-border bg-card p-6 text-center"
        data-testid="knowledge-inbox-empty"
      >
        <FileText className="mx-auto h-8 w-8 text-muted-foreground/50 mb-3" />
        <h3 className="text-sm font-semibold text-foreground/80">Knowledge Inbox is empty</h3>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
          Add CV details, training history, research, or credential documents.
          Classification organizes information. Source checks decide what becomes verified.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="knowledge-inbox-list">
      {items.map((item) => (
        <div
          key={item.itemId}
          className="rounded-2xl border border-border bg-card p-5"
          data-testid={`knowledge-inbox-item-${item.itemId}`}
          data-provenance={item.provenance}
          data-proof-tier={item.proofTier}
          data-decision-grade={String(item.decisionGrade)}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-500">
                  {item.itemType}
                </span>
                <span className="text-xs text-muted-foreground">{item.confidence} confidence</span>
              </div>
              <h4 className="text-sm font-semibold text-foreground">{item.title}</h4>
              {item.summary && <p className="text-xs text-muted-foreground mt-1">{item.summary}</p>}
            </div>

            <div className="text-right flex flex-col items-end">
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-500"
                data-testid={`knowledge-inbox-provenance-${item.itemId}`}
              >
                {provenanceLabel(item.provenance)}
              </span>
              <span className="text-[10px] text-muted-foreground mt-1">{statusLabel(item.status)}</span>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-border/50 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Suggested Mapping
              </p>
              <div className="flex items-center gap-2 text-xs text-foreground/80">
                <span className="font-mono bg-muted px-1.5 py-0.5 rounded">{item.suggestedGraphNode}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className="font-medium">{item.suggestedProfileSection}</span>
              </div>
            </div>

            {item.limitationNote && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500/80 mb-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Limitation
                </p>
                <p className="text-xs text-muted-foreground italic">{item.limitationNote}</p>
              </div>
            )}
          </div>

          {item.nextAction && (
            <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between">
              <p className="text-xs font-medium text-foreground/70">Next Step: {item.nextAction}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="px-3 py-1.5 text-xs font-medium bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition-colors"
                >
                  Dismiss
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1"
                >
                  <CheckCircle2 className="h-3 w-3" />
                  Add as profile context
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
      <p className="text-[11px] italic text-muted-foreground/80 px-1" data-testid="knowledge-inbox-footnote">
        {FOOTER_NOTE}
      </p>
    </div>
  );
}
