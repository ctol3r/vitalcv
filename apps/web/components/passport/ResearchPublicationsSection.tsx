import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { TrustClaim, type TrustClaimKind } from '@/components/trust-state/TrustClaim';
import type { PassportResearchData } from '@/lib/trust/research-passport-types';
import { formatProofDate } from '@/lib/trust/proof-language';

void React;

/**
 * Map the ORCID verification-status enum to the canonical TrustClaim
 * vocabulary. PENDING now maps to 'pending' (genuinely not-yet-linked),
 * not 'stale' (which means "checked but aged") — an honest refinement.
 */
const ORCID_STATUS_TO_CLAIM: Record<string, { kind: TrustClaimKind; limitation?: string }> = {
  VERIFIED: { kind: 'verified' },
  PENDING: { kind: 'pending', limitation: 'ORCID linkage in progress' },
  UNLINKED: { kind: 'unavailable', limitation: 'ORCID not linked' },
};

const AUTHOR_POSITION_CLASS: Record<string, string> = {
  first: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  last: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  middle: 'border-white/12 bg-white/[0.04] text-muted-foreground',
};

const TRIAL_STATUS_LABEL: Record<string, string> = {
  RECRUITING: 'Recruiting',
  ACTIVE_NOT_RECRUITING: 'Active',
  COMPLETED: 'Completed',
  TERMINATED: 'Terminated',
  WITHDRAWN: 'Withdrawn',
  SUSPENDED: 'Suspended',
  NOT_YET_RECRUITING: 'Not yet recruiting',
  UNKNOWN: 'Unknown',
};

const TRIAL_ROLE_LABEL: Record<string, string> = {
  PRINCIPAL_INVESTIGATOR: 'PI',
  SUB_INVESTIGATOR: 'Sub-I',
  STUDY_DIRECTOR: 'Director',
  STUDY_CHAIR: 'Chair',
};

export function ResearchPublicationsSection({
  research,
  mode = 'passport',
}: {
  research: PassportResearchData | null;
  mode?: 'passport' | 'review';
}) {
  if (!research) {
    return null;
  }

  const { publications, orcid, trials, activityScore, disclosurePreferences } = research;

  const nothingDisclosed =
    !disclosurePreferences.showPublications
    && !disclosurePreferences.showTrials
    && !disclosurePreferences.showOrcid
    && !disclosurePreferences.showResearchScore;

  if (nothingDisclosed) {
    return (
      <Card className="gap-0 rounded-2xl border-white/8 bg-white/[0.03] px-5 py-4 shadow-none">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/40">
          Research &amp; Publications
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Research data is not disclosed for this passport.
        </p>
      </Card>
    );
  }

  return (
    <Card className="gap-0 rounded-2xl border-white/8 bg-white/[0.03] shadow-none">
      <div className="border-b border-white/6 px-5 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/40">
          Research &amp; Publications
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Research data is informational. It does not replace source-backed credentialing.
        </p>
      </div>

      <div className="space-y-0 divide-y divide-white/6">
        {/* Research Activity Score */}
        {disclosurePreferences.showResearchScore && activityScore && (
          <div className="px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/30">
                  Research activity score
                </p>
                <div className="mt-2 flex items-baseline gap-3">
                  <span className="text-2xl font-semibold tabular-nums text-foreground">
                    {activityScore.score.toFixed(1)}
                  </span>
                  <span className="text-xs text-muted-foreground/50">/ 10</span>
                </div>
                <div className="mt-2 h-1.5 w-full max-w-[200px] overflow-hidden rounded-full bg-white/8">
                  <div
                    className="h-full rounded-full bg-emerald-500/60"
                    style={{ width: `${Math.min(activityScore.score * 10, 100)}%` }}
                  />
                </div>
              </div>
              <div className="shrink-0 space-y-1 text-right">
                <p className="text-[11px] text-muted-foreground">
                  {activityScore.publicationCount} publication{activityScore.publicationCount === 1 ? '' : 's'}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {activityScore.firstAuthorCount} first-author
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {activityScore.activeTrialCount} active trial{activityScore.activeTrialCount === 1 ? '' : 's'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ORCID Verification */}
        {disclosurePreferences.showOrcid && orcid && (
          <div className="px-5 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/30">
              ORCID
            </p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-foreground/70 font-mono">{orcid.orcidId}</p>
                <p className="mt-1 text-xs text-muted-foreground">{orcid.displayName}</p>
                {orcid.affiliations.length > 0 && (
                  <p className="mt-1 text-[11px] text-muted-foreground/50">
                    {orcid.affiliations[0].organizationName}
                    {orcid.affiliations[0].role ? ` · ${orcid.affiliations[0].role}` : ''}
                  </p>
                )}
              </div>
              {(() => {
                const claim = ORCID_STATUS_TO_CLAIM[orcid.verificationStatus] ?? {
                  kind: 'unavailable' as TrustClaimKind,
                  limitation: 'ORCID status unknown',
                };
                return (
                  <TrustClaim
                    kind={claim.kind}
                    source="ORCID"
                    limitation={claim.limitation}
                    size="sm"
                  />
                );
              })()}
            </div>
          </div>
        )}

        {/* Publications */}
        {disclosurePreferences.showPublications && publications.length > 0 && (
          <div className="px-5 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/30">
              Publications
            </p>
            <div className="mt-3 space-y-2">
              {publications.slice(0, 5).map((pub) => (
                <div
                  key={pub.pmid}
                  className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm leading-relaxed text-foreground/70">{pub.title}</p>
                    <Badge
                      variant="outline"
                      className={[
                        'shrink-0 rounded-full px-1.5 py-0.5 text-[9px]',
                        AUTHOR_POSITION_CLASS[pub.authorPosition] ?? AUTHOR_POSITION_CLASS.middle,
                      ].join(' ')}
                    >
                      {pub.authorPosition}
                    </Badge>
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    {pub.journal} · {pub.publicationDate}
                    {pub.doi ? ` · ${pub.doi}` : ''}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground/40 font-mono">
                    PMID: {pub.pmid}
                  </p>
                </div>
              ))}
              {publications.length > 5 && (
                <p className="text-[11px] text-muted-foreground">
                  +{publications.length - 5} more publication{publications.length - 5 === 1 ? '' : 's'}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Clinical Trials */}
        {disclosurePreferences.showTrials && trials.length > 0 && (
          <div className="px-5 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/30">
              Clinical trials
            </p>
            <div className="mt-3 space-y-2">
              {trials.slice(0, 5).map((trial) => (
                <div
                  key={trial.nctId}
                  className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm leading-relaxed text-foreground/70">{trial.title}</p>
                    <Badge
                      variant="outline"
                      className="shrink-0 rounded-full border-white/12 bg-white/[0.04] px-1.5 py-0.5 text-[9px] text-muted-foreground"
                    >
                      {trial.phase.replace('_', ' ')}
                    </Badge>
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    {TRIAL_ROLE_LABEL[trial.role] ?? trial.role}
                    {' · '}{TRIAL_STATUS_LABEL[trial.status] ?? trial.status}
                    {' · '}{trial.sponsor}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground/40 font-mono">
                    {trial.nctId}
                  </p>
                </div>
              ))}
              {trials.length > 5 && (
                <p className="text-[11px] text-muted-foreground">
                  +{trials.length - 5} more trial{trials.length - 5 === 1 ? '' : 's'}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
