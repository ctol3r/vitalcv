'use client'

import { useMemo, useState } from 'react'
import { FileCheck, Building2, Shield, Plus, AlertCircle, Calendar, CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type PortfolioEntry = {
  id: string
  type: 'credential' | 'privilege' | 'enrollment'
  name: string
  issuer: string
  status: 'active' | 'expiring' | 'expired' | 'pending'
  issueDate?: string
  expiryDate?: string
  lastUpdated: string
  renewalRequired: boolean
}

type PortfolioData = {
  clinician: {
    name: string
    npi: string
  }
  credentials: PortfolioEntry[]
  privileges: PortfolioEntry[]
  enrollments: PortfolioEntry[]
}

export default function PortfolioManagementPage() {
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [newEntryType, setNewEntryType] = useState<'credential' | 'privilege' | 'enrollment'>('credential')
  const [srMessage, setSrMessage] = useState('')

  const data = useMemo(() => buildMockData(), [])

  const handleAddEntry = async () => {
    setSrMessage(`Adding new ${newEntryType}`)
    await new Promise((resolve) => setTimeout(resolve, 800))
    setSrMessage(`${newEntryType} added successfully`)
    setShowAddDialog(false)
    setTimeout(() => setSrMessage(''), 2000)
  }

  const handleRequestUpdate = async (entryId: string) => {
    const entry = [...data.credentials, ...data.privileges, ...data.enrollments].find((e) => e.id === entryId)
    setSrMessage(`Requesting update for ${entry?.name}`)
    await new Promise((resolve) => setTimeout(resolve, 800))
    setSrMessage('Update request submitted')
    setTimeout(() => setSrMessage(''), 2000)
  }

  const expiringSoon = useMemo(() => {
    const all = [...data.credentials, ...data.privileges, ...data.enrollments]
    return all.filter((e) => e.status === 'expiring' || e.status === 'expired')
  }, [data])

  return (
    <div className="container mx-auto space-y-8 py-8">
      <header className="space-y-4">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">Demo • Clinician • Portfolio</p>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Shield className="h-8 w-8 text-primary" aria-hidden="true" />
              Portfolio Management
            </h1>
            <p className="text-muted-foreground max-w-2xl">
              Manage your credentials, privileges, and enrollments. Add missing entries, request updates, and track expiry dates.
            </p>
          </div>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Entry
          </Button>
        </div>
      </header>

      {/* Alerts */}
      {expiringSoon.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-900">
              <AlertCircle className="h-5 w-5" />
              Action Required
            </CardTitle>
            <CardDescription className="text-amber-800">
              {expiringSoon.length} {expiringSoon.length === 1 ? 'entry' : 'entries'} {expiringSoon.some((e) => e.status === 'expired') ? 'expired' : 'expiring soon'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {expiringSoon.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between rounded-md border border-amber-300 bg-white p-3">
                  <div>
                    <p className="font-medium">{entry.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {entry.type === 'credential' && 'Credential'}
                      {entry.type === 'privilege' && 'Privilege'}
                      {entry.type === 'enrollment' && 'Enrollment'} • {entry.issuer}
                      {entry.expiryDate && ` • Expires ${entry.expiryDate}`}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => handleRequestUpdate(entry.id)}>
                    Request Update
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Credentials */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-primary" />
            Credentials
          </CardTitle>
          <CardDescription>Licenses, certifications, and board credentials.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Issuer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Issue Date</TableHead>
                <TableHead>Expiry Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.credentials.map((credential) => (
                <TableRow key={credential.id}>
                  <TableCell className="font-medium">{credential.name}</TableCell>
                  <TableCell>{credential.issuer}</TableCell>
                  <TableCell>
                    <StatusBadge status={credential.status} />
                  </TableCell>
                  <TableCell>{credential.issueDate || '—'}</TableCell>
                  <TableCell>
                    {credential.expiryDate ? (
                      <span className={credential.status === 'expiring' || credential.status === 'expired' ? 'text-rose-600 font-medium' : ''}>
                        {credential.expiryDate}
                      </span>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>
                    {credential.renewalRequired && (
                      <Button size="sm" variant="outline" onClick={() => handleRequestUpdate(credential.id)}>
                        Request Update
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Privileges */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Privileges
          </CardTitle>
          <CardDescription>Clinical privileges granted by organizations.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Issue Date</TableHead>
                <TableHead>Expiry Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.privileges.map((privilege) => (
                <TableRow key={privilege.id}>
                  <TableCell className="font-medium">{privilege.name}</TableCell>
                  <TableCell>{privilege.issuer}</TableCell>
                  <TableCell>
                    <StatusBadge status={privilege.status} />
                  </TableCell>
                  <TableCell>{privilege.issueDate || '—'}</TableCell>
                  <TableCell>
                    {privilege.expiryDate ? (
                      <span className={privilege.status === 'expiring' || privilege.status === 'expired' ? 'text-rose-600 font-medium' : ''}>
                        {privilege.expiryDate}
                      </span>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>
                    {privilege.renewalRequired && (
                      <Button size="sm" variant="outline" onClick={() => handleRequestUpdate(privilege.id)}>
                        Request Update
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Enrollments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Enrollments
          </CardTitle>
          <CardDescription>Payer network enrollments and participation.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Payer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Issue Date</TableHead>
                <TableHead>Expiry Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.enrollments.map((enrollment) => (
                <TableRow key={enrollment.id}>
                  <TableCell className="font-medium">{enrollment.name}</TableCell>
                  <TableCell>{enrollment.issuer}</TableCell>
                  <TableCell>
                    <StatusBadge status={enrollment.status} />
                  </TableCell>
                  <TableCell>{enrollment.issueDate || '—'}</TableCell>
                  <TableCell>
                    {enrollment.expiryDate ? (
                      <span className={enrollment.status === 'expiring' || enrollment.status === 'expired' ? 'text-rose-600 font-medium' : ''}>
                        {enrollment.expiryDate}
                      </span>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>
                    {enrollment.renewalRequired && (
                      <Button size="sm" variant="outline" onClick={() => handleRequestUpdate(enrollment.id)}>
                        Request Update
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Entry Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Portfolio Entry</DialogTitle>
            <DialogDescription>Add a new credential, privilege, or enrollment to your portfolio.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Entry Type</Label>
              <div className="flex gap-2 mt-2">
                {(['credential', 'privilege', 'enrollment'] as const).map((type) => (
                  <Button
                    key={type}
                    variant={newEntryType === type ? 'default' : 'outline'}
                    onClick={() => setNewEntryType(type)}
                    className="capitalize"
                  >
                    {type}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" placeholder={`Enter ${newEntryType} name`} />
            </div>
            <div>
              <Label htmlFor="issuer">Issuer</Label>
              <Input id="issuer" placeholder="Enter issuer name" />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAddEntry}>Add Entry</Button>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <span className="sr-only" aria-live="polite">
        {srMessage}
      </span>
    </div>
  )
}

function StatusBadge({ status }: { status: PortfolioEntry['status'] }) {
  const config = {
    active: { label: 'Active', variant: 'default' as const, icon: CheckCircle2 },
    expiring: { label: 'Expiring Soon', variant: 'default' as const, icon: AlertCircle },
    expired: { label: 'Expired', variant: 'destructive' as const, icon: AlertCircle },
    pending: { label: 'Pending', variant: 'secondary' as const, icon: Calendar },
  }[status]

  const Icon = config.icon

  return (
    <Badge variant={config.variant} className="flex items-center gap-1 w-fit">
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  )
}

function buildMockData(): PortfolioData {
  return {
    clinician: {
      name: 'Dr. Sarah Chen',
      npi: '1750392145',
    },
    credentials: [
      {
        id: 'cred1',
        type: 'credential',
        name: 'Medical License',
        issuer: 'State Medical Board',
        status: 'active',
        issueDate: '2020-01-15',
        expiryDate: '2026-12-31',
        lastUpdated: 'Nov 15, 2025',
        renewalRequired: false,
      },
      {
        id: 'cred2',
        type: 'credential',
        name: 'Board Certification - Cardiology',
        issuer: 'American Board of Internal Medicine',
        status: 'active',
        issueDate: '2018-06-01',
        expiryDate: '2027-06-30',
        lastUpdated: 'Nov 10, 2025',
        renewalRequired: false,
      },
      {
        id: 'cred3',
        type: 'credential',
        name: 'DEA Registration',
        issuer: 'Drug Enforcement Administration',
        status: 'expiring',
        issueDate: '2023-01-01',
        expiryDate: '2025-12-20',
        lastUpdated: 'Oct 15, 2025',
        renewalRequired: true,
      },
    ],
    privileges: [
      {
        id: 'priv1',
        type: 'privilege',
        name: 'Cardiac Catheterization',
        issuer: 'Northwind Medical Center',
        status: 'active',
        issueDate: '2022-03-15',
        lastUpdated: 'Oct 28, 2025',
        renewalRequired: false,
      },
      {
        id: 'priv2',
        type: 'privilege',
        name: 'Percutaneous Coronary Intervention',
        issuer: 'Northwind Medical Center',
        status: 'active',
        issueDate: '2023-01-10',
        lastUpdated: 'Sep 15, 2025',
        renewalRequired: false,
      },
    ],
    enrollments: [
      {
        id: 'enroll1',
        type: 'enrollment',
        name: 'Medicare Enrollment',
        issuer: 'CMS',
        status: 'active',
        issueDate: '2021-05-01',
        expiryDate: '2026-03-15',
        lastUpdated: 'Nov 1, 2025',
        renewalRequired: false,
      },
      {
        id: 'enroll2',
        type: 'enrollment',
        name: 'Aetna Network',
        issuer: 'Aetna',
        status: 'expiring',
        issueDate: '2020-08-15',
        expiryDate: '2025-12-20',
        lastUpdated: 'Oct 15, 2025',
        renewalRequired: true,
      },
      {
        id: 'enroll3',
        type: 'enrollment',
        name: 'UnitedHealthcare Network',
        issuer: 'UnitedHealthcare',
        status: 'active',
        issueDate: '2024-02-01',
        expiryDate: '2026-02-01',
        lastUpdated: 'Nov 1, 2025',
        renewalRequired: false,
      },
    ],
  }
}

