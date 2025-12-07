'use client'

import { useEffect, useState } from 'react'
import {
  FileText,
  Upload,
  Search,
  Filter,
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  FileCheck,
  History,
  Eye,
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

interface Agreement {
  id: string
  title: string
  status: 'draft' | 'pending' | 'active' | 'expired' | 'terminated'
  expiryDate?: string
  effectiveDate?: string
  documentUrl?: string
  version: number
  createdAt: string
  updatedAt: string
  approvalStatus?: 'pending_review' | 'approved' | 'rejected'
}

interface AgreementVersion {
  id: string
  version: number
  createdAt: string
  createdBy: string
  documentUrl: string
  changeNotes?: string
}

export default function AgreementsPage() {
  const [agreements, setAgreements] = useState<Agreement[]>([])
  const [filteredAgreements, setFilteredAgreements] = useState<Agreement[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedAgreement, setSelectedAgreement] = useState<Agreement | null>(null)
  const [versions, setVersions] = useState<Record<string, AgreementVersion[]>>({})
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadTitle, setUploadTitle] = useState('')
  const [isUploading, setIsUploading] = useState(false)

  useEffect(() => {
    loadAgreements()
  }, [])

  useEffect(() => {
    filterAgreements()
  }, [agreements, searchQuery, statusFilter])

  async function loadAgreements() {
    try {
      const response = await fetch('/api/partners/agreements')
      if (!response.ok) throw new Error('Failed to load agreements')
      const data = await response.json()
      setAgreements(data.agreements || [])
    } catch (err) {
      console.error('Failed to load agreements:', err)
    } finally {
      setLoading(false)
    }
  }

  function filterAgreements() {
    let filtered = [...agreements]

    if (searchQuery) {
      filtered = filtered.filter(
        (a) =>
          a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          a.id.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((a) => a.status === statusFilter)
    }

    setFilteredAgreements(filtered)
  }

  async function loadVersions(agreementId: string) {
    if (versions[agreementId]) return

    try {
      const response = await fetch(`/api/partners/agreements/${agreementId}/versions`)
      if (response.ok) {
        const data = await response.json()
        setVersions((prev) => ({ ...prev, [agreementId]: data.versions || [] }))
      }
    } catch (err) {
      console.error('Failed to load versions:', err)
    }
  }

  async function handleUpload() {
    if (!uploadFile || !uploadTitle.trim()) return

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', uploadFile)
      formData.append('title', uploadTitle)

      const response = await fetch('/api/partners/agreements/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) throw new Error('Upload failed')

      setShowUploadDialog(false)
      setUploadFile(null)
      setUploadTitle('')
      await loadAgreements()
    } catch (err) {
      console.error('Upload failed:', err)
      alert('Failed to upload agreement. Please try again.')
    } finally {
      setIsUploading(false)
    }
  }

  const getStatusBadge = (status: string, approvalStatus?: string) => {
    if (approvalStatus === 'pending_review') {
      return (
        <Badge variant="secondary" className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Pending Review
        </Badge>
      )
    }

    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      active: 'default',
      pending: 'secondary',
      draft: 'outline',
      expired: 'destructive',
      terminated: 'destructive',
    }
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>
  }

  const isExpiringSoon = (expiryDate?: string) => {
    if (!expiryDate) return false
    const expiry = new Date(expiryDate)
    const now = new Date()
    const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0
  }

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Agreement Management</h1>
          <p className="text-muted-foreground">
            Manage your partnership agreements and documents
          </p>
        </div>
        <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
          <DialogTrigger asChild>
            <Button>
              <Upload className="mr-2 h-4 w-4" />
              Upload Agreement
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload New Agreement</DialogTitle>
              <DialogDescription>
                Upload a new partnership agreement document
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Agreement Title</Label>
                <Input
                  id="title"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="e.g., Master Services Agreement 2024"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="file">Document File</Label>
                <Input
                  id="file"
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowUploadDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpload} disabled={!uploadFile || !uploadTitle || isUploading}>
                {isUploading ? 'Uploading...' : 'Upload'}
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
                  placeholder="Search agreements..."
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
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="terminated">Terminated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Agreements Table */}
      <Card>
        <CardHeader>
          <CardTitle>Agreements</CardTitle>
          <CardDescription>
            {filteredAgreements.length} agreement{filteredAgreements.length !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading agreements...</div>
          ) : filteredAgreements.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No agreements found. Upload your first agreement to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Effective Date</TableHead>
                  <TableHead>Expiry Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAgreements.map((agreement) => (
                  <TableRow key={agreement.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        {agreement.title}
                        {isExpiringSoon(agreement.expiryDate) && (
                          <Badge variant="outline" className="text-orange-600 border-orange-600">
                            Expiring Soon
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(agreement.status, agreement.approvalStatus)}
                    </TableCell>
                    <TableCell>v{agreement.version}</TableCell>
                    <TableCell>
                      {agreement.effectiveDate
                        ? new Date(agreement.effectiveDate).toLocaleDateString()
                        : 'N/A'}
                    </TableCell>
                    <TableCell>
                      {agreement.expiryDate
                        ? new Date(agreement.expiryDate).toLocaleDateString()
                        : 'No expiry'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {agreement.documentUrl && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(agreement.documentUrl, '_blank')}
                            aria-label="View document"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedAgreement(agreement)
                            loadVersions(agreement.id)
                          }}
                          aria-label="View history"
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

      {/* Version History Dialog */}
      {selectedAgreement && (
        <Dialog open={!!selectedAgreement} onOpenChange={() => setSelectedAgreement(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Version History: {selectedAgreement.title}</DialogTitle>
              <DialogDescription>
                View all versions and changes for this agreement
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[400px] overflow-y-auto">
              {versions[selectedAgreement.id] ? (
                <div className="space-y-4">
                  {versions[selectedAgreement.id].map((version) => (
                    <Card key={version.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge>Version {version.version}</Badge>
                            <span className="text-sm text-muted-foreground">
                              {new Date(version.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(version.documentUrl, '_blank')}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            View
                          </Button>
                        </div>
                        {version.changeNotes && (
                          <p className="text-sm text-muted-foreground mt-2">
                            {version.changeNotes}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Loading version history...
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedAgreement(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

