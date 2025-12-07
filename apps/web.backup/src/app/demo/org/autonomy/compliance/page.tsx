'use client'

import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  FileText,
  Shield,
  ShieldAlert,
  XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type ComplianceStatus = 'adherent' | 'violation' | 'pending' | 'unknown'

interface AutonomousAction {
  id: string
  type: 'issuance' | 'revocation' | 'renewal' | 'update'
  target: string
  timestamp: string
  regulations: RegulationCompliance[]
  overallStatus: ComplianceStatus
}

interface RegulationCompliance {
  regulation: string
  status: ComplianceStatus
  requirement: string
  evidence?: string
  violationDetails?: string
}

interface CorrectiveRecommendation {
  id: string
  actionId: string
  regulation: string
  issue: string
  recommendation: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  status: 'pending' | 'in_progress' | 'resolved'
}

interface ComplianceSummary {
  totalActions: number
  adherentActions: number
  violations: number
  pendingReviews: number
  complianceRate: number
}

export default function RegulatoryComplianceViewerPage() {
  const [summary, setSummary] = useState<ComplianceSummary | null>(null)
  const [actions, setActions] = useState<AutonomousAction[]>([])
  const [recommendations, setRecommendations] = useState<CorrectiveRecommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAction, setSelectedAction] = useState<AutonomousAction | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => {
    loadComplianceData()
  }, [])

  async function loadComplianceData() {
    try {
      const [summaryRes, actionsRes, recommendationsRes] = await Promise.all([
        fetch('/api/demo/org/autonomy/compliance/summary'),
        fetch('/api/demo/org/autonomy/compliance/actions'),
        fetch('/api/demo/org/autonomy/compliance/recommendations'),
      ])

      if (summaryRes.ok) {
        const data = await summaryRes.json()
        setSummary(data.summary || mockSummary())
      }
      if (actionsRes.ok) {
        const data = await actionsRes.json()
        setActions(data.actions || mockActions())
      }
      if (recommendationsRes.ok) {
        const data = await recommendationsRes.json()
        setRecommendations(data.recommendations || mockRecommendations())
      }
    } catch (err) {
      // Fallback to mock data
      setSummary(mockSummary())
      setActions(mockActions())
      setRecommendations(mockRecommendations())
    } finally {
      setLoading(false)
    }
  }

  const filteredActions = actions.filter((action) => {
    const matchesSearch =
      !searchQuery ||
      action.target.toLowerCase().includes(searchQuery.toLowerCase()) ||
      action.type.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || action.overallStatus === statusFilter
    return matchesSearch && matchesStatus
  })

  function getStatusColor(status: ComplianceStatus): string {
    switch (status) {
      case 'adherent':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'violation':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'unknown':
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  function getPriorityColor(priority: string): string {
    switch (priority) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading compliance data...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <ShieldAlert className="h-8 w-8 text-primary" />
            Regulatory Compliance Viewer
          </h1>
          <p className="text-gray-600 mt-1">
            Shows which autonomous actions adhere to or violate specific regulations; surfaces corrective recommendations
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Actions</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalActions}</div>
              <p className="text-xs text-muted-foreground">Autonomous actions</p>
            </CardContent>
          </Card>

          <Card className="border-green-200 bg-green-50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Adherent</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.adherentActions}</div>
              <p className="text-xs text-muted-foreground">
                {summary.totalActions > 0
                  ? `${Math.round((summary.adherentActions / summary.totalActions) * 100)}%`
                  : '0%'}
              </p>
            </CardContent>
          </Card>

          <Card className="border-red-200 bg-red-50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Violations</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.violations}</div>
              <p className="text-xs text-muted-foreground">Requiring action</p>
            </CardContent>
          </Card>

          <Card className="border-yellow-200 bg-yellow-50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.pendingReviews}</div>
              <p className="text-xs text-muted-foreground">Awaiting assessment</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Compliance Rate</CardTitle>
              <Shield className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.complianceRate.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">Overall compliance</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="actions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="actions">Autonomous Actions</TabsTrigger>
          <TabsTrigger value="recommendations">
            Corrective Recommendations ({recommendations.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="actions" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Autonomous Actions Compliance</CardTitle>
                  <CardDescription>
                    Regulatory compliance status for each autonomous credential action
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Search actions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-64"
                  />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="rounded-md border bg-background px-3 py-2 text-sm"
                  >
                    <option value="all">All Statuses</option>
                    <option value="adherent">Adherent</option>
                    <option value="violation">Violations</option>
                    <option value="pending">Pending</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action Type</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Overall Status</TableHead>
                    <TableHead>Regulations</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredActions.map((action) => (
                    <TableRow key={action.id}>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {action.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{action.target}</TableCell>
                      <TableCell>
                        {new Date(action.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(action.overallStatus)}>
                          {action.overallStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {action.regulations.map((reg, idx) => (
                            <Badge
                              key={idx}
                              variant="outline"
                              className={
                                reg.status === 'adherent'
                                  ? 'border-green-300 text-green-800'
                                  : reg.status === 'violation'
                                    ? 'border-red-300 text-red-800'
                                    : 'border-yellow-300 text-yellow-800'
                              }
                            >
                              {reg.regulation}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedAction(action)}
                        >
                          View Details
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredActions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                        No actions match the current filters
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Corrective Recommendations</CardTitle>
              <CardDescription>
                Recommended actions to address regulatory violations and improve compliance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Priority</TableHead>
                    <TableHead>Action ID</TableHead>
                    <TableHead>Regulation</TableHead>
                    <TableHead>Issue</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Recommendation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recommendations.map((rec) => (
                    <TableRow key={rec.id}>
                      <TableCell>
                        <Badge className={getPriorityColor(rec.priority)}>
                          {rec.priority}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{rec.actionId}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{rec.regulation}</Badge>
                      </TableCell>
                      <TableCell className="max-w-md truncate">{rec.issue}</TableCell>
                      <TableCell>
                        <Badge
                          className={
                            rec.status === 'resolved'
                              ? 'bg-green-100 text-green-800'
                              : rec.status === 'in_progress'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-yellow-100 text-yellow-800'
                          }
                        >
                          {rec.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-md truncate">{rec.recommendation}</TableCell>
                    </TableRow>
                  ))}
                  {recommendations.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                        No recommendations at this time
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Detail Dialog */}
      {selectedAction && (
        <Dialog open={!!selectedAction} onOpenChange={() => setSelectedAction(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>
                {selectedAction.type.charAt(0).toUpperCase() + selectedAction.type.slice(1)}{' '}
                Action Details
              </DialogTitle>
              <DialogDescription>
                <div className="flex items-center gap-2 mt-2">
                  <Badge className={getStatusColor(selectedAction.overallStatus)}>
                    {selectedAction.overallStatus}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Target: {selectedAction.target}
                  </span>
                </div>
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <h4 className="font-semibold mb-2">Regulatory Compliance</h4>
                <div className="space-y-3">
                  {selectedAction.regulations.map((reg, idx) => (
                    <div
                      key={idx}
                      className="p-3 border rounded-md"
                      style={{
                        borderColor:
                          reg.status === 'adherent'
                            ? 'rgb(187 247 208)'
                            : reg.status === 'violation'
                              ? 'rgb(254 202 202)'
                              : 'rgb(254 243 199)',
                        backgroundColor:
                          reg.status === 'adherent'
                            ? 'rgb(240 253 244)'
                            : reg.status === 'violation'
                              ? 'rgb(254 242 242)'
                              : 'rgb(254 252 232)',
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <Badge
                          className={
                            reg.status === 'adherent'
                              ? 'bg-green-100 text-green-800'
                              : reg.status === 'violation'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-yellow-100 text-yellow-800'
                          }
                        >
                          {reg.regulation}
                        </Badge>
                        <Badge variant="outline">{reg.status}</Badge>
                      </div>
                      <p className="text-sm font-medium mb-1">{reg.requirement}</p>
                      {reg.evidence && (
                        <p className="text-xs text-muted-foreground">
                          <strong>Evidence:</strong> {reg.evidence}
                        </p>
                      )}
                      {reg.violationDetails && (
                        <p className="text-xs text-red-600 mt-1">
                          <strong>Violation:</strong> {reg.violationDetails}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-semibold">Timestamp</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(selectedAction.timestamp).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold">Action ID</p>
                  <p className="text-sm text-muted-foreground font-mono">
                    {selectedAction.id}
                  </p>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function mockSummary(): ComplianceSummary {
  return {
    totalActions: 156,
    adherentActions: 142,
    violations: 8,
    pendingReviews: 6,
    complianceRate: 91.0,
  }
}

function mockActions(): AutonomousAction[] {
  return [
    {
      id: 'act-001',
      type: 'issuance',
      target: 'Dr. Sarah Chen',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      overallStatus: 'adherent',
      regulations: [
        {
          regulation: 'HIPAA',
          status: 'adherent',
          requirement: 'Patient privacy protected',
          evidence: 'All data encrypted and access logged',
        },
        {
          regulation: 'FCRA',
          status: 'adherent',
          requirement: 'Fair credit reporting compliance',
          evidence: 'Proper disclosure and consent obtained',
        },
      ],
    },
    {
      id: 'act-002',
      type: 'revocation',
      target: 'Dr. Michael Torres',
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      overallStatus: 'violation',
      regulations: [
        {
          regulation: 'State Licensing',
          status: 'violation',
          requirement: 'State-specific revocation procedures',
          violationDetails: 'Revocation executed without required state notification period',
        },
        {
          regulation: 'HIPAA',
          status: 'adherent',
          requirement: 'Patient privacy protected',
          evidence: 'Data handling compliant',
        },
      ],
    },
    {
      id: 'act-003',
      type: 'renewal',
      target: 'PA. Lisa Park',
      timestamp: new Date(Date.now() - 10800000).toISOString(),
      overallStatus: 'pending',
      regulations: [
        {
          regulation: 'TJC',
          status: 'pending',
          requirement: 'Joint Commission standards compliance',
        },
        {
          regulation: 'HIPAA',
          status: 'adherent',
          requirement: 'Patient privacy protected',
          evidence: 'Compliant',
        },
      ],
    },
  ]
}

function mockRecommendations(): CorrectiveRecommendation[] {
  return [
    {
      id: 'rec-001',
      actionId: 'act-002',
      regulation: 'State Licensing',
      issue: 'Revocation executed without required state notification period',
      recommendation:
        'Implement 30-day notification period before revocation for state-licensed clinicians',
      priority: 'critical',
      status: 'pending',
    },
    {
      id: 'rec-002',
      actionId: 'act-005',
      regulation: 'FCRA',
      issue: 'Incomplete disclosure documentation',
      recommendation: 'Update disclosure forms to include all required FCRA elements',
      priority: 'high',
      status: 'in_progress',
    },
    {
      id: 'rec-003',
      actionId: 'act-008',
      regulation: 'HIPAA',
      issue: 'Access logging incomplete',
      recommendation: 'Enhance audit logging to capture all data access events',
      priority: 'medium',
      status: 'resolved',
    },
  ]
}

