'use client';

import { useMemo, useState } from 'react';
import { Filter, Globe, MapPin, Shield, SlidersHorizontal, Zap } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';

interface CandidateProfile {
  id: string;
  name: string;
  specialty: string;
  mobilityScore: number;
  states: string[];
  compacts: string[];
  reciprocity: string[];
  waiverReady: string[];
  updatedAt: string;
}

const SAMPLE_PROFILES: CandidateProfile[] = [
  {
    id: 'vc-1042',
    name: 'Dr. Alicia Meyers',
    specialty: 'Hospitalist · IM',
    mobilityScore: 88,
    states: ['CA', 'WA', 'CO', 'AZ'],
    compacts: ['IMLC', 'PTC'],
    reciprocity: ['UK→US'],
    waiverReady: ['CA-DISASTER', 'WA-TELEHEALTH'],
    updatedAt: '2025-11-24T14:04:00Z',
  },
  {
    id: 'vc-2310',
    name: 'Nurse Akshara Singh',
    specialty: 'Critical care RN',
    mobilityScore: 81,
    states: ['TX', 'FL', 'GA'],
    compacts: ['NLC'],
    reciprocity: ['AU→US'],
    waiverReady: ['FL-HURRICANE'],
    updatedAt: '2025-11-22T09:12:00Z',
  },
  {
    id: 'vc-3099',
    name: 'Dr. Samuel Lee',
    specialty: 'Tele-psych · Behavioral',
    mobilityScore: 76,
    states: ['WA', 'OR'],
    compacts: ['PSYPACT'],
    reciprocity: ['SG→US'],
    waiverReady: ['WA-TELEHEALTH'],
    updatedAt: '2025-11-20T19:43:00Z',
  },
  {
    id: 'vc-1228',
    name: 'OT Maya Patel',
    specialty: 'Occupational therapy',
    mobilityScore: 72,
    states: ['CA', 'NV', 'UT'],
    compacts: ['AOTA'],
    reciprocity: [],
    waiverReady: [],
    updatedAt: '2025-11-18T08:30:00Z',
  },
];

const ALL_STATES = Array.from(
  new Set(SAMPLE_PROFILES.flatMap((profile) => profile.states)),
).sort();

const ALL_COMPACTS = ['IMLC', 'NLC', 'PSYPACT', 'PTC', 'AOTA'];

export default function EmployerMobilityFilterPage() {
  const [selectedState, setSelectedState] = useState<string>('ANY');
  const [minimumScore, setMinimumScore] = useState(70);
  const [requiredCompacts, setRequiredCompacts] = useState<string[]>([]);
  const [waiverOnly, setWaiverOnly] = useState(false);

  const filteredProfiles = useMemo(() => {
    return SAMPLE_PROFILES.filter((profile) => {
      if (profile.mobilityScore < minimumScore) return false;
      if (selectedState !== 'ANY' && !profile.states.includes(selectedState)) return false;
      if (requiredCompacts.length && !requiredCompacts.every((compact) => profile.compacts.includes(compact))) {
        return false;
      }
      if (waiverOnly && profile.waiverReady.length === 0) return false;
      return true;
    });
  }, [minimumScore, requiredCompacts, selectedState, waiverOnly]);

  const toggleCompact = (compact: string) => {
    setRequiredCompacts((prev) =>
      prev.includes(compact) ? prev.filter((entry) => entry !== compact) : [...prev, compact],
    );
  };

  return (
    <div className="container max-w-5xl space-y-8 py-10">
      <header className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary">Employer · Filters</Badge>
          <span className="flex items-center gap-1">
            <Zap className="h-3.5 w-3.5 text-primary" />
            Instant routing
          </span>
        </div>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Mobility filter</h1>
          <p className="text-muted-foreground">
            Slice your talent graph by compact readiness, reciprocity corridors, and waiver eligibility before outreach.
          </p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            Filters
          </CardTitle>
          <CardDescription>Combine compact coverage with geographic and waiver signals.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <Label htmlFor="state">State focus</Label>
            <Select value={selectedState} onValueChange={setSelectedState}>
              <SelectTrigger id="state">
                <SelectValue placeholder="Any state" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ANY">Any state</SelectItem>
                {ALL_STATES.map((state) => (
                  <SelectItem key={state} value={state}>
                    {state}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label>Minimum mobility score ({minimumScore})</Label>
            <Slider
              value={[minimumScore]}
              min={50}
              max={100}
              step={1}
              onValueChange={(values) => setMinimumScore(values[0] ?? 70)}
            />
          </div>

          <div className="space-y-3">
            <Label>Required compacts</Label>
            <div className="flex flex-wrap gap-2">
              {ALL_COMPACTS.map((compact) => (
                <Button
                  key={compact}
                  type="button"
                  variant={requiredCompacts.includes(compact) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => toggleCompact(compact)}
                >
                  {compact}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <Label className="text-base">Show waiver-ready only</Label>
              <p className="text-sm text-muted-foreground">Filter to clinicians with active disaster waivers.</p>
            </div>
            <Switch checked={waiverOnly} onCheckedChange={setWaiverOnly} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Matches ({filteredProfiles.length})</CardTitle>
            <CardDescription>{filteredProfiles.length ? 'Sorted by mobility score' : 'No matches for current filters'}</CardDescription>
          </div>
          <div className="flex gap-2">
            <Badge variant="secondary" className="flex items-center gap-1">
              <Filter className="h-3.5 w-3.5" />
              {selectedState === 'ANY' ? 'Nationwide' : selectedState}
            </Badge>
            <Badge variant="secondary" className="flex items-center gap-1">
              <Shield className="h-3.5 w-3.5" />
              Score ≥ {minimumScore}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {filteredProfiles.map((profile) => (
            <div key={profile.id} className="rounded-xl border p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-lg font-semibold">{profile.name}</p>
                  <p className="text-sm text-muted-foreground">{profile.specialty}</p>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Badge className="text-base font-semibold">{profile.mobilityScore}</Badge>
                  <span className="text-muted-foreground">mobility score</span>
                </div>
              </div>

              <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
                <div>
                  <p className="mb-1 text-muted-foreground">States</p>
                  <div className="flex flex-wrap gap-1">
                    {profile.states.map((state) => (
                      <Badge key={state} variant="outline">
                        {state}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-muted-foreground">Compacts</p>
                  <div className="flex flex-wrap gap-1">
                    {profile.compacts.map((compact) => (
                      <Badge key={compact} variant="secondary">
                        {compact}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1 text-muted-foreground">Waivers</p>
                  {profile.waiverReady.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {profile.waiverReady.map((waiver) => (
                        <Badge key={waiver} variant="outline">
                          {waiver}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No active waivers</p>
                  )}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  Updated {new Date(profile.updatedAt).toLocaleString()}
                </div>
                <div className="flex items-center gap-2">
                  {profile.reciprocity.length > 0 && (
                    <span className="flex items-center gap-1">
                      <Globe className="h-3 w-3" />
                      {profile.reciprocity.join(', ')}
                    </span>
                  )}
                  <Button size="sm" variant="outline">
                    View passport
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

