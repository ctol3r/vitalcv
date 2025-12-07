'use client'

import { useMemo, useState } from 'react'
import { Search, Shield, Users, TrendingUp, TrendingDown, Filter, Eye, EyeOff } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type ReputationMetrics = {
  overall: number
  quality: number
  credential: number
  enrollment: number
  peer: number
}

type ClinicianSearchResult = {
  id: string
  name: string
  npi: string
  specialty: string
  reputation: ReputationMetrics
  sharingPolicy: {
    allowsOverall: boolean
    allowsBreakdown: boolean
    allowsComparison: boolean
  }
}

type OrgReputationData = {
  orgName: string
  authorizedMetrics: string[]
  clinicians: ClinicianSearchResult[]
  comparisonMode: boolean
  selectedClinicians: string[]
}

export default function OrgReputationExplorerPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedClinician, setSelectedClinician] = useState<ClinicianSearchResult | null>(null)
  const [comparisonMode, setComparisonMode] = useState(false)
  const [selectedForComparison, setSelectedForComparison] = useState<Set<string>>(new Set())

  const data = useMemo(() => buildMockData(), [])

  const filteredClinicians = useMemo(() => {
    if (!searchQuery.trim()) return data.clinicians
    const query = searchQuery.toLowerCase()
    return data.clinicians.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.npi.includes(query) ||
        c.specialty.toLowerCase().includes(query),
    )
  }, [searchQuery, data.clinicians])

  const toggleComparison = (clinicianId: string) => {
    const newSet = new Set(selectedForComparison)
    if (newSet.has(clinicianId)) {
      newSet.delete(clinicianId)
    } else {
      if (newSet.size >= 5) {
        alert('Maximum 5 clinicians can be compared at once')
        return
      }
      newSet.add(clinicianId)
    }
    setSelectedForComparison(newSet)
    setComparisonMode(newSet.size > 0)
  }

  const comparisonData = useMemo(() => {
    if (!comparisonMode) return []
    return data.clinicians.filter((c) => selectedForComparison.has(c.id))
  }, [comparisonMode, selectedForComparison, data.clinicians])

  return (
    <div className="container mx-auto space-y-8 py-8">
      <header className="space-y-4">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Demo • Organization • Reputation Explorer</p>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Shield className="h-8 w-8 text-primary" aria-hidden="true" />
              Reputation Explorer
            </h1>
            <p className="text-muted-foreground max-w-2xl">
              Search and view clinician reputation metrics according to sharing policies. Compare candidates side-by-side for credentialing
              decisions.
            </p>
          </div>
          {comparisonMode && (
            <Button variant="outline" onClick={() => {
              setComparisonMode(false)
              setSelectedForComparison(new Set())
            }}>
              Clear Comparison
            </Button>
          )}
        </div>
      </header>

      {/* Search Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, NPI, or specialty..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comparison View */}
      {comparisonMode && comparisonData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Comparison View</CardTitle>
            <CardDescription>Side-by-side comparison of selected clinicians.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Clinician</TableHead>
                    <TableHead>Overall</TableHead>
                    <TableHead>Quality</TableHead>
                    <TableHead>Credential</TableHead>
                    <TableHead>Enrollment</TableHead>
                    <TableHead>Peer</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparisonData.map((clinician) => (
                    <TableRow key={clinician.id}>
                      <TableCell>
                        <div>
                          <p className="font-semibold">{clinician.name}</p>
                          <p className="text-sm text-muted-foreground">{clinician.specialty}</p>
                          <p className="text-xs text-muted-foreground">NPI: {clinician.npi}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span className="font-semibold">{clinician.reputation.overall.toFixed(1)}</span>
                          {clinician.reputation.overall >= 85 ? (
                            <TrendingUp className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-amber-600" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {clinician.sharingPolicy.allowsBreakdown ? (
                          <span>{clinician.reputation.quality.toFixed(1)}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {clinician.sharingPolicy.allowsBreakdown ? (
                          <span>{clinician.reputation.credential.toFixed(1)}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {clinician.sharingPolicy.allowsBreakdown ? (
                          <span>{clinician.reputation.enrollment.toFixed(1)}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {clinician.sharingPolicy.allowsBreakdown ? (
                          <span>{clinician.reputation.peer.toFixed(1)}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Clinician List */}
      <Card>
        <CardHeader>
          <CardTitle>Clinicians</CardTitle>
          <CardDescription>
            {filteredClinicians.length} {filteredClinicians.length === 1 ? 'clinician' : 'clinicians'} found. Select up to 5 to compare.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredClinicians.map((clinician) => {
              const isSelected = selectedForComparison.has(clinician.id)
              const canViewOverall = clinician.sharingPolicy.allowsOverall
              const canViewBreakdown = clinician.sharingPolicy.allowsBreakdown
              const canCompare = clinician.sharingPolicy.allowsComparison

              return (
                <div key={clinician.id} className="rounded-md border p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="font-semibold">{clinician.name}</p>
                          <p className="text-sm text-muted-foreground">{clinician.specialty}</p>
                          <p className="text-xs text-muted-foreground">NPI: {clinician.npi}</p>
                        </div>
                        {canViewOverall && (
                          <div className="flex items-center gap-2">
                            <Badge variant="default" className="text-lg px-3 py-1">
                              {clinician.reputation.overall.toFixed(1)}
                            </Badge>
                            <span className="text-sm text-muted-foreground">Overall</span>
                          </div>
                        )}
                        {!canViewOverall && (
                          <Badge variant="secondary">
                            <EyeOff className="h-3 w-3 mr-1" />
                            Restricted
                          </Badge>
                        )}
                      </div>

                      {canViewBreakdown && (
                        <div className="grid grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Quality</p>
                            <p className="font-medium">{clinician.reputation.quality.toFixed(1)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Credential</p>
                            <p className="font-medium">{clinician.reputation.credential.toFixed(1)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Enrollment</p>
                            <p className="font-medium">{clinician.reputation.enrollment.toFixed(1)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Peer</p>
                            <p className="font-medium">{clinician.reputation.peer.toFixed(1)}</p>
                          </div>
                        </div>
                      )}

                      {!canViewBreakdown && canViewOverall && (
                        <p className="text-sm text-muted-foreground">
                          Detailed breakdown not available per sharing policy
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedClinician(clinician)}
                      >
                        View Details
                      </Button>
                      {canCompare && (
                        <Button
                          size="sm"
                          variant={isSelected ? 'default' : 'outline'}
                          onClick={() => toggleComparison(clinician.id)}
                          disabled={!isSelected && selectedForComparison.size >= 5}
                        >
                          {isSelected ? 'Remove' : 'Compare'}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={Boolean(selectedClinician)} onOpenChange={(open) => !open && setSelectedClinician(null)}>
        {selectedClinician && (
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedClinician.name}</DialogTitle>
              <DialogDescription>
                {selectedClinician.specialty} • NPI: {selectedClinician.npi}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <section>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">Reputation Metrics</h3>
                <div className="grid grid-cols-2 gap-4">
                  {selectedClinician.sharingPolicy.allowsOverall && (
                    <div className="rounded-md border p-3">
                      <p className="text-sm text-muted-foreground">Overall Score</p>
                      <p className="text-2xl font-bold">{selectedClinician.reputation.overall.toFixed(1)}</p>
                    </div>
                  )}
                  {selectedClinician.sharingPolicy.allowsBreakdown && (
                    <>
                      <div className="rounded-md border p-3">
                        <p className="text-sm text-muted-foreground">Quality</p>
                        <p className="text-xl font-semibold">{selectedClinician.reputation.quality.toFixed(1)}</p>
                      </div>
                      <div className="rounded-md border p-3">
                        <p className="text-sm text-muted-foreground">Credential</p>
                        <p className="text-xl font-semibold">{selectedClinician.reputation.credential.toFixed(1)}</p>
                      </div>
                      <div className="rounded-md border p-3">
                        <p className="text-sm text-muted-foreground">Enrollment</p>
                        <p className="text-xl font-semibold">{selectedClinician.reputation.enrollment.toFixed(1)}</p>
                      </div>
                      <div className="rounded-md border p-3">
                        <p className="text-sm text-muted-foreground">Peer</p>
                        <p className="text-xl font-semibold">{selectedClinician.reputation.peer.toFixed(1)}</p>
                      </div>
                    </>
                  )}
                </div>
              </section>
              <section>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">Sharing Policy</h3>
                <div className="space-y-1 text-sm">
                  <p>
                    Overall Score: {selectedClinician.sharingPolicy.allowsOverall ? 'Visible' : 'Restricted'}
                  </p>
                  <p>
                    Detailed Breakdown: {selectedClinician.sharingPolicy.allowsBreakdown ? 'Visible' : 'Restricted'}
                  </p>
                  <p>
                    Comparison: {selectedClinician.sharingPolicy.allowsComparison ? 'Allowed' : 'Not Allowed'}
                  </p>
                </div>
              </section>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}

function buildMockData(): OrgReputationData {
  return {
    orgName: 'Northwind Medical Center',
    authorizedMetrics: ['overall', 'quality', 'credential', 'enrollment', 'peer'],
    clinicians: [
      {
        id: 'c1',
        name: 'Dr. Sarah Chen',
        npi: '1750392145',
        specialty: 'Cardiology',
        reputation: {
          overall: 86.2,
          quality: 88.5,
          credential: 91.0,
          enrollment: 83.5,
          peer: 81.0,
        },
        sharingPolicy: {
          allowsOverall: true,
          allowsBreakdown: true,
          allowsComparison: true,
        },
      },
      {
        id: 'c2',
        name: 'Dr. Michael Rodriguez',
        npi: '1987654321',
        specialty: 'Emergency Medicine',
        reputation: {
          overall: 82.5,
          quality: 85.0,
          credential: 88.0,
          enrollment: 79.0,
          peer: 78.0,
        },
        sharingPolicy: {
          allowsOverall: true,
          allowsBreakdown: true,
          allowsComparison: true,
        },
      },
      {
        id: 'c3',
        name: 'Dr. Emily Johnson',
        npi: '1234567890',
        specialty: 'Pediatrics',
        reputation: {
          overall: 90.1,
          quality: 92.0,
          credential: 89.5,
          enrollment: 88.0,
          peer: 91.0,
        },
        sharingPolicy: {
          allowsOverall: true,
          allowsBreakdown: false,
          allowsComparison: true,
        },
      },
      {
        id: 'c4',
        name: 'Dr. James Wilson',
        npi: '1122334455',
        specialty: 'Orthopedics',
        reputation: {
          overall: 78.5,
          quality: 80.0,
          credential: 85.0,
          enrollment: 75.0,
          peer: 74.0,
        },
        sharingPolicy: {
          allowsOverall: true,
          allowsBreakdown: true,
          allowsComparison: false,
        },
      },
      {
        id: 'c5',
        name: 'Dr. Lisa Anderson',
        npi: '5566778899',
        specialty: 'Internal Medicine',
        reputation: {
          overall: 88.8,
          quality: 90.0,
          credential: 87.5,
          enrollment: 89.0,
          peer: 89.0,
        },
        sharingPolicy: {
          allowsOverall: false,
          allowsBreakdown: false,
          allowsComparison: false,
        },
      },
    ],
    comparisonMode: false,
    selectedClinicians: [],
  }
}

