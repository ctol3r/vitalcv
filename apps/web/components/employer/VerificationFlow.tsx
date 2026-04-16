'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  CheckCircle2,
  FileSignature,
  Fingerprint,
} from 'lucide-react';
import type { TrustStateStatus, ReceiptRow } from './verifier-types';
import { formatTimestamp, getMockHash } from './verifier-types';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface VerificationFlowProps {
  status: TrustStateStatus;
  actionLoading: boolean;
  onAccept: () => void;
  onStart: () => void;
  allReceiptsPass: boolean;
  failedOrPendingReceipts: ReceiptRow[];
  isUpdating?: boolean;
}

/* ------------------------------------------------------------------ */
/*  VerificationFlow — 3-step recognition → acceptance → start         */
/* ------------------------------------------------------------------ */

export function VerificationFlow({
  status,
  actionLoading,
  onAccept,
  onStart,
  allReceiptsPass,
  failedOrPendingReceipts,
  isUpdating = false,
}: VerificationFlowProps) {
  const isBusy = actionLoading || isUpdating;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Verification &amp; Acceptance Flow</CardTitle>
      </CardHeader>
      <CardContent className="space-y-0">
        {/* Step 1: Network Recognition */}
        <FlowStep
          stepNumber={1}
          title="Network Recognition"
          subtitle="Subject identified in clinical graph"
          completed={status.recognized}
          active={!status.recognized}
          showConnector
          timestamp={status.recognizedAt}
        >
          {status.recognized && (
            <div className="space-y-2 mt-2">
              <p className="text-xs text-muted-foreground">
                No new verification run
              </p>
              <div className="flex items-center gap-3">
                <Badge
                  variant="outline"
                  className="text-xs gap-1 px-2"
                >
                  <FileSignature className="h-3 w-3" />
                  Recorded by VitalCV Network
                </Badge>
                {status.recognitionId && (
                  <HashBadge hash={getMockHash(status.recognitionId)} />
                )}
              </div>
              {status.recognized && (
                <Badge
                  variant="outline"
                  className="text-xs text-[var(--accent)] border-[var(--accent)]/20 bg-[var(--accent)]/5"
                >
                  Recognition Reused
                </Badge>
              )}
            </div>
          )}
        </FlowStep>

        {/* Step 2: Employer Acceptance */}
        <FlowStep
          stepNumber={2}
          title="Employer Acceptance"
          subtitle="Commitment to employ recognized subject"
          completed={status.accepted}
          active={status.recognized && !status.accepted}
          showConnector
          timestamp={status.acceptedAt}
        >
          {status.accepted && status.acceptanceDetails && (
            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm rounded-xl bg-muted/30 p-3 border border-border/30">
              <DetailField label="Employer" value={status.acceptanceDetails.employerId} />
              <DetailField label="Facility" value={status.acceptanceDetails.facilityId} />
              <DetailField label="Role" value={status.acceptanceDetails.role} />
              <DetailField
                label="Accepted At"
                value={new Date(status.acceptanceDetails.acceptedAt).toLocaleDateString()}
              />
            </div>
          )}
          {status.accepted && (
            <div className="flex items-center gap-3 mt-3">
              <Badge variant="outline" className="text-xs gap-1 px-2">
                <FileSignature className="h-3 w-3" />
                Recorded by {status.acceptanceDetails?.employerId || 'Employer'}
              </Badge>
              {status.acceptanceId && (
                <HashBadge hash={getMockHash(status.acceptanceId)} />
              )}
            </div>
          )}
          {!status.accepted && (
            <div className="mt-3">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-block">
                        <Button
                          onClick={onAccept}
                          disabled={
                            !status.recognized ||
                          isBusy ||
                          status.crs?.band !== 'GREEN' ||
                          !allReceiptsPass
                          }
                        >
                          {actionLoading ? 'Accepting...' : 'Accept Recognition'}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <p>
                      {failedOrPendingReceipts.length > 0
                        ? `Employer action required \u2014 ${failedOrPendingReceipts
                            .map((r) => `${r.subject}: ${r.outcome}`)
                            .join(', ')}`
                        : 'Employer action required'}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
                  <p className="text-xs text-muted-foreground font-medium mt-1 ml-1">
                    Employer action required
                  </p>
                  {isUpdating && (
                    <p className="text-xs text-muted-foreground mt-1 ml-1">
                      Refreshing verification status…
                    </p>
                  )}
                </div>
              )}
        </FlowStep>

        {/* Step 3: Start Attestation */}
        <FlowStep
          stepNumber={3}
          title="Start Attestation"
          subtitle="Official commencement of clinical duties"
          completed={status.started}
          active={status.accepted && !status.started}
          showConnector={false}
          timestamp={status.attestedAt}
        >
          {status.started && (
            <div className="flex items-center gap-3 mt-2">
              <Badge variant="outline" className="text-xs gap-1 px-2">
                <FileSignature className="h-3 w-3" />
                Recorded by{' '}
                {status.acceptanceDetails?.employerId || 'Employer'}
              </Badge>
              {status.startId && (
                <HashBadge hash={getMockHash(status.startId)} />
              )}
            </div>
          )}
          {!status.started && (
            <div className="mt-3">
              <Button
                onClick={onStart}
                disabled={!status.start_ready || isBusy}
                className={
                  status.start_ready
                    ? 'bg-[var(--trust-green)] hover:bg-[var(--trust-green)]/90 text-white'
                    : ''
                }
              >
                {actionLoading ? 'Attesting...' : 'Attest Start'}
              </Button>
              <p className="text-xs text-muted-foreground font-medium mt-1 ml-1">
                Replayable &bull; Timestamped &bull; Anchored
              </p>
            </div>
          )}
        </FlowStep>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  FlowStep — individual step in the 3-step flow                      */
/* ------------------------------------------------------------------ */

function FlowStep({
  stepNumber,
  title,
  subtitle,
  completed,
  active,
  showConnector,
  timestamp,
  children,
}: {
  stepNumber: number;
  title: string;
  subtitle: string;
  completed: boolean;
  active: boolean;
  showConnector: boolean;
  timestamp?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={`flex gap-4 ${showConnector ? 'pb-8' : ''} relative`}>
      {showConnector && (
        <div className="absolute left-[19px] top-10 bottom-0 w-0.5 bg-border/30" />
      )}
      <div
        className={`mt-1 z-10 h-10 w-10 rounded-full flex items-center justify-center border-2 bg-background text-sm font-semibold ${
          completed
            ? 'border-[var(--trust-green)] text-[var(--trust-green)]'
            : active
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-muted-foreground/30 text-muted-foreground/30'
        }`}
      >
        {completed ? <CheckCircle2 className="h-6 w-6" /> : stepNumber}
      </div>
      <div className="flex-1 pt-2">
        <div className="flex justify-between items-start">
          <div>
            <h3
              className={`font-heading font-semibold text-lg ${
                completed || active ? '' : 'text-muted-foreground'
              }`}
            >
              {title}
            </h3>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
          <div className="text-right">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">
              {completed ? 'Completed' : 'Pending'}
            </span>
            <div className="font-mono text-sm">
              {formatTimestamp(timestamp)}
            </div>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-muted-foreground text-xs font-medium uppercase block mb-0.5">
        {label}
      </span>
      <span className="font-medium text-sm">{value}</span>
    </div>
  );
}

function HashBadge({ hash }: { hash: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1 text-xs font-mono text-muted-foreground cursor-help hover:text-foreground transition-colors">
            <Fingerprint className="h-3 w-3" />
            {hash.substring(0, 10)}...
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>Demo reference hash</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
