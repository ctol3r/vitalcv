'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  FileText,
  Upload,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  FileCheck,
  History,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface Proposal {
  id: string
  opportunityId: string
  opportunityTitle?: string
  proposalDocId?: string
  status: 'draft' | 'submitted' | 'accepted' | 'rejected'
  submittedAt?: string
  decisionAt?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

interface ProposalRevision {
  id: string
  proposalId: string
  version: number
  documentUrl: string
  changeNotes?: string
  createdAt: string
}

export default function ProposalsPage() {
  const searchParams = useSearchParams()
  const opportunityId = searchParams.get('opportunityId')

  const [proposals, setProposals] = useState<Proposal[]>([])
  const [filteredProposals, setFilteredProposals] = useState<Proposal[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showSubmitDialog, setShowSubmitDialog] = useState(false)
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null)
  const [revisions, setRevisions] = useState<Record<string, ProposalRevision[]>>({})
  const [formData, setFormData] = useState({
    opportunityId: opportunityId || '',
    notes: '',
    file: null as File | null,
  })

  useEffect(() => {
    loadProposals()
  }, [opportunityId])

  useEffect(() => {
    filterProposals()
  }, [proposals, searchQuery, statusFilter])

  async function loadProposals() {
    try {
      const url = opportunityId
        ? `/api/partners/proposals?opportunityId=${opportunityId}`
        : '/api/partners/proposals'
      const response = await fetch(url)
      if (!response.ok) throw new Error('Failed to load proposals')
      const data = await response.json()
      setProposals(data.proposals || [])
    } catch (err) {
      console.error('Failed to load proposals:', err)
    } finally {
      setLoading(false)
    }
  }

  function filterProposals() {
    let filtered = [...proposals]

    if (searchQuery) {
      filtered = filtered.filter(
        (p) =>
          p.opportunityTitle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.notes?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((p) => p.status === statusFilter)
    }

    setFilteredProposals(filtered)
  }

  async function handleSubmit() {
    if (!formData.opportunityId || !formData.file) {
      alert('Please select an opportunity and upload a proposal document')
      return
    }

    try {
      const submitData = new FormData()
      submitData.append('opportunityId', formData.opportunityId)
      submitData.append('notes', formData.notes)
      submitData.append('file', formData.file)

      const response = await fetch('/api/partners/proposals', {
        method: 'POST',
        body: submitData,
      })

      if (!response.ok) throw new Error('Failed to submit proposal')

      setShowSubmitDialog(false)
      setFormData({ opportunityId: opportunityId || '', notes: '', file: null })
      await loadProposals()
    } catch (err) {
      console.error('Failed to submit proposal:', err)
      alert('Failed to submit proposal. Please try again.')
    }
  }

  async function loadRevisions(proposalId: string) {
    if (revisions[proposalId]) return

    try {
      const response = await fetch(`/api/partners/proposals/${proposalId}/revisions`)
      if (response.ok) {
        const data = await response.json()
        setRevisions((prev) => ({ ...prev, [proposalId]: data.revisions || [] }))
      }
    } catch (err) {
      console.error('Failed to load revisions:', err)
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      draft: 'outline',
      submitted: 'secondary',
      accepted: 'default',
      rejected: 'destructive',
    }
    const icons: Record<string, React.ReactNode> = {
      draft: <FileText className="h-3 w-3" />,
      submitted: <Clock className="h-3 w-3" />,
      accepted: <CheckCircle2 className="h-3 w-3" />,
      rejected: <XCircle className="h-3 w-3" />,
    }
    return (
      <Badge variant={variants[status] || 'outline'} className="flex items-center gap-1">
        {icons[status]}
        {status}
      </Badge>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Proposal Submission</h1>
          <p className="text-muted-foreground">
            Submit and track partnership proposals
          </p>
        </div>
        <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
          <DialogTrigger asChild>
            <Button>
              <Upload className="mr-2 h-4 w-4" />
              Submit Proposal
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Submit New Proposal</DialogTitle>
              <DialogDescription>
                Upload a proposal document linked to an opportunity
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="opportunityId">Opportunity *</Label>
                <Input
                  id="opportunityId"
                  value={formData.opportunityId}
                  onChange={(e) => setFormData({ ...formData, opportunityId: e.target.value })}
                  placeholder="Opportunity ID"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional notes about this proposal..."
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="file">Proposal Document *</Label>
                <Input
                  id="file"
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => setFormData({ ...formData, file: e.target.files?.[0] || null })}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSubmitDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={!formData.opportunityId || !formData.file}>
                Submit Proposal
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search proposals..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-full md:w-48">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Proposals Table */}
      <Card>
        <CardHeader>
          <CardTitle>Proposals</CardTitle>
          <CardDescription>
            {filteredProposals.length} proposal{filteredProposals.length !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading proposals...</div>
          ) : filteredProposals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No proposals found. Submit your first proposal to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Opportunity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Decision</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProposals.map((proposal) => (
                  <TableRow key={proposal.id}>
                    <TableCell className="font-medium">
                      {proposal.opportunityTitle || `Opportunity ${proposal.opportunityId}`}
                    </TableCell>
                    <TableCell>{getStatusBadge(proposal.status)}</TableCell>
                    <TableCell>
                      {proposal.submittedAt
                        ? new Date(proposal.submittedAt).toLocaleDateString()
                        : 'Not submitted'}
                    </TableCell>
                    <TableCell>
                      {proposal.decisionAt
                        ? new Date(proposal.decisionAt).toLocaleDateString()
                        : 'Pending'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {proposal.proposalDocId && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(`/api/files/${proposal.proposalDocId}`, '_blank')}
                            aria-label="View proposal"
                          >
                            <FileCheck className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedProposal(proposal)
                            loadRevisions(proposal.id)
                          }}
                          aria-label="View revision history"
                        >
                          <History className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Revision History Dialog */}
      {selectedProposal && (
        <Dialog open={!!selectedProposal} onOpenChange={() => setSelectedProposal(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Revision History</DialogTitle>
              <DialogDescription>
                View all revisions and changes for this proposal
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[400px] overflow-y-auto">
              {revisions[selectedProposal.id] ? (
                <div className="space-y-4">
                  {revisions[selectedProposal.id].map((revision) => (
                    <Card key={revision.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge>Version {revision.version}</Badge>
                            <span className="text-sm text-muted-foreground">
                              {new Date(revision.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(revision.documentUrl, '_blank')}
                          >
                            <FileCheck className="mr-2 h-4 w-4" />
                            View
                          </Button>
                        </div>
                        {revision.changeNotes && (
                          <p className="text-sm text-muted-foreground mt-2">
                            {revision.changeNotes}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Loading revision history...
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedProposal(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

