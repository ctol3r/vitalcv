/**
 * ChainAnchorSection Component
 * Displays blockchain anchor status and timeline
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Link as LinkIcon,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ExternalLink,
  Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AnchorStatus, ChainEvent } from '@/lib/services/chain-service';
import { chainService } from '@/lib/services/chain-service';
import { triggerHapticFeedback } from '@/lib/haptic';
import { useEffect, useState } from 'react';

interface ChainAnchorSectionProps {
  anchorStatus: AnchorStatus;
  timeline: ChainEvent[];
  credentialId: string;
  showFullChain?: boolean;
  className?: string;
}

export function ChainAnchorSection({
  anchorStatus,
  timeline,
  credentialId,
  showFullChain = false,
  className,
}: ChainAnchorSectionProps) {
  const [pulseActive, setPulseActive] = useState(false);

  useEffect(() => {
    if (anchorStatus.verified && !anchorStatus.mismatch) {
      setPulseActive(true);
      triggerHapticFeedback('success');
      const timer = setTimeout(() => setPulseActive(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [anchorStatus.verified, anchorStatus.mismatch]);

  const shortHash = (hash?: string, length = 12) => {
    if (!hash) return '—';
    if (hash.length <= length + 4) return hash;
    return `${hash.slice(0, length)}…${hash.slice(-4)}`;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getEventIcon = (type: ChainEvent['type']) => {
    switch (type) {
      case 'anchor':
        return <LinkIcon className="h-4 w-4" />;
      case 're-anchor':
        return <LinkIcon className="h-4 w-4" />;
      case 'revoke':
        return <AlertTriangle className="h-4 w-4" />;
      case 'verify':
        return <CheckCircle2 className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getEventColor = (type: ChainEvent['type']) => {
    switch (type) {
      case 'anchor':
      case 're-anchor':
        return 'bg-blue-100 text-blue-600';
      case 'verify':
        return 'bg-emerald-100 text-emerald-600';
      case 'revoke':
        return 'bg-red-100 text-red-600';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Anchor Status Card */}
      <Card
        className={cn(
          'relative overflow-hidden',
          pulseActive && 'ring-2 ring-emerald-500 ring-offset-2',
        )}
      >
        {pulseActive && (
          <div className="absolute inset-0 bg-emerald-500/10 animate-pulse" />
        )}
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle>Chain Anchor Status</CardTitle>
              {anchorStatus.anchored && anchorStatus.verified && (
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Verified
                </Badge>
              )}
              {anchorStatus.mismatch && (
                <Badge variant="destructive">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Mismatch
                </Badge>
              )}
            </div>
            {anchorStatus.anchored && (
              <Badge variant="outline" className="bg-primary/5 border-primary/20">
                VitalCV Trust Ledger
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {anchorStatus.anchored ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Block Number</div>
                  <div className="font-mono text-lg font-semibold">
                    {anchorStatus.blockNumber?.toLocaleString() || '—'}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Transaction Hash</div>
                  <code className="text-xs font-mono bg-muted px-2 py-1 rounded block truncate">
                    {shortHash(anchorStatus.transactionHash)}
                  </code>
                </div>
                {anchorStatus.timestamp && (
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Anchored At</div>
                    <div className="font-medium">{formatDate(anchorStatus.timestamp)}</div>
                  </div>
                )}
                {anchorStatus.network && (
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Network</div>
                    <div className="font-medium">{anchorStatus.network}</div>
                  </div>
                )}
              </div>

              {anchorStatus.explorerUrl && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => window.open(anchorStatus.explorerUrl, '_blank')}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View on Block Explorer
                </Button>
              )}

              {anchorStatus.cachedProof && (
                <Card className="bg-muted/50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium">Cached Anchor Proof</div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const blob = new Blob([anchorStatus.cachedProof!.proof], {
                            type: 'application/json',
                          });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `anchor-proof-${credentialId}.json`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Cached: {new Date(anchorStatus.cachedProof.cachedAt).toLocaleString()}
                    </div>
                  </CardContent>
                </Card>
              )}

              {anchorStatus.mismatch && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-center gap-2 text-amber-900 mb-2">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-semibold">Anchor Mismatch Detected</span>
                  </div>
                  <p className="text-sm text-amber-800">
                    The on-chain anchor does not match the credential data. Please verify the
                    credential status.
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">Not Yet Anchored</h3>
              <p className="text-sm text-muted-foreground">
                This credential has not been anchored to the blockchain yet.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Timeline */}
      {showFullChain && timeline.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Trust Ledger Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {timeline.map((event, index) => (
                <div key={event.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div
                      className={cn(
                        'w-10 h-10 rounded-full flex items-center justify-center',
                        getEventColor(event.type),
                      )}
                    >
                      {getEventIcon(event.type)}
                    </div>
                    {index < timeline.length - 1 && (
                      <div className="w-0.5 h-full bg-border my-2" />
                    )}
                  </div>
                  <div className="flex-1 pb-6">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold capitalize">{event.type}</span>
                      {event.blockNumber && (
                        <Badge variant="outline" className="text-xs">
                          Block {event.blockNumber.toLocaleString()}
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground mb-2">
                      {formatDate(event.timestamp)}
                    </div>
                    {event.actor && (
                      <div className="text-sm text-muted-foreground mb-2">by {event.actor}</div>
                    )}
                    {event.details && (
                      <div className="text-sm text-muted-foreground mb-2">{event.details}</div>
                    )}
                    {event.transactionHash && (
                      <code className="text-xs font-mono bg-muted px-2 py-1 rounded">
                        {shortHash(event.transactionHash)}
                      </code>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

