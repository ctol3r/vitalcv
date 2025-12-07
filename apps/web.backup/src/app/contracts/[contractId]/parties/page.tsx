'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
  Users,
  Plus,
  Trash2,
  Mail,
  User,
  Building2,
  Handshake,
  Eye,
  PenTool,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

type ContractPartyRole = 'SIGNER' | 'WITNESS' | 'OBSERVER'
type SignatureStatus = 'PENDING' | 'SIGNED' | 'DECLINED'

interface Contract {
  id: string
  title: string
  parties: ContractParty[]
}

interface ContractParty {
  id: string
  organizationId: string | null
  partnerId: string | null
  contactName: string | null
  contactEmail: string | null
  role: ContractPartyRole
  signatureStatus: SignatureStatus
  signedAt: string | null
}

interface Organization {
  id: string
  name: string
}

interface Partner {
  id: string
  name: string
}

export default function ContractPartyManagementPage() {
  const router = useRouter()
  const params = useParams()
  const contractId = params.contractId as string
  const [contract, setContract] = useState<Contract | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedParty, setSelectedParty] = useState<ContractParty | null>(null)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [partners, setPartners] = useState<Partner[]>([])

  // Form state
  const [formData, setFormData] = useState({
    organizationId: '',
    partnerId: '',
    contactName: '',
    contactEmail: '',
    role: 'SIGNER' as ContractPartyRole,
  })

  useEffect(() => {
    if (contractId) {
      loadContract()
      loadOrganizations()
      loadPartners()
    }
  }, [contractId])

  async function loadContract() {
    try {
      setLoading(true)
      const response = await fetch(`/api/contracts/${contractId}`)
      if (!response.ok) {
        throw new Error(`Failed to load contract (${response.status})`)
      }
      const data = await response.json()
      setContract(data.contract)
      setError(null)
    } catch (err: any) {
      setError(err.message ?? 'Unable to load contract')
    } finally {
      setLoading(false)
    }
  }

  async function loadOrganizations() {
    try {
      const response = await fetch('/api/organizations')
      if (response.ok) {
        const data = await response.json()
        setOrganizations(data.organizations || [])
      }
    } catch (err) {
      console.error('Failed to load organizations:', err)
    }
  }

  async function loadPartners() {
    try {
      const response = await fetch('/api/partners')
      if (response.ok) {
        const data = await response.json()
        setPartners(data.partners || [])
      }
    } catch (err) {
      console.error('Failed to load partners:', err)
    }
  }

  function resetForm() {
    setFormData({
      organizationId: '',
      partnerId: '',
      contactName: '',
      contactEmail: '',
      role: 'SIGNER',
    })
  }

  function openAddDialog() {
    resetForm()
    setShowAddDialog(true)
  }

  function openDeleteDialog(party: ContractParty) {
    setSelectedParty(party)
    setShowDeleteDialog(true)
  }

  async function addParty() {
    try {
      if (!formData.organizationId && !formData.partnerId) {
        setError('Either organization or partner must be selected')
        return
      }
      const response = await fetch(`/api/contracts/${contractId}/parties`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (!response.ok) {
        throw new Error('Failed to add party')
      }
      setShowAddDialog(false)
      resetForm()
      loadContract()
    } catch (err: any) {
      setError(err.message ?? 'Failed to add party')
    }
  }

  async function deleteParty() {
    if (!selectedParty) return
    try {
      const response = await fetch(`/api/contracts/${contractId}/parties/${selectedParty.id}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        throw new Error('Failed to remove party')
      }
      setShowDeleteDialog(false)
      setSelectedParty(null)
      loadContract()
    } catch (err: any) {
      setError(err.message ?? 'Failed to remove party')
    }
  }

  async function sendInvite(party: ContractParty) {
    try {
      const response = await fetch(`/api/contracts/${contractId}/parties/${party.id}/invite`, {
        method: 'POST',
      })
      if (!response.ok) {
        throw new Error('Failed to send invite')
      }
      // Show success message
    } catch (err: any) {
      setError(err.message ?? 'Failed to send invite')
    }
  }

  function getSignatureStatusBadge(status: SignatureStatus) {
    const variants: Record<SignatureStatus, { variant: 'default' | 'secondary' | 'outline' | 'destructive'; label: string }> = {
      PENDING: { variant: 'outline', label: 'Pending' },
      SIGNED: { variant: 'default', label: 'Signed' },
      DECLINED: { variant: 'destructive', label: 'Declined' },
    }
    const { variant, label } = variants[status]
    return <Badge variant={variant}>{label}</Badge>
  }

  function getRoleIcon(role: ContractPartyRole) {
    switch (role) {
      case 'SIGNER':
        return <PenTool className="h-4 w-4" />
      case 'WITNESS':
        return <Eye className="h-4 w-4" />
      case 'OBSERVER':
        return <Eye className="h-4 w-4" />
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="py-16 text-center text-muted-foreground">Loading parties…</div>
      </div>
    )
  }

  if (error && !contract) {
    return (
      <div className="container mx-auto py-8">
        <Card className="border-destructive" role="alert">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push(`/contracts/${contractId}`)}>
              Back to Contract
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto space-y-6 py-8">
      <header className="space-y-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Link
                href={`/contracts/${contractId}`}
                className="text-sm text-muted-foreground hover:underline"
              >
                Contract
              </Link>
              <span className="text-muted-foreground">/</span>
              <span className="text-sm font-medium">Parties</span>
            </div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Users className="h-7 w-7 text-primary" aria-hidden="true" />
              Manage Parties
            </h1>
            {contract && (
              <p className="text-muted-foreground mt-2">{contract.title}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button onClick={openAddDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Add Party
            </Button>
          </div>
        </div>
      </header>

      {error && (
        <Card className="border-destructive" role="alert">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Parties Table */}
      <Card>
        <CardHeader>
          <CardTitle>Contract Parties</CardTitle>
          <CardDescription>
            Manage organizations, partners, and contacts involved in this contract
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Organization/Partner</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Signature Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contract?.parties.map((party) => (
                <TableRow key={party.id}>
                  <TableCell className="font-medium">
                    {party.contactName || '—'}
                  </TableCell>
                  <TableCell>
                    {party.contactEmail ? (
                      <div className="flex items-center gap-1">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        {party.contactEmail}
                      </div>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>
                    {party.organizationId ? (
                      <div className="flex items-center gap-1">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {party.organizationId}
                      </div>
                    ) : party.partnerId ? (
                      <div className="flex items-center gap-1">
                        <Handshake className="h-4 w-4 text-muted-foreground" />
                        {party.partnerId}
                      </div>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="flex items-center gap-1 w-fit">
                      {getRoleIcon(party.role)}
                      {party.role}
                    </Badge>
                  </TableCell>
                  <TableCell>{getSignatureStatusBadge(party.signatureStatus)}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {party.signatureStatus === 'PENDING' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => sendInvite(party)}
                        >
                          <Mail className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDeleteDialog(party)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {contract && contract.parties.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No parties added yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Party Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Party</DialogTitle>
            <DialogDescription>
              Add a new organization, partner, or contact to this contract
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="organization">Organization</Label>
              <Select
                value={formData.organizationId}
                onValueChange={(value) => setFormData({ ...formData, organizationId: value, partnerId: '' })}
              >
                <SelectTrigger id="organization">
                  <SelectValue placeholder="Select organization" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="partner">Partner</Label>
              <Select
                value={formData.partnerId}
                onValueChange={(value) => setFormData({ ...formData, partnerId: value, organizationId: '' })}
                disabled={!!formData.organizationId}
              >
                <SelectTrigger id="partner">
                  <SelectValue placeholder="Select partner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {partners.map((partner) => (
                    <SelectItem key={partner.id} value={partner.id}>
                      {partner.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactName">Contact Name</Label>
              <Input
                id="contactName"
                value={formData.contactName}
                onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                placeholder="Contact name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactEmail">Contact Email</Label>
              <Input
                id="contactEmail"
                type="email"
                value={formData.contactEmail}
                onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                placeholder="contact@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value as ContractPartyRole })}
              >
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SIGNER">Signer</SelectItem>
                  <SelectItem value="WITNESS">Witness</SelectItem>
                  <SelectItem value="OBSERVER">Observer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={addParty}>Add Party</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Party Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <div className="flex flex-col gap-2 text-center sm:text-left">
            <AlertDialogTitle>Remove Party</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this party from the contract? This action cannot be undone.
            </AlertDialogDescription>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteParty}>Remove</AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

