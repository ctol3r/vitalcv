'use client';

import { useCallback, useEffect, useState } from 'react';
import { Search, MapPin, Users, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ProviderEntry {
  npi?: string;
  clinicianId: string;
  specialty: string[];
  privileges: string[];
  readiness: number;
  credentials: Array<{ type: string; status: string }>;
  location?: {
    zip?: string;
    state?: string;
    region?: string;
  };
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function ProviderIndexPage() {
  const [providers, setProviders] = useState<ProviderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [region, setRegion] = useState('US');

  const searchProviders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('skills', searchTerm);
      params.append('region', region);
      params.append('limit', '50');

      const response = await fetch(`${API_BASE}/api/provider-index/search?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Failed to search providers (${response.status})`);
      }
      const data = await response.json();
      setProviders(data);
    } catch (err) {
      console.error('Failed to search providers', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, region]);

  useEffect(() => {
    searchProviders();
  }, [searchProviders]);

  const avgReadiness = providers.length > 0
    ? providers.reduce((sum, p) => sum + p.readiness, 0) / providers.length
    : 0;

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">National Provider Index</h1>
          <p className="text-muted-foreground">
            Search and intelligence index spanning every clinician in the U.S.
          </p>
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by skills, specialty..."
            className="md:w-64"
          />
          <Input
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="Region"
            className="md:w-32"
          />
          <Button onClick={searchProviders} variant="secondary">
            <Search className="h-4 w-4 mr-2" />
            Search
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Providers Found</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{providers.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Readiness</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(avgReadiness * 100).toFixed(1)}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Region</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{region}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Provider Results</CardTitle>
          <CardDescription>Matching providers from the national index</CardDescription>
        </CardHeader>
        <CardContent>
          {providers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No providers found</div>
          ) : (
            <div className="space-y-2">
              {providers.map((provider) => (
                <div
                  key={provider.clinicianId}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="font-medium">
                        {provider.npi || provider.clinicianId}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {provider.specialty.join(', ')} • {provider.privileges.length} privileges
                      </div>
                      {provider.location && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {provider.location.state} {provider.location.zip}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant={provider.readiness > 0.8 ? 'default' : provider.readiness > 0.6 ? 'secondary' : 'outline'}>
                      {(provider.readiness * 100).toFixed(0)}% ready
                    </Badge>
                    <Badge variant="outline">
                      {provider.credentials.filter((c) => c.status === 'active').length} credentials
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {loading && (
        <div className="flex items-center justify-center p-8">
          <div className="text-muted-foreground">Searching providers...</div>
        </div>
      )}
    </div>
  );
}








