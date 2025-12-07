'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ShieldCheck, Search, RefreshCcw } from 'lucide-react';

type TrustTier = 'ANCHOR' | 'TRUSTED' | 'WATCHLIST';

interface TrustRegistryItem {
  id: string;
  entityId: string;
  entityType: string;
  did: string;
  publicKeys: string[];
  jurisdiction: string | null;
  accreditationStatus: string;
  displayName: string;
  metadata: Record<string, unknown>;
  trustScore: number;
  tier: TrustTier;
  score: {
    components: {
      accuracy: number;
      freshness: number;
      uptime: number;
    };
    reasons: string[];
  };
  source: 'registry' | 'globalFallback';
  updatedAt: string;
}

interface TrustRegistryResponse {
  items: TrustRegistryItem[];
  total: number;
  filters: {
    supportedEntityTypes: string[];
    supportedAccreditationStatuses: string[];
  };
}

const tierVariant: Record<TrustTier, 'default' | 'secondary' | 'destructive'> = {
  ANCHOR: 'default',
  TRUSTED: 'secondary',
  WATCHLIST: 'destructive',
};

export default function TrustRegistryPage() {
  const [items, setItems] = useState<TrustRegistryItem[]>([]);
  const [entityType, setEntityType] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [supportedTypes, setSupportedTypes] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function fetchRegistry() {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams();
        if (entityType !== 'ALL') params.set('entityType', entityType);
        if (searchTerm.trim().length > 0) params.set('search', searchTerm.trim());

        const response = await fetch(`/api/trust/registry?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        const payload: TrustRegistryResponse = await response.json();
        if (!cancelled) {
          setItems(payload.items);
          setSupportedTypes(payload.filters.supportedEntityTypes ?? []);
        }
      } catch (err: any) {
        if (!cancelled) {
          if (err.name === 'AbortError') return;
          setError(err.message || 'Unable to load trust registry');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchRegistry();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [entityType, searchTerm]);

  const tierCounts = useMemo(() => {
    return items.reduce<Record<TrustTier, number>>(
      (acc, item) => {
        acc[item.tier as TrustTier] = (acc[item.tier as TrustTier] ?? 0) + 1;
        return acc;
      },
      { ANCHOR: 0, TRUSTED: 0, WATCHLIST: 0 }
    );
  }, [items]);

  const renderScoreBar = (score: number) => {
    const clamped = Math.min(Math.max(score, 0), 100);
    return (
      <div className="w-full">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
          <span>{clamped} / 100</span>
        </div>
        <div className="h-2 rounded-full bg-muted">
          <div
            className="h-2 rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500"
            style={{ width: `${clamped}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Demo &raquo; Org &raquo; Trust Registry</p>
        <h1 className="text-3xl font-bold">Trust Registry Explorer</h1>
        <p className="text-muted-foreground max-w-3xl">
          Search trusted issuers and verifiers with live trust scores, accreditation status, and DID public keys. This
          explorer mirrors the `/trust/` folder packaged inside PSV evidence bundles.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Filters
          </CardTitle>
          <CardDescription>Filter by entity type or search by DID, jurisdiction, or display name.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="entityType" className="text-sm font-medium">
              Entity type
            </label>
            <select
              id="entityType"
              value={entityType}
              onChange={(event) => setEntityType(event.target.value)}
              className="border rounded-md px-3 py-2 bg-background"
            >
              <option value="ALL">All entity types</option>
              {supportedTypes.map((type) => (
                <option key={type} value={type}>
                  {type.replaceAll('_', ' ')}
                </option>
               ))}
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="search" className="text-sm font-medium">
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Search by DID, jurisdiction, or display name"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {(['ANCHOR', 'TRUSTED', 'WATCHLIST'] as TrustTier[]).map((tier) => (
          <Card key={tier}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center justify-between">
                {tier}
                <Badge variant={tierVariant[tier]}>{tierCounts[tier]} entries</Badge>
              </CardTitle>
              <CardDescription>
                {tier === 'ANCHOR' && 'High-confidence issuers with fresh data'}
                {tier === 'TRUSTED' && 'Meets SLA with minor watch items'}
                {tier === 'WATCHLIST' && 'Requires follow-up before reuse'}
              </CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      {error && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <RefreshCcw className="h-4 w-4" />
              Failed to load trust registry
            </CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading trust registry…
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Trusted issuers & verifiers</CardTitle>
            <CardDescription>{items.length} entries</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entity</TableHead>
                  <TableHead>DID</TableHead>
                  <TableHead>Jurisdiction</TableHead>
                  <TableHead>Trust score</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Accreditation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="space-y-1">
                      <div className="font-medium">{item.displayName}</div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wide">
                        {item.entityType.replaceAll('_', ' ')}
                        {item.source === 'globalFallback' ? ' • Fallback' : ''}
                      </div>
                      <div className="text-xs text-muted-foreground break-all">
                        {item.publicKeys[0] || '—'}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs break-all">{item.did}</TableCell>
                    <TableCell>{item.jurisdiction ?? '—'}</TableCell>
                    <TableCell>{renderScoreBar(item.trustScore)}</TableCell>
                    <TableCell>
                      <Badge variant={tierVariant[item.tier]}>{item.tier}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.accreditationStatus}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No trust anchors match the selected filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

