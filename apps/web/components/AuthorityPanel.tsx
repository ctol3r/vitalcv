'use client';

import { useState } from 'react';
import { CheckCircle, Loader2, ShieldCheck, XCircle } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { AuthorityAcceptanceEvent, AuthorityEvent } from '@domain-common/authorityEvents';

type AcceptingEntity = {
  entityId?: string;
  name: string;
  did?: string;
  type: 'employer' | 'facility' | 'payer' | 'issuer' | 'other';
};

interface AuthorityPanelProps {
  authorityEvent: AuthorityEvent;
  acceptor?: AcceptingEntity;
}

const STATUS_TONES: Record<string, string> = {
  active: 'text-emerald-600',
  expired: 'text-amber-600',
  suspended: 'text-red-600',
  revoked: 'text-red-600',
  restricted: 'text-amber-600',
};

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  return new Date(value).toLocaleString();
};

const resolveAcceptor = (event: AuthorityEvent, acceptor?: AcceptingEntity): AcceptingEntity => {
  if (acceptor?.name) return acceptor;
  if (event.facility?.name) {
    return {
      name: event.facility.name,
      entityId: event.facility.facilityId,
      type: 'facility',
    };
  }
  return { name: 'Employer Reviewer', type: 'employer' };
};

export function AuthorityPanel({ authorityEvent, acceptor }: AuthorityPanelProps) {
  const { toast } = useToast();
  const [accepting, setAccepting] = useState(false);
  const [acceptance, setAcceptance] = useState<AuthorityAcceptanceEvent | null>(null);
  const [auditRef, setAuditRef] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const acceptedBy = resolveAcceptor(authorityEvent, acceptor);

  const handleAccept = async () => {
    setAccepting(true);
    setError(null);

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
      const response = await fetch(`${backendUrl}/authority/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorityEvent,
          acceptor: acceptedBy,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Authority acceptance failed.');
      }

      const data = (await response.json()) as {
        acceptance: AuthorityAcceptanceEvent;
        auditRef?: string;
      };

      setAcceptance(data.acceptance);
      setAuditRef(data.auditRef ?? null);
      toast({
        title: 'Authority Accepted',
        description: 'Acceptance recorded and audit anchored.',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authority acceptance failed.';
      setError(message);
      toast({
        title: 'Acceptance Failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setAccepting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-border/70 bg-card/80 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Authority Acceptance</CardTitle>
            <Badge variant="outline" className="uppercase tracking-[0.3em] text-[0.55rem]">
              {authorityEvent.issuerType}
            </Badge>
          </div>
          <CardDescription>
            Review the authority event. No uploads. No edits. Acceptance is immutable.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <div className="text-muted-foreground">Subject</div>
              <div className="font-medium text-foreground">
                {authorityEvent.subjectName || 'Clinician'}
              </div>
              <div className="text-xs text-muted-foreground font-mono">{authorityEvent.subjectDid}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Issuer</div>
              <div className="font-medium text-foreground">{authorityEvent.issuerName}</div>
              <div className="text-xs text-muted-foreground font-mono">{authorityEvent.issuerDid}</div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <div className="text-muted-foreground">Issued</div>
              <div className="font-medium text-foreground">{formatDate(authorityEvent.issuedAt)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Expires</div>
              <div className="font-medium text-foreground">{formatDate(authorityEvent.expiresAt)}</div>
            </div>
          </div>

          {authorityEvent.facility && (
            <div className="rounded-lg border border-border/60 bg-secondary/30 p-3">
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Facility</div>
              <div className="mt-2 font-medium text-foreground">{authorityEvent.facility.name}</div>
              <div className="text-xs text-muted-foreground font-mono">
                {authorityEvent.facility.facilityId}
              </div>
              <div className="text-xs text-muted-foreground">
                {authorityEvent.facility.location || 'Location not provided'}
              </div>
            </div>
          )}

          <div>
            <div className="text-muted-foreground">Authority Hash</div>
            <code className="mt-1 block text-xs text-foreground/80">{authorityEvent.hashAnchor}</code>
          </div>
        </CardContent>
      </Card>

      {authorityEvent.credential && (
        <Card className="border-border/70 bg-card/70 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Facility-Issued Credential</CardTitle>
            <CardDescription>Read-only credential summary.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {(() => {
              const credentialStatus = authorityEvent.credential?.status ?? 'unknown';
              const credentialTitle = authorityEvent.credential?.title || 'Credential';
              const credentialId = authorityEvent.credential?.credentialId || '—';
              const credentialType = authorityEvent.credential?.type || 'unspecified';

              return (
                <>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-muted-foreground">Credential</div>
                <div className="font-medium text-foreground">{credentialTitle}</div>
              </div>
              <Badge
                variant="outline"
                className={cn('uppercase', STATUS_TONES[credentialStatus] || 'text-muted-foreground')}
              >
                {credentialStatus}
              </Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <div className="text-muted-foreground">Type</div>
                <div className="font-medium text-foreground">{credentialType}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Credential ID</div>
                <div className="font-mono text-foreground">{credentialId}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Issued</div>
                <div className="font-medium text-foreground">
                  {formatDate(authorityEvent.credential.issuedAt)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Expires</div>
                <div className="font-medium text-foreground">
                  {formatDate(authorityEvent.credential.expiresAt)}
                </div>
              </div>
            </div>
            {authorityEvent.credential.facility && (
              <div className="text-xs text-muted-foreground">
                Facility credential issued by {authorityEvent.credential.facility.name}
              </div>
            )}
                </>
              );
            })()}
          </CardContent>
        </Card>
      )}

      <Card className="border-border/70 bg-card/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Acceptance</CardTitle>
          <CardDescription>Accepting as {acceptedBy.name}.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {acceptance ? (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-emerald-700">
                <CheckCircle className="h-5 w-5" />
                <span className="font-semibold">Accepted and audit anchored</span>
              </div>
              <div>
                <div className="text-muted-foreground">Accepted</div>
                <div className="font-medium text-foreground">{formatDate(acceptance.acceptedAt)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Acceptance Hash</div>
                <code className="mt-1 block text-xs text-foreground/80">{acceptance.hashAnchor}</code>
              </div>
              {auditRef && (
                <div>
                  <div className="text-muted-foreground">Audit Ref</div>
                  <code className="mt-1 block text-xs text-foreground/80">{auditRef}</code>
                </div>
              )}
            </div>
          ) : (
            <Button
              onClick={handleAccept}
              disabled={accepting}
              className="w-full rounded-full"
            >
              {accepting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Recording acceptance...
                </>
              ) : (
                <>
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Accept Authority
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
