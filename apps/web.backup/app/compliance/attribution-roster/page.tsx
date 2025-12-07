"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Users,
  Plus,
  Minus,
  RefreshCw,
  Calendar,
  FileText,
  Download,
  Search,
  AlertCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { FhirPipelineBadge } from "@/components/FhirPipelineBadge"

interface RosterMember {
  npi: string
  name: string
  specialty?: string
  status: "active" | "inactive" | "pending"
  effectiveDate?: string
  terminationDate?: string
}

interface RosterDiff {
  added: RosterMember[]
  removed: RosterMember[]
  modified: Array<{
    member: RosterMember
    changes: string[]
  }>
}

interface AttributionRoster {
  id: string
  payerName: string
  rosterName: string
  lastUpdated: string
  totalMembers: number
  activeMembers: number
  members: RosterMember[]
  diff?: RosterDiff
  freshnessBadge?: {
    daysSinceUpdate: number
    status: "fresh" | "stale" | "very-stale"
  }
  evidenceId?: string
}

export default function AttributionRosterViewer() {
  const [rosters, setRosters] = useState<AttributionRoster[]>([])
  const [selectedRoster, setSelectedRoster] = useState<AttributionRoster | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"current" | "diff">("current")

  useEffect(() => {
    // Mock data - replace with actual API call
    const fetchRosters = async () => {
      try {
        // const response = await fetch('/api/fhir/atr/rosters');
        // const data = await response.json();
        // setRosters(data);

        // Mock data
        setTimeout(() => {
          setRosters([
            {
              id: "roster-1",
              payerName: "Blue Cross Blue Shield",
              rosterName: "Primary Care Network Q1 2025",
              lastUpdated: "2025-01-08T10:00:00Z",
              totalMembers: 245,
              activeMembers: 238,
              members: [
                {
                  npi: "1234567890",
                  name: "Dr. Jane Smith",
                  specialty: "Family Medicine",
                  status: "active",
                  effectiveDate: "2024-01-01",
                },
                {
                  npi: "0987654321",
                  name: "Dr. John Doe",
                  specialty: "Internal Medicine",
                  status: "active",
                  effectiveDate: "2024-02-15",
                },
              ],
              diff: {
                added: [
                  {
                    npi: "1122334455",
                    name: "Dr. Sarah Johnson",
                    specialty: "Pediatrics",
                    status: "active",
                    effectiveDate: "2025-01-08",
                  },
                ],
                removed: [
                  {
                    npi: "5566778899",
                    name: "Dr. Michael Brown",
                    specialty: "Cardiology",
                    status: "inactive",
                    terminationDate: "2025-01-01",
                  },
                ],
                modified: [
                  {
                    member: {
                      npi: "1234567890",
                      name: "Dr. Jane Smith",
                      specialty: "Family Medicine",
                      status: "active",
                    },
                    changes: ["Specialty updated", "Effective date changed"],
                  },
                ],
              },
              freshnessBadge: {
                daysSinceUpdate: 1,
                status: "fresh",
              },
              evidenceId: "evidence-123",
            },
          ])
          setLoading(false)
        }, 500)
      } catch (error) {
        console.error("Failed to fetch rosters:", error)
        setLoading(false)
      }
    }

    fetchRosters()
  }, [])

  const filteredMembers = selectedRoster
    ? selectedRoster.members.filter(
        (member) =>
          member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          member.npi.includes(searchQuery),
      )
    : []

  const getFreshnessBadge = (badge?: AttributionRoster["freshnessBadge"]) => {
    if (!badge) return null

    const colors = {
      fresh: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      stale: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
      "very-stale": "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    }

    return (
      <Badge className={colors[badge.status]}>
        {badge.daysSinceUpdate === 0
          ? "Updated today"
          : badge.daysSinceUpdate === 1
            ? "Updated yesterday"
            : `Updated ${badge.daysSinceUpdate} days ago`}
      </Badge>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Users className="h-8 w-8" />
          Attribution Roster Viewer
        </h1>
        <p className="text-muted-foreground">
          View and manage payer attribution rosters with change tracking
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading rosters...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Roster List */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Rosters</CardTitle>
                <CardDescription>Select a roster to view details</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px]">
                  <div className="space-y-2">
                    {rosters.map((roster) => (
                      <button
                        key={roster.id}
                        onClick={() => {
                          setSelectedRoster(roster)
                          setActiveTab("current")
                        }}
                        className={cn(
                          "w-full text-left p-4 rounded-lg border-2 transition-all",
                          selectedRoster?.id === roster.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50",
                        )}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-sm">{roster.payerName}</h3>
                            {roster.freshnessBadge && getFreshnessBadge(roster.freshnessBadge)}
                          </div>
                          <p className="text-xs text-muted-foreground">{roster.rosterName}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Users className="h-3 w-3" />
                            <span>
                              {roster.activeMembers} / {roster.totalMembers} active
                            </span>
                          </div>
                          {roster.diff && (
                            <div className="flex gap-1 mt-2">
                              {roster.diff.added.length > 0 && (
                                <Badge variant="outline" className="text-xs bg-green-50">
                                  <Plus className="h-3 w-3 mr-1" />
                                  {roster.diff.added.length}
                                </Badge>
                              )}
                              {roster.diff.removed.length > 0 && (
                                <Badge variant="outline" className="text-xs bg-red-50">
                                  <Minus className="h-3 w-3 mr-1" />
                                  {roster.diff.removed.length}
                                </Badge>
                              )}
                              {roster.diff.modified.length > 0 && (
                                <Badge variant="outline" className="text-xs bg-amber-50">
                                  <RefreshCw className="h-3 w-3 mr-1" />
                                  {roster.diff.modified.length}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Roster Details */}
          <div className="lg:col-span-2">
            {selectedRoster ? (
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-2xl mb-2">{selectedRoster.payerName}</CardTitle>
                      <CardDescription>{selectedRoster.rosterName}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedRoster.evidenceId && (
                        <FhirPipelineBadge evidenceId={selectedRoster.evidenceId} />
                      )}
                      {getFreshnessBadge(selectedRoster.freshnessBadge)}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span>
                        Last updated: {new Date(selectedRoster.lastUpdated).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      <span>
                        {selectedRoster.activeMembers} active / {selectedRoster.totalMembers} total
                      </span>
                    </div>
                  </div>
                </CardHeader>

                <CardContent>
                  <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                    <TabsList>
                      <TabsTrigger value="current">Current Roster</TabsTrigger>
                      {selectedRoster.diff && (
                        <TabsTrigger value="diff">
                          Changes
                          {(selectedRoster.diff.added.length +
                            selectedRoster.diff.removed.length +
                            selectedRoster.diff.modified.length) > 0 && (
                            <Badge variant="secondary" className="ml-2">
                              {selectedRoster.diff.added.length +
                                selectedRoster.diff.removed.length +
                                selectedRoster.diff.modified.length}
                            </Badge>
                          )}
                        </TabsTrigger>
                      )}
                    </TabsList>

                    <TabsContent value="current" className="mt-6">
                      <div className="mb-4">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search by name or NPI..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                          />
                        </div>
                      </div>

                      <ScrollArea className="h-[500px]">
                        <div className="space-y-2">
                          {filteredMembers.map((member) => (
                            <div
                              key={member.npi}
                              className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium">{member.name}</span>
                                  <Badge
                                    variant={
                                      member.status === "active"
                                        ? "default"
                                        : member.status === "inactive"
                                          ? "secondary"
                                          : "outline"
                                    }
                                  >
                                    {member.status}
                                  </Badge>
                                </div>
                                <div className="text-sm text-muted-foreground space-y-0.5">
                                  <div>NPI: {member.npi}</div>
                                  {member.specialty && <div>Specialty: {member.specialty}</div>}
                                  {member.effectiveDate && (
                                    <div>Effective: {new Date(member.effectiveDate).toLocaleDateString()}</div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                          {filteredMembers.length === 0 && (
                            <div className="text-center py-8 text-muted-foreground">
                              No members found
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </TabsContent>

                    {selectedRoster.diff && (
                      <TabsContent value="diff" className="mt-6">
                        <ScrollArea className="h-[500px]">
                          <div className="space-y-6">
                            {/* Added Members */}
                            {selectedRoster.diff.added.length > 0 && (
                              <div>
                                <h3 className="font-semibold mb-3 flex items-center gap-2">
                                  <Plus className="h-4 w-4 text-green-600" />
                                  Added ({selectedRoster.diff.added.length})
                                </h3>
                                <div className="space-y-2">
                                  {selectedRoster.diff.added.map((member) => (
                                    <div
                                      key={member.npi}
                                      className="p-3 rounded-lg border border-green-200 bg-green-50 dark:bg-green-950"
                                    >
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="font-medium">{member.name}</span>
                                        <Badge className="bg-green-600">New</Badge>
                                      </div>
                                      <div className="text-sm text-muted-foreground">
                                        NPI: {member.npi} • {member.specialty}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Removed Members */}
                            {selectedRoster.diff.removed.length > 0 && (
                              <div>
                                <h3 className="font-semibold mb-3 flex items-center gap-2">
                                  <Minus className="h-4 w-4 text-red-600" />
                                  Removed ({selectedRoster.diff.removed.length})
                                </h3>
                                <div className="space-y-2">
                                  {selectedRoster.diff.removed.map((member) => (
                                    <div
                                      key={member.npi}
                                      className="p-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950"
                                    >
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="font-medium">{member.name}</span>
                                        <Badge variant="destructive">Removed</Badge>
                                      </div>
                                      <div className="text-sm text-muted-foreground">
                                        NPI: {member.npi} • {member.specialty}
                                        {member.terminationDate && (
                                          <span> • Terminated: {new Date(member.terminationDate).toLocaleDateString()}</span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Modified Members */}
                            {selectedRoster.diff.modified.length > 0 && (
                              <div>
                                <h3 className="font-semibold mb-3 flex items-center gap-2">
                                  <RefreshCw className="h-4 w-4 text-amber-600" />
                                  Modified ({selectedRoster.diff.modified.length})
                                </h3>
                                <div className="space-y-2">
                                  {selectedRoster.diff.modified.map((item, idx) => (
                                    <div
                                      key={`${item.member.npi}-${idx}`}
                                      className="p-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950"
                                    >
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="font-medium">{item.member.name}</span>
                                        <Badge className="bg-amber-600">Modified</Badge>
                                      </div>
                                      <div className="text-sm text-muted-foreground mb-2">
                                        NPI: {item.member.npi}
                                      </div>
                                      <div className="text-xs">
                                        <span className="font-medium">Changes:</span>
                                        <ul className="list-disc list-inside mt-1">
                                          {item.changes.map((change, i) => (
                                            <li key={i}>{change}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {selectedRoster.diff.added.length === 0 &&
                              selectedRoster.diff.removed.length === 0 &&
                              selectedRoster.diff.modified.length === 0 && (
                                <div className="text-center py-8 text-muted-foreground">
                                  <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                  <p>No changes detected</p>
                                </div>
                              )}
                          </div>
                        </ScrollArea>
                      </TabsContent>
                    )}
                  </Tabs>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Select a roster to view details</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

