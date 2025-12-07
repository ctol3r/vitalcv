'use client';

import { useState, useEffect, useCallback } from 'react';
import { adminFacilityApi } from '@/lib/admin/api';
import { FacilitySearchResult } from '@/lib/admin/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Building2,
  Search,
  CheckCircle,
  XCircle,
  AlertCircle,
  Link2,
  Users,
  Settings,
  Plus,
  Snowflake,
} from 'lucide-react';
import Link from 'next/link';
import { FacilityDetailPanel } from '@/components/admin/FacilityDetailPanel';

export default function AdminFacilityPage() {
  const [query, setQuery] = useState('');
  const [facilities, setFacilities] = useState<FacilitySearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFacility, setSelectedFacility] = useState<FacilitySearchResult | null>(null);

  const searchFacilities = useCallback(async () => {
    if (!query.trim()) {
      setFacilities([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const results = await adminFacilityApi.searchFacilities(query);
      setFacilities(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search facilities');
      setFacilities([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchFacilities();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, searchFacilities]);

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Facility Management</h1>
          <p className="text-muted-foreground">
            Onboard, monitor, and manage hospital clients and enterprise integrations
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Onboard Facility
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle>Search Facilities</CardTitle>
          <CardDescription>
            Search by name, type, or status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search facilities..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Results */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Facility List */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Search Results</h2>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : facilities.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                {query ? 'No facilities found' : 'Enter a search query to find facilities'}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {facilities.map((facility) => (
                <Card
                  key={facility.id}
                  className={`cursor-pointer transition-colors ${
                    selectedFacility?.id === facility.id ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => setSelectedFacility(facility)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{facility.name}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2 capitalize">
                          {facility.type}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Badge
                            variant={
                              facility.status === 'active'
                                ? 'default'
                                : facility.status === 'onboarding'
                                ? 'secondary'
                                : facility.status === 'frozen'
                                ? 'destructive'
                                : 'outline'
                            }
                          >
                            {facility.status}
                          </Badge>
                          {facility.chainSync === 'synced' ? (
                            <Badge variant="outline" className="gap-1">
                              <CheckCircle className="h-3 w-3" />
                              Chain Synced
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="gap-1">
                              <XCircle className="h-3 w-3" />
                              Chain {facility.chainSync}
                            </Badge>
                          )}
                          {facility.oidcConfigured && (
                            <Badge variant="outline">OIDC</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className="text-sm text-right">
                          <div className="font-medium">{facility.activeUsers}</div>
                          <div className="text-xs text-muted-foreground">
                            of {facility.seatCount} seats
                          </div>
                        </div>
                        {facility.apiUptime !== undefined && (
                          <Badge
                            variant={facility.apiUptime >= 99 ? 'default' : 'destructive'}
                          >
                            {facility.apiUptime.toFixed(1)}% uptime
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Facility Detail Panel */}
        <div>
          {selectedFacility ? (
            <FacilityDetailPanel
              facility={selectedFacility}
              onClose={() => setSelectedFacility(null)}
            />
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Select a facility to view details
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

