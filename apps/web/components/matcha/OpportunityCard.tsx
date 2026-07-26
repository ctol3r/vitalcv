'use client';

/**
 * OpportunityCard — interactive wrapper around OpportunityIntelligenceCard.
 * Adds the clinician's Save / Connect / Decline actions, the gated Apply-with-VitalCV
 * CTA, the click-through to the full breakdown, and the honest Livability section.
 * Status is owned by the surface (one shared action map) and passed in.
 */

import { Bookmark, Check, X } from 'lucide-react';
import {
  OpportunityIntelligenceCard,
  type IntelligenceExplanation,
  type IntelligenceOpportunity,
} from './OpportunityIntelligenceCard';
import { OpportunityApplyCta, type ApplyCtaOpportunity } from './OpportunityApplyCta';
import { Livability } from './Livability';
import { CoverLetterDrafter } from './CoverLetterDrafter';
import { MatchAiSummary } from './MatchAiSummary';
import type { ExplanationReason } from './MatchaExplanation';
import type { OpportunityBucket, OpportunityStatus } from '@/lib/matcha/opportunityActions';

const ACCENT = 'var(--vt-accent, #0A7B7F)';
const GREEN = 'var(--vt-status-resolved, #2E7D45)';
const MUTED_BORDER = 'var(--vt-border, #D6DED9)';

interface ActionDef {
  status: OpportunityStatus;
  label: string;
  activeLabel: string;
  icon: typeof Bookmark;
  color: string;
}

const ACTIONS: ActionDef[] = [
  { status: 'saved', label: 'Save', activeLabel: 'Saved', icon: Bookmark, color: ACCENT },
  { status: 'connected', label: 'Connect', activeLabel: 'Connected', icon: Check, color: GREEN },
  { status: 'declined', label: 'Decline', activeLabel: 'Declined', icon: X, color: 'var(--vt-text-muted, #5A6472)' },
];

export interface OpportunityCardProps {
  opportunity: ApplyCtaOpportunity;
  explanation?: IntelligenceExplanation;
  preferenceReasons?: ExplanationReason[];
  bucket: OpportunityBucket;
  onSetStatus: (status: OpportunityStatus) => void;
  /** Clinician NPI — enables the Apply-with-VitalCV CTA. */
  npi?: string | null;
  /** The opportunity detail route (full breakdown). Links the title + footer affordance. */
  detailHref?: string;
}

export function OpportunityCard({ opportunity, explanation, preferenceReasons, bucket, onSetStatus, npi, detailHref }: OpportunityCardProps) {
  const declined = bucket === 'declined';
  return (
    <div style={{ opacity: declined ? 0.6 : 1, transition: 'opacity 200ms' }}>
      <OpportunityIntelligenceCard
        opportunity={opportunity}
        explanation={explanation}
        preferenceReasons={preferenceReasons}
        titleHref={detailHref}
      >
        {/* Action bar */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
          {ACTIONS.map((a) => {
            const active = bucket === a.status;
            const Icon = a.icon;
            return (
              <button
                key={a.status}
                type="button"
                onClick={() => onSetStatus(a.status)}
                aria-pressed={active}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: `1px solid ${active ? a.color : MUTED_BORDER}`,
                  background: active ? `color-mix(in srgb, ${a.color} 12%, transparent)` : 'var(--vt-surface, #fff)',
                  color: active ? a.color : 'var(--vt-text-primary)',
                  transition: 'all 150ms cubic-bezier(0.2,0.8,0.2,1)',
                }}
              >
                <Icon size={14} aria-hidden="true" />
                {active ? a.activeLabel : a.label}
              </button>
            );
          })}
          {detailHref ? (
            <a
              href={detailHref}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
                border: `1px solid ${MUTED_BORDER}`,
                background: 'var(--vt-surface, #fff)',
                color: 'var(--vt-accent, #0A7B7F)',
                textDecoration: 'none',
                marginLeft: 'auto',
              }}
            >
              Full breakdown →
            </a>
          ) : null}
        </div>

        {/* Apply with VitalCV — the real share flow, gated on the engine's hard gates */}
        <OpportunityApplyCta
          npi={npi}
          opportunity={opportunity}
          explanation={explanation}
          detailHref={detailHref}
          onShareComplete={() => {
            if (bucket !== 'connected') onSetStatus('connected');
          }}
        />

        {/* Livability */}
        <Livability location={opportunity.location} state={opportunity.state} remote={opportunity.remote} />

        {/* AI "why this fits you" — grounded in the deterministic match signals;
            renders only when AI is enabled (else the reasons above stand alone). */}
        {explanation ? (
          <MatchAiSummary
            opportunity={{
              title: opportunity.title,
              organization: opportunity.organization,
              specialty: opportunity.specialty,
              location: opportunity.location,
            }}
            matchBand={explanation.matchBand}
            fitReasons={explanation.fitReasons}
            blockers={explanation.blockers}
          />
        ) : null}

        {/* AI cover-letter draft */}
        <CoverLetterDrafter
          opportunity={{
            title: opportunity.title,
            organization: opportunity.organization,
            specialty: opportunity.specialty,
            location: opportunity.location,
          }}
        />
      </OpportunityIntelligenceCard>
    </div>
  );
}
