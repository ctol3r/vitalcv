'use client'

import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ForecastAlerts, type ForecastAlert } from '@/components/forecast/ForecastAlerts'
import { cn } from '@/lib/utils'
import { ArrowUpRight, Building2, MapPin, TrendingDown, UsersRound } from 'lucide-react'

interface ShortageByRegion {
  region: string
  state: string
  facility: string
  orgId: string
  orgName: string
  shortage: number
  affectedRoles: string[]
  severity: 'critical' | 'high' | 'medium'
  mobilityOptions: number
  compactEligible: number
  forecastDate: string
}

interface MobilityCompact {
  orgId: string
  orgName: string
  region: string
  compactStates: string[]
  mobilityReady: number
  crossOrgMobility: boolean
}

const SHORTAGES_BY_REGION: ShortageByRegion[] = [
  {
    region: 'Northeast',
    state: 'NY',
    facility: 'Metro General',
    orgId: 'org-1',
    orgName: 'Metro Health System',
    shortage: 24,
    affectedRoles: ['ICU Intensivist', 'Emergency MD', 'Cath Lab Card'],
    severity: 'critical',
    mobilityOptions: 8,
    compactEligible: 12,
    forecastDate: '2025-12-15',
  },
  {
    region: 'Northeast',
    state: 'MA',
    facility: 'Boston Medical',
    orgId: 'org-2',
    orgName: 'Boston Care Network',
    shortage: 18,
    affectedRoles: ['Behavioral Health', 'Telehealth APP'],
    severity: 'high',
    mobilityOptions: 5,
    compactEligible: 8,
    forecastDate: '2025-12-20',
  },
  {
    region: 'Southeast',
    state: 'FL',
    facility: 'Coastal Regional',
    orgId: 'org-3',
    orgName: 'Coastal Health',
    shortage: 15,
    affectedRoles: ['Hospitalist', 'Med/Surg RN'],
    severity: 'medium',
    mobilityOptions: 12,
    compactEligible: 20,
    forecastDate: '2025-12-10',
  },
  {
    region: 'West',
    state: 'CA',
    facility: 'Pacific Medical',
    orgId: 'org-4',
    orgName: 'Pacific Health System',
    shortage: 32,
    affectedRoles: ['ICU Intensivist', 'ED MD', 'Cath Lab Card', 'Behavioral Health'],
    severity: 'critical',
    mobilityOptions: 6,
    compactEligible: 10,
    forecastDate: '2025-12-25',
  },
  {
    region: 'Midwest',
    state: 'IL',
    facility: 'Chicago Central',
    orgId: 'org-5',
    orgName: 'Central Health Network',
    shortage: 12,
    affectedRoles: ['Telehealth APP'],
    severity: 'medium',
    mobilityOptions: 15,
    compactEligible: 18,
    forecastDate: '2025-12-05',
  },
]

const MOBILITY_COMPACTS: MobilityCompact[] = [
  {
    orgId: 'org-1',
    orgName: 'Metro Health System',
    region: 'Northeast',
    compactStates: ['NY', 'NJ', 'CT', 'PA'],
    mobilityReady: 45,
    crossOrgMobility: true,
  },
  {
    orgId: 'org-2',
    orgName: 'Boston Care Network',
    region: 'Northeast',
    compactStates: ['MA', 'NH', 'VT', 'ME'],
    mobilityReady: 32,
    crossOrgMobility: true,
  },
  {
    orgId: 'org-3',
    orgName: 'Coastal Health',
    region: 'Southeast',
    compactStates: ['FL', 'GA', 'SC', 'NC'],
    mobilityReady: 58,
    crossOrgMobility: true,
  },
  {
    orgId: 'org-4',
    orgName: 'Pacific Health System',
    region: 'West',
    compactStates: ['CA', 'OR', 'WA', 'NV'],
    mobilityReady: 28,
    crossOrgMobility: true,
  },
  {
    orgId: 'org-5',
    orgName: 'Central Health Network',
    region: 'Midwest',
    compactStates: ['IL', 'IN', 'WI', 'MI'],
    mobilityReady: 62,
    crossOrgMobility: true,
  },
]

const SYSTEM_ALERTS: ForecastAlert[] = [
  {
    id: 'system-alert-1',
    type: 'critical_demand',
    severity: 'critical',
    title: 'Multi-org ICU shortage across West region',
    description: '4 organizations in CA, OR, WA reporting critical ICU intensivist shortages. Total gap: 32 FTE.',
    affectedCount: 32,
    impactDate: '2025-12-25',
    timestamp: new Date().toISOString(),
    actionable: true,
  },
  {
    id: 'system-alert-2',
    type: 'supply_drop',
    severity: 'high',
    title: 'Northeast compact mobility constraints',
    description: 'License compact renewals affecting cross-org mobility in NY/NJ/CT region.',
    affectedCount: 18,
    impactDate: '2025-12-15',
    timestamp: new Date().toISOString(),
    actionable: true,
  },
]

const SEVERITY_COLORS: Record<ShortageByRegion['severity'], string> = {
  critical: 'bg-rose-100 text-rose-900 border-rose-200',
  high: 'bg-amber-100 text-amber-900 border-amber-200',
  medium: 'bg-sky-100 text-sky-900 border-sky-200',
}

export default function SystemForecastPage() {
  const [selectedRegion, setSelectedRegion] = useState<string>('all')
  const [selectedState, setSelectedState] = useState<string>('all')
  const [selectedSeverity, setSelectedSeverity] = useState<ShortageByRegion['severity'] | 'all'>('all')

  const regions = useMemo(() => {
    return Array.from(new Set(SHORTAGES_BY_REGION.map((s) => s.region)))
  }, [])

  const states = useMemo(() => {
    return Array.from(new Set(SHORTAGES_BY_REGION.map((s) => s.state)))
  }, [])

  const filteredShortages = useMemo(() => {
    return SHORTAGES_BY_REGION.filter((s) => {
      if (selectedRegion !== 'all' && s.region !== selectedRegion) return false
      if (selectedState !== 'all' && s.state !== selectedState) return false
      if (selectedSeverity !== 'all' && s.severity !== selectedSeverity) return false
      return true
    })
  }, [selectedRegion, selectedState, selectedSeverity])

  const totalShortage = filteredShortages.reduce((sum, s) => sum + s.shortage, 0)
  const totalMobilityOptions = filteredShortages.reduce((sum, s) => sum + s.mobilityOptions, 0)
  const totalCompactEligible = filteredShortages.reduce((sum, s) => sum + s.compactEligible, 0)

  const shortagesByRegion = useMemo(() => {
    const grouped: Record<string, ShortageByRegion[]> = {}
    filteredShortages.forEach((s) => {
      if (!grouped[s.region]) grouped[s.region] = []
      grouped[s.region].push(s)
    })
    return grouped
  }, [filteredShortages])

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Demo » System » Forecast</p>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <UsersRound className="h-6 w-6" /> System-Level Workforce Forecast Explorer
        </h1>
        <p className="text-muted-foreground max-w-3xl">
          Across multiple orgs: predicted shortages by region/state/facility. Integrates multi-org mobility + compacts
          for system-wide workforce planning.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Shortage</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-rose-600">{totalShortage}</div>
            <p className="text-xs text-muted-foreground">FTE across all orgs</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mobility Options</CardTitle>
            <UsersRound className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalMobilityOptions}</div>
            <p className="text-xs text-muted-foreground">Cross-org ready clinicians</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Compact Eligible</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalCompactEligible}</div>
            <p className="text-xs text-muted-foreground">License compact ready</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Organizations</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{SHORTAGES_BY_REGION.length}</div>
            <p className="text-xs text-muted-foreground">In forecast scope</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ForecastAlerts alerts={SYSTEM_ALERTS} />
        <Card>
          <CardHeader>
            <CardTitle>Multi-Org Mobility & Compacts</CardTitle>
            <CardDescription>Cross-organization mobility readiness and license compact coverage</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {MOBILITY_COMPACTS.map((compact) => (
                <div key={compact.orgId} className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{compact.orgName}</p>
                      <p className="text-xs text-muted-foreground">{compact.region}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {compact.mobilityReady} ready
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {compact.compactStates.map((state) => (
                      <Badge key={state} variant="outline" className="text-xs">
                        {state}
                      </Badge>
                    ))}
                  </div>
                  {compact.crossOrgMobility && (
                    <p className="text-xs text-muted-foreground">Cross-org mobility enabled</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Predicted Shortages by Region/State/Facility</CardTitle>
          <CardDescription>System-wide forecast with mobility and compact integration</CardDescription>
          <div className="flex flex-wrap gap-2 mt-4">
            <Button
              variant={selectedRegion === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedRegion('all')}
              className="text-xs"
            >
              All Regions
            </Button>
            {regions.map((region) => (
              <Button
                key={region}
                variant={selectedRegion === region ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedRegion(region)}
                className="text-xs"
              >
                {region}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            <Button
              variant={selectedState === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedState('all')}
              className="text-xs"
            >
              All States
            </Button>
            {states.map((state) => (
              <Button
                key={state}
                variant={selectedState === state ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedState(state)}
                className="text-xs"
              >
                {state}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            <Button
              variant={selectedSeverity === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedSeverity('all')}
              className="text-xs"
            >
              All Severities
            </Button>
            {(['critical', 'high', 'medium'] as const).map((severity) => (
              <Button
                key={severity}
                variant={selectedSeverity === severity ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedSeverity(severity)}
                className="text-xs"
              >
                {severity}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {Object.entries(shortagesByRegion).map(([region, shortages]) => (
              <div key={region} className="space-y-3">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  {region}
                </h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>State</TableHead>
                      <TableHead>Facility</TableHead>
                      <TableHead>Organization</TableHead>
                      <TableHead>Shortage</TableHead>
                      <TableHead>Affected Roles</TableHead>
                      <TableHead>Mobility</TableHead>
                      <TableHead>Compact</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shortages.map((shortage) => (
                      <TableRow key={`${shortage.orgId}-${shortage.facility}`}>
                        <TableCell className="font-medium">{shortage.state}</TableCell>
                        <TableCell>{shortage.facility}</TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium">{shortage.orgName}</p>
                            <p className="text-xs text-muted-foreground">{shortage.orgId}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="font-semibold text-rose-600">{shortage.shortage} FTE</p>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {shortage.affectedRoles.map((role) => (
                              <Badge key={role} variant="outline" className="text-xs">
                                {role}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm font-medium">{shortage.mobilityOptions}</p>
                          <p className="text-xs text-muted-foreground">options</p>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm font-medium">{shortage.compactEligible}</p>
                          <p className="text-xs text-muted-foreground">eligible</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn('text-xs', SEVERITY_COLORS[shortage.severity])}>
                            {shortage.severity}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm">
                            View <ArrowUpRight className="ml-1 h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

