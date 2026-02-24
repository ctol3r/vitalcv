'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from '@/components/ui/glass-card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CRSRing } from '@/components/ui/crs-ring';
import { TrustBandIndicator } from '@/components/ui/trust-band-indicator';
import { ClaimBadge } from '@/components/ui/claim-badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  VerificationReceipts,
  type ReceiptRow,
} from '@/components/VerificationReceipts';
import {
  AlertCircle,
  AlertTriangle,
  ClipboardList,
  History,
  Loader2,
  Lock,
  Shield,
  ShieldAlert,
  Upload,
  XCircle,
} from 'lucide-react';
import { useRef } from 'react';
import type { TrustBand } from '@/components/trust-state/types';
import type {
  DataState,
  ExtractedField,
  ManualVerificationRecord,
  NpiIdentityResult,
  TrustStateResponse,
  VerificationLane,
  VerificationRequestRecord,
} from './intake-types';
import {
  BLOCKING_EXPLANATIONS,
  LABELS,
  LANE_CONFIG,
  LANE_ORDER,
  bandColors,
  formatDisplayValue,
} from './intake-types';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface Step3Props {
  /* NPI context */
  npi: string;
  npiResult: NpiIdentityResult | null;
  extractedFields: ExtractedField[];

  /* Verification checks */
  verificationRequests: VerificationRequestRecord[];
  verificationErrors: Partial<Record<VerificationLane, string>>;
  onRequestVerification: (lane: VerificationLane) => void;

  /* Trust status */
  trustState: DataState;
  trustResult: TrustStateResponse;
  trustApiError: string | null;
  onFetchTrustStatus: () => void;
  trustIsRefreshing: boolean;
  trustResultStale: boolean;
  previousTrustBand?: TrustBand | null;

  /* Manual verification */
  manualVerifications: ManualVerificationRecord[];
  onManualVerification: () => void;
  manualSubject: string;
  onManualSubjectChange: (value: string) => void;
  manualAttestor: 'Employer' | 'CVO';
  onManualAttestorChange: (value: 'Employer' | 'CVO') => void;
  manualFile: File | null;
  onManualFileChange: (file: File | null) => void;
  manualSubmitting: boolean;

  /* Receipts */
  receiptRows: ReceiptRow[];
  crsUpdatedBanner: boolean;
  acceptanceEnabled: boolean;
  failedOrPendingReceipts: ReceiptRow[];
  trustActionInFlight?: boolean;
}

function TrustStatusSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex justify-center">
        <div className="h-44 w-44 rounded-full border-8 border-muted/60 bg-muted/20 animate-shimmer" />
      </div>
      <div className="space-y-2 px-4">
        <div className="h-8 rounded-md bg-muted/50 animate-shimmer" />
        <div className="h-4 rounded-md bg-muted/40 animate-shimmer w-2/3" />
      </div>
      <div className="rounded-md border border-border/30 p-4 bg-muted/20 space-y-2">
        <div className="h-4 rounded bg-muted/40 animate-shimmer w-1/2" />
        <div className="h-3 rounded bg-muted/30 animate-shimmer w-full" />
        <div className="h-3 rounded bg-muted/30 animate-shimmer w-5/6" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Step3_AttestationReview                                            */
/* ------------------------------------------------------------------ */

export function Step3_AttestationReview({
  npi,
  npiResult,
  extractedFields,
  verificationRequests,
  verificationErrors,
  onRequestVerification,
  trustState,
  trustResult,
  trustApiError,
  onFetchTrustStatus,
  trustIsRefreshing,
  trustResultStale,
  previousTrustBand,
  manualVerifications,
  onManualVerification,
  manualSubject,
  onManualSubjectChange,
  manualAttestor,
  onManualAttestorChange,
  manualFile,
  onManualFileChange,
  manualSubmitting,
  receiptRows,
  crsUpdatedBanner,
  acceptanceEnabled,
  failedOrPendingReceipts,
  trustActionInFlight,
}: Step3Props) {
  const manualFileInputRef = useRef<HTMLInputElement>(null);
  const hasTrustSnapshot =
    trustState === 'success' || trustResultStale || trustIsRefreshing;
  const isTrustBusy = Boolean(trustActionInFlight || trustIsRefreshing || trustState === 'loading');

  return (
    <div className="space-y-6">
      {/* ---- Section 3: Verification Checks ---- */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-semibold font-heading">
            3
          </div>
          <h2 className="font-heading text-lg font-semibold tracking-tight">
            Verification &amp; Attestation
          </h2>
        </div>

        <GlassCard>
          <GlassCardHeader>
            <GlassCardTitle className="text-base flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" />
              Verification Checks
            </GlassCardTitle>
          </GlassCardHeader>
          <GlassCardContent className="space-y-4">
            {/* Lane buttons */}
            <div className="grid gap-3">
              {LANE_ORDER.map((lane) => {
                const config = LANE_CONFIG[lane];
                const existing = verificationRequests.find((r) => r.lane === lane);
                const isRunning = existing?.status === 'PENDING';
                const isComplete = existing?.status === 'COMPLETE';
                const error = verificationErrors[lane];

                return (
                  <div key={lane} className="space-y-1.5">
                    <div className="flex items-center gap-3">
                      <Button
                        variant={isComplete ? 'outline' : 'default'}
                        size="sm"
                        disabled={isRunning || isTrustBusy || manualSubmitting}
                        onClick={() => onRequestVerification(lane)}
                        className="shrink-0"
                      >
                        {isRunning ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : isComplete ? (
                          <Shield className="h-3.5 w-3.5" />
                        ) : (
                          <ClipboardList className="h-3.5 w-3.5" />
                        )}
                        <span className="ml-1.5">{config.label}</span>
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        {config.description}
                      </span>
                    </div>
                    {error && (
                      <p className="text-xs text-destructive flex items-center gap-1.5 ml-1">
                        <AlertCircle className="h-3 w-3" />
                        {error}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Verification request table */}
            {verificationRequests.length > 0 && (
              <div className="rounded-xl border border-border/40 overflow-x-auto">
                <table className="w-full text-sm min-w-[480px]">
                  <thead>
                    <tr className="bg-muted/30">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Lane
                      </th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Subject
                      </th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Status
                      </th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Timestamp
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {verificationRequests.map((req) => (
                      <tr key={`${req.lane}-${req.timestamp}`}>
                        <td className="px-4 py-2.5 font-medium capitalize">{req.lane}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{req.subject}</td>
                        <td className="px-4 py-2.5">
                          <ClaimBadge
                            level={
                              req.status === 'COMPLETE'
                                ? 'L2'
                                : req.status === 'PENDING'
                                  ? 'L1'
                                  : 'L0'
                            }
                          >
                            {req.status === 'COMPLETE'
                              ? 'Verified'
                              : req.status === 'PENDING'
                                ? 'Pending'
                                : 'Failed'}
                          </ClaimBadge>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono">
                          {new Date(req.timestamp).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCardContent>
        </GlassCard>
      </section>

      {/* ---- Section 4: Trust Status ---- */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-semibold font-heading">
            4
          </div>
          <h2 className="font-heading text-lg font-semibold tracking-tight">
            Trust Status
          </h2>
        </div>

        <GlassCard>
          <GlassCardContent className="pt-6 space-y-6">
            {trustState === 'loading' && (
              hasTrustSnapshot ? (
                <div className="rounded-md bg-muted/25 border border-muted/40 p-3 text-xs text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Refreshing trust status...
                </div>
              ) : (
                <TrustStatusSkeleton />
              )
            )}

            {trustState === 'error' && (
              <div className="flex items-start gap-3 rounded-xl bg-destructive/5 border border-destructive/20 p-4">
                <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-destructive">
                    {trustApiError || 'Unable to load trust status.'}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onFetchTrustStatus}
                    disabled={trustIsRefreshing || isTrustBusy}
                    className="mt-2 text-xs"
                  >
                    {trustIsRefreshing || isTrustBusy ? 'Refreshing…' : 'Retry'}
                  </Button>
                </div>
              </div>
            )}

            {hasTrustSnapshot && (
              <>
                {trustResultStale && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 flex items-center gap-2">
                    <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                    Showing prior trust snapshot while refresh is in progress.
                  </div>
                )}

                {/* CRS Ring */}
                <div className="flex flex-col items-center gap-4">
                  <CRSRing
                    band={trustResult.crs.band}
                    percentage={trustResult.crs.score}
                    size={160}
                    previousBand={previousTrustBand ?? undefined}
                  />
                  <TrustBandIndicator
                    band={trustResult.crs.band}
                    previousBand={previousTrustBand ?? undefined}
                  />
                </div>

                {/* Blocking reasons */}
                {trustResult.blocking_reasons.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                      {LABELS.ADDITIONAL_CHECKS}
                    </Label>
                    <ul className="space-y-2">
                      {(trustResult.blocking_reason_messages &&
                      trustResult.blocking_reason_messages.length > 0
                        ? trustResult.blocking_reason_messages
                        : trustResult.blocking_reasons.map(
                            (reason) =>
                              BLOCKING_EXPLANATIONS[reason] || reason.replace(/_/g, ' '),
                          )
                      ).map((message) => (
                        <li
                          key={message}
                          className="flex items-start gap-2 rounded-xl bg-destructive/5 border border-destructive/15 p-3"
                        >
                          <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                          <span className="text-sm">{message}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Pending notice */}
                {!trustResult.start_ready && (
                  <div className="rounded-xl bg-[var(--trust-yellow)]/10 border border-[var(--trust-yellow)]/20 p-3 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-[var(--trust-yellow)] shrink-0 mt-0.5" />
                    <p className="text-sm font-medium">{LABELS.PENDING}</p>
                  </div>
                )}
              </>
            )}

            {trustState === 'idle' && (
              <div className="rounded-xl border border-dashed border-border/60 bg-muted/30 p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Trust status has not been checked yet. Complete the steps above first.
                </p>
              </div>
            )}
          </GlassCardContent>
        </GlassCard>
      </section>

      {/* ---- Employer Preview Panel ---- */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 pt-4 border-t border-border/40">
          <History className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-heading text-base font-semibold tracking-tight text-muted-foreground">
            Employer Preview
          </h2>
        </div>

        <Card className="border-border/40 bg-card/80">
          <CardHeader>
            <CardTitle className="text-sm">
              What the employer sees
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Identity summary */}
            {npiResult && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                  Identity
                </Label>
                <div className="grid gap-1.5 text-sm">
                  {Object.entries(npiResult as Record<string, unknown>)
                    .filter(([, v]) => v != null && v !== '')
                    .slice(0, 6)
                    .map(([key, value]) => (
                      <div key={key} className="flex justify-between gap-4">
                        <span className="text-muted-foreground capitalize text-xs">
                          {key.replace(/_/g, ' ')}
                        </span>
                        <span className="font-medium text-right truncate max-w-[60%] text-xs">
                          {formatDisplayValue(key, value)}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Extracted credentials preview */}
            {extractedFields.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                  Extracted Credentials
                </Label>
                <div className="grid gap-1.5 text-sm">
                  {extractedFields
                    .filter((f) => f.value)
                    .map((field) => (
                      <div key={field.label} className="flex justify-between gap-4">
                        <span className="text-muted-foreground text-xs">{field.label}</span>
                        <span className="font-medium text-right truncate max-w-[60%] text-xs">
                          {field.value}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Manual verification form */}
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                Manual Verification
              </Label>

              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="manual-subject" className="text-xs">
                      Subject
                    </Label>
                    <Input
                      id="manual-subject"
                      placeholder="e.g. Board Certification"
                      value={manualSubject}
                      onChange={(e) => onManualSubjectChange(e.target.value)}
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="manual-attestor" className="text-xs">
                      Attestor
                    </Label>
                    <select
                      id="manual-attestor"
                      value={manualAttestor}
                      onChange={(e) =>
                        onManualAttestorChange(e.target.value as 'Employer' | 'CVO')
                      }
                      className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="Employer">Employer</option>
                      <option value="CVO">CVO</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="manual-doc" className="text-xs">
                    Document
                  </Label>
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor="manual-doc"
                      className="flex items-center gap-2 rounded-lg border border-dashed border-border/60 bg-muted/30 px-4 py-2 cursor-pointer hover:border-primary/40 transition-colors flex-1"
                    >
                      <Upload className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {manualFile ? manualFile.name : 'Select PDF or DOCX'}
                      </span>
                      <input
                        ref={manualFileInputRef}
                        id="manual-doc"
                        type="file"
                        accept=".pdf,.doc,.docx"
                        onChange={(e) => onManualFileChange(e.target.files?.[0] ?? null)}
                        className="hidden"
                      />
                    </label>
                    {manualFile && (
                      <button
                        type="button"
                        onClick={() => {
                          onManualFileChange(null);
                          if (manualFileInputRef.current)
                            manualFileInputRef.current.value = '';
                        }}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                        aria-label="Remove file"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    File is not stored in this preview.
                  </p>
                </div>

                <Button
                  onClick={onManualVerification}
                  disabled={manualSubmitting || isTrustBusy || !manualSubject.trim() || !manualFile}
                  className="w-full"
                >
                  {manualSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="ml-2">Submitting…</span>
                    </>
                  ) : (
                    <>
                      <Shield className="w-4 h-4" />
                      <span className="ml-2">Submit Manual Verification</span>
                    </>
                  )}
                </Button>
              </div>

              {/* Manual verification receipts table */}
              {manualVerifications.length > 0 && (
                <div className="rounded-xl border border-border/40 overflow-x-auto">
                  <table className="w-full text-sm min-w-[520px]">
                    <thead>
                      <tr className="bg-muted/30">
                        <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Subject
                        </th>
                        <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Attestor
                        </th>
                        <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Status
                        </th>
                        <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Timestamp
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {manualVerifications.map((v) => (
                        <tr key={v.id}>
                          <td className="px-4 py-2.5 font-medium">{v.subject}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{v.attestor}</td>
                          <td className="px-4 py-2.5">
                            <ClaimBadge
                              level={
                                v.status === 'COMPLETE'
                                  ? 'L2'
                                  : v.status === 'PENDING'
                                    ? 'L1'
                                    : 'L0'
                              }
                            >
                              {v.status === 'COMPLETE'
                                ? 'Pass'
                                : v.status === 'PENDING'
                                  ? 'Pending'
                                  : 'Fail'}
                            </ClaimBadge>
                            {v.status === 'FAILED' && v.reason && (
                              <p className="text-xs text-destructive mt-1">{v.reason}</p>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono">
                            {new Date(v.timestamp).toLocaleTimeString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Trust-State Summary in employer view */}
            {hasTrustSnapshot && (
              <div className="space-y-3">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                  Trust-State Summary
                </Label>
                <div className="flex items-center gap-4">
                  <CRSRing
                    band={trustResult.crs.band}
                    percentage={trustResult.crs.score}
                    size={80}
                    strokeWidth={6}
                    previousBand={previousTrustBand ?? undefined}
                  />
                  <div>
                    <TrustBandIndicator
                      band={trustResult.crs.band}
                      size="sm"
                      previousBand={previousTrustBand ?? undefined}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      CRS {trustResult.crs.score} / 100
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Accept button */}
            <div className="pt-3 border-t border-border/40">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                        <span className="w-full inline-block" tabIndex={0}>
                          <Button
                            disabled={!acceptanceEnabled || isTrustBusy}
                            className={`w-full ${
                              !acceptanceEnabled ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                          >
                        <Lock className="w-4 h-4 mr-2" />
                        Accept Recognition
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-center">
                    <p>
                      {failedOrPendingReceipts.length > 0
                        ? `Employer action required — ${failedOrPendingReceipts.map((r) => `${r.subject}: ${r.outcome}`).join(', ')}`
                        : 'Employer action required'}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Employer action required
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ---- Verification Receipts Panel ---- */}
      {receiptRows.length > 0 && (
        <VerificationReceipts
          receipts={receiptRows}
          crsUpdated={crsUpdatedBanner}
          isUpdating={isTrustBusy || trustState === 'loading' || trustIsRefreshing}
        />
      )}
    </div>
  );
}
