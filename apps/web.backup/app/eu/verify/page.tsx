/**
 * B111A-FE-008: EUDI verify UX: trust-list 'as-of' badge + refresh CTA
 * B121A-FE-004: EUDI UI: trust-list 'as-of' badge & refresh CTA
 *
 * Component displays:
 * - Trust-list 'as-of' timestamp badge (SR-friendly)
 * - Refresh CTA when stale
 * - Clear error messages
 * B121A-FE-004: Badge shows timestamp; CTA triggers refresh; SR-friendly
 */

'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { RefreshCw, Clock, AlertTriangle, CheckCircle2, Loader2, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface TrustListStatus {
  fetchedAt: string;
  isStale: boolean;
  isFresh: boolean;
  ageDays: number;
  maxAgeDays: number;
  error?: string;
}

interface EudiVerifyProps {
  credentialId?: string;
  onRefresh?: () => Promise<void>;
}

/**
 * B111A-FE-008: EUDI Trust List Status Component
 * B121A-FE-004: EUDI UI trust-list badge with as-of timestamp and refresh CTA
 */
export function EudiTrustListBadge({ status, onRefresh, isRefreshing }: {
  status: TrustListStatus;
  onRefresh?: () => Promise<void>;
  isRefreshing?: boolean;
}) {
  const { toast } = useToast();

  const formatAsOfDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getBadgeVariant = (): 'default' | 'secondary' | 'destructive' | 'outline' => {
    if (status.error) return 'destructive';
    if (status.isStale) return 'destructive';
    if (status.isFresh) return 'default';
    return 'secondary';
  };

  const getBadgeColor = (): string => {
    if (status.error) return 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950 dark:text-red-300';
    if (status.isStale) return 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950 dark:text-orange-300';
    if (status.isFresh) return 'bg-green-100 text-green-800 border-green-300 dark:bg-green-950 dark:text-green-300';
    return 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-300';
  };

  const handleRefresh = async () => {
    if (!onRefresh) return;

    try {
      await onRefresh();
      toast({
        title: 'Trust List Refreshed',
        description: 'Trust list has been updated successfully.',
      });
    } catch (error) {
      toast({
        title: 'Refresh Failed',
        description: error instanceof Error ? error.message : 'Failed to refresh trust list',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* B111A-FE-008: As-of badge (SR-friendly) */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant={getBadgeVariant()}
            className={`flex items-center gap-1.5 ${getBadgeColor()}`}
            aria-label={`Trust list as-of: ${formatAsOfDate(status.fetchedAt)}`}
          >
            <Clock className="h-3 w-3" aria-hidden="true" />
            <span className="sr-only">Trust list as-of: </span>
            <span aria-hidden="true">As-of: {formatAsOfDate(status.fetchedAt)}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1 text-sm">
            <p className="font-semibold">Trust List Status</p>
            <p>Last fetched: {formatAsOfDate(status.fetchedAt)}</p>
            <p>Age: {status.ageDays.toFixed(1)} days</p>
            {status.isStale && (
              <p className="text-orange-600 dark:text-orange-400">
                Trust list is stale (older than {status.maxAgeDays} days)
              </p>
            )}
            {status.isFresh && (
              <p className="text-green-600 dark:text-green-400">
                Trust list is fresh and up-to-date
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>

      {/* B111A-FE-008: Refresh CTA when stale */}
      {status.isStale && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={handleRefresh}
              disabled={isRefreshing}
              variant="outline"
              size="sm"
              className="h-7"
              aria-label="Refresh trust list"
            >
              {isRefreshing ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1.5 animate-spin" aria-hidden="true" />
                  <span className="sr-only">Refreshing trust list</span>
                  <span aria-hidden="true">Refreshing...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="h-3 w-3 mr-1.5" aria-hidden="true" />
                  <span className="sr-only">Refresh trust list</span>
                  <span aria-hidden="true">Refresh</span>
                </>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Refresh trust list to get latest issuer information</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

/**
 * B111A-FE-008: EUDI Verify Component with Trust List Status
 */
export function EudiVerify({ credentialId, onRefresh }: EudiVerifyProps) {
  const [trustListStatus, setTrustListStatus] = useState<TrustListStatus | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Fetch trust list status
  const fetchTrustListStatus = async () => {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
      const response = await fetch(`${backendUrl}/verifier/eu/trust-list/status`);

      if (!response.ok) {
        throw new Error(`Failed to fetch trust list status: ${response.status}`);
      }

      const data = await response.json();
      const fetchedAt = new Date(data.fetchedAt || Date.now());
      const now = Date.now();
      const ageMs = now - fetchedAt.getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      const maxAgeDays = 7; // 7 days max age

      setTrustListStatus({
        fetchedAt: fetchedAt.toISOString(),
        isStale: ageDays > maxAgeDays,
        isFresh: ageDays <= maxAgeDays && !data.error,
        ageDays,
        maxAgeDays,
        error: data.error,
      });

      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch trust list status';
      setError(errorMessage);
      setTrustListStatus({
        fetchedAt: new Date().toISOString(),
        isStale: true,
        isFresh: false,
        ageDays: 999,
        maxAgeDays: 7,
        error: errorMessage,
      });
    }
  };

  // Refresh trust list
  const handleRefresh = async () => {
    setIsRefreshing(true);
    setError(null);

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
      const response = await fetch(`${backendUrl}/verifier/eu/trust-list/refresh`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Failed to refresh trust list: ${response.status}`);
      }

      // Refresh status after successful refresh
      await fetchTrustListStatus();

      if (onRefresh) {
        await onRefresh();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh trust list';
      setError(errorMessage);
      toast({
        title: 'Refresh Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTrustListStatus();
    // Refresh status every 5 minutes
    const interval = setInterval(fetchTrustListStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (!trustListStatus) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>EUDI Trust List</CardTitle>
          <CardDescription>Loading trust list status...</CardDescription>
        </CardHeader>
        <CardContent>
          <Loader2 className="h-4 w-4 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          EUDI Trust List Status
        </CardTitle>
        <CardDescription>
          European Digital Identity Wallet trust list verification status
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* B111A-FE-008: Trust list badge with as-of timestamp */}
        <EudiTrustListBadge
          status={trustListStatus}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />

        {/* B111A-FE-008: Error message (clear and SR-friendly) */}
        {error && (
          <Alert variant="destructive" role="alert">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <AlertDescription>
              <span className="sr-only">Error: </span>
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* B111A-FE-008: Stale warning with refresh CTA */}
        {trustListStatus.isStale && !error && (
          <Alert variant="default" className="bg-orange-50 border-orange-200 dark:bg-orange-950 dark:border-orange-800">
            <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" aria-hidden="true" />
            <AlertDescription className="text-orange-800 dark:text-orange-300">
              <p className="font-semibold mb-1">Trust list is stale</p>
              <p className="text-sm mb-2">
                The trust list was last updated {trustListStatus.ageDays.toFixed(1)} days ago.
                Verification may be blocked until the trust list is refreshed.
              </p>
              <Button
                onClick={handleRefresh}
                disabled={isRefreshing}
                variant="outline"
                size="sm"
                className="mt-2"
              >
                {isRefreshing ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                    Refreshing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-3 w-3 mr-1.5" />
                    Refresh Trust List
                  </>
                )}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* B111A-FE-008: Fresh status indicator */}
        {trustListStatus.isFresh && !error && (
          <Alert variant="default" className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" aria-hidden="true" />
            <AlertDescription className="text-green-800 dark:text-green-300">
              <p className="font-semibold">Trust list is up-to-date</p>
              <p className="text-sm">
                Last updated {trustListStatus.ageDays.toFixed(1)} days ago. Verification is enabled.
              </p>
            </AlertDescription>
          </Alert>
        )}

        {/* Trust list details */}
        <div className="text-sm text-muted-foreground space-y-1">
          <p>
            <strong>Age:</strong> {trustListStatus.ageDays.toFixed(1)} days
          </p>
          <p>
            <strong>Max Age:</strong> {trustListStatus.maxAgeDays} days
          </p>
          <p>
            <strong>Status:</strong>{' '}
            {trustListStatus.error
              ? 'Error'
              : trustListStatus.isStale
              ? 'Stale (refresh required)'
              : 'Fresh'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// Import Shield icon
import { Shield } from 'lucide-react';

