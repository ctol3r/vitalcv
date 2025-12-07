'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Filter,
  ShieldCheck,
  MapPin,
  Clock,
  Star,
  Heart,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Sparkles,
  Globe,
  Building2,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

const API_BASE = (process.env.NEXT_PUBLIC_PLATFORM_API ?? '').replace(/\/$/, '');

interface ClinicianResult {
  clinicianId: string;
  trustScore: number;
  specialty: string[];
  matchScore?: {
    overall: number;
    breakdown: {
      credentials: number;
      trustTrajectory: number;
      skillCompetency: number;
      privilegingReadiness: number;
      telemedicineCoverage: number;
      compactPortability: number;
    };
    factors: {
      strengths: string[];
      gaps: string[];
    };
  };
  privileges: {
    icu: boolean;
    or: boolean;
    telemedicine: boolean;
    emergency: boolean;
  };
  telemedicineEligible: boolean;
  compactEligible: boolean;
  readinessScore: number;
  availability: {
    status: 'available' | 'limited' | 'unavailable';
    nextAvailable?: string;
  };
}

export default function FacilityMarketplacePage() {
  const { toast } = useToast();
  const [results, setResults] = useState<ClinicianResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    specialty: '',
    state: '',
    minTrustScore: 0.7,
    telemedicineEligible: false,
    icuPrivileges: false,
    orPrivileges: false,
    deaActive: false,
    compactReady: false,
    riskScore: 'medium' as 'low' | 'medium' | 'high',
  });
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  useEffect(() => {
    void loadResults();
  }, [filters]);

  async function loadResults() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        facilityId: 'demo-facility',
        ...(filters.specialty && { specialty: filters.specialty }),
        ...(filters.state && { state: filters.state }),
        minTrustScore: String(filters.minTrustScore),
        telemedicine: String(filters.telemedicineEligible),
        icu: String(filters.icuPrivileges),
        or: String(filters.orPrivileges),
        dea: String(filters.deaActive),
        compact: String(filters.compactReady),
        riskScore: filters.riskScore,
        limit: '50',
      });

      const response = await fetch(`${API_BASE}/api/marketplace/facility/browse?${params}`);
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }
      const data = await response.json();
      setResults(data.results || []);
    } catch (err) {
      console.error('[marketplace][facility] load failed', err);
      toast({
        title: 'Unable to load clinicians',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function toggleFavorite(clinicianId: string) {
    const isFavorite = favorites.has(clinicianId);
    const newFavorites = new Set(favorites);

    if (isFavorite) {
      newFavorites.delete(clinicianId);
    } else {
      newFavorites.add(clinicianId);
    }

    setFavorites(newFavorites);

    try {
      await fetch(`${API_BASE}/api/marketplace/facility/favorites`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          facilityId: 'demo-facility',
          clinicianId,
        }),
      });
    } catch (err) {
      console.error('[marketplace][facility] favorite toggle failed', err);
    }
  }

  const filteredResults = useMemo(() => {
    let filtered = results;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(r =>
        r.specialty.some(s => s.toLowerCase().includes(query)) ||
        r.clinicianId.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [results, searchQuery]);

  return (
    <div className="container mx-auto max-w-7xl space-y-6 py-6">
      <header className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Facility Marketplace</h1>
            <p className="text-muted-foreground">
              Browse pre-verified clinicians with trust-weighted matching
            </p>
          </div>
          <Button onClick={() => loadResults()} disabled={loading}>
            Refresh
          </Button>
        </div>
      </header>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Search & Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search by specialty or clinician ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>
            <Select
              value={filters.specialty}
              onValueChange={(value) => setFilters((prev) => ({ ...prev, specialty: value }))}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Specialty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Specialties</SelectItem>
                <SelectItem value="Internal Medicine">Internal Medicine</SelectItem>
                <SelectItem value="Emergency Medicine">Emergency Medicine</SelectItem>
                <SelectItem value="Critical Care">Critical Care</SelectItem>
                <SelectItem value="Psychiatry">Psychiatry</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.state}
              onValueChange={(value) => setFilters((prev) => ({ ...prev, state: value }))}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="State" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All States</SelectItem>
                <SelectItem value="CA">California</SelectItem>
                <SelectItem value="NY">New York</SelectItem>
                <SelectItem value="TX">Texas</SelectItem>
                <SelectItem value="FL">Florida</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filter Chips */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant={filters.telemedicineEligible ? 'default' : 'outline'}
              size="sm"
              onClick={() =>
                setFilters((prev) => ({
                  ...prev,
                  telemedicineEligible: !prev.telemedicineEligible,
                }))
              }
            >
              <Globe className="mr-2 h-4 w-4" />
              Telemedicine Eligible
            </Button>
            <Button
              variant={filters.icuPrivileges ? 'default' : 'outline'}
              size="sm"
              onClick={() =>
                setFilters((prev) => ({ ...prev, icuPrivileges: !prev.icuPrivileges }))
              }
            >
              <Building2 className="mr-2 h-4 w-4" />
              ICU Privileges
            </Button>
            <Button
              variant={filters.orPrivileges ? 'default' : 'outline'}
              size="sm"
              onClick={() =>
                setFilters((prev) => ({ ...prev, orPrivileges: !prev.orPrivileges }))
              }
            >
              <Building2 className="mr-2 h-4 w-4" />
              OR Privileges
            </Button>
            <Button
              variant={filters.deaActive ? 'default' : 'outline'}
              size="sm"
              onClick={() =>
                setFilters((prev) => ({ ...prev, deaActive: !prev.deaActive }))
              }
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              DEA Active
            </Button>
            <Button
              variant={filters.compactReady ? 'default' : 'outline'}
              size="sm"
              onClick={() =>
                setFilters((prev) => ({ ...prev, compactReady: !prev.compactReady }))
              }
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Compact Ready
            </Button>
          </div>

          {/* Risk Score Filter */}
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">Risk Tolerance:</span>
            <div className="flex gap-2">
              {(['low', 'medium', 'high'] as const).map((risk) => (
                <Button
                  key={risk}
                  variant={filters.riskScore === risk ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilters((prev) => ({ ...prev, riskScore: risk }))}
                >
                  {risk.charAt(0).toUpperCase() + risk.slice(1)}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))
        ) : filteredResults.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="py-12 text-center">
              <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-muted-foreground">No clinicians found</p>
            </CardContent>
          </Card>
        ) : (
          filteredResults.map((clinician) => (
            <ClinicianCard
              key={clinician.clinicianId}
              clinician={clinician}
              isFavorite={favorites.has(clinician.clinicianId)}
              onToggleFavorite={() => toggleFavorite(clinician.clinicianId)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ClinicianCard({
  clinician,
  isFavorite,
  onToggleFavorite,
}: {
  clinician: ClinicianResult;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}) {
  const matchScore = clinician.matchScore?.overall ?? 0;
  const isReadyToOnboard = matchScore >= 0.85 && clinician.readinessScore >= 0.9;

  return (
    <Card className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 z-10"
        onClick={onToggleFavorite}
      >
        <Heart
          className={`h-5 w-5 ${isFavorite ? 'fill-red-500 text-red-500' : ''}`}
        />
      </Button>

      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">
              {clinician.clinicianId.slice(0, 12)}...
            </CardTitle>
            <CardDescription className="mt-1">
              {clinician.specialty.join(', ')}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Match Score */}
        {clinician.matchScore && (
          <div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Match Score</span>
              <span className="font-semibold">
                {(matchScore * 100).toFixed(1)}%
              </span>
            </div>
            <Progress value={matchScore * 100} className="mt-1 h-2" />
          </div>
        )}

        {/* Trust Score */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground flex items-center gap-1">
            <ShieldCheck className="h-4 w-4" />
            Trust Score
          </span>
          <span className="font-semibold">
            {(clinician.trustScore * 100).toFixed(1)}%
          </span>
        </div>

        {/* Readiness */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground flex items-center gap-1">
            <Clock className="h-4 w-4" />
            Readiness
          </span>
          <span className="font-semibold">
            {(clinician.readinessScore * 100).toFixed(1)}%
          </span>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-2">
          {isReadyToOnboard && (
            <Badge className="bg-emerald-500">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Ready-to-Onboard
            </Badge>
          )}
          {clinician.telemedicineEligible && (
            <Badge variant="secondary">
              <Globe className="mr-1 h-3 w-3" />
              Telemedicine
            </Badge>
          )}
          {clinician.compactEligible && (
            <Badge variant="secondary">
              <Sparkles className="mr-1 h-3 w-3" />
              Compact
            </Badge>
          )}
          {clinician.privileges.icu && (
            <Badge variant="outline">ICU</Badge>
          )}
          {clinician.privileges.or && (
            <Badge variant="outline">OR</Badge>
          )}
        </div>

        {/* Availability */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>
            {clinician.availability.status === 'available'
              ? 'Available now'
              : clinician.availability.status === 'limited'
              ? `Available ${clinician.availability.nextAvailable || 'soon'}`
              : 'Unavailable'}
          </span>
        </div>

        {/* Match Score Breakdown */}
        {clinician.matchScore && (
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground">
              Match breakdown
            </summary>
            <div className="mt-2 space-y-1">
              <div className="flex justify-between">
                <span>Credentials:</span>
                <span>{(clinician.matchScore.breakdown.credentials * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span>Trust Trajectory:</span>
                <span>{(clinician.matchScore.breakdown.trustTrajectory * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span>Skills:</span>
                <span>{(clinician.matchScore.breakdown.skillCompetency * 100).toFixed(1)}%</span>
              </div>
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

