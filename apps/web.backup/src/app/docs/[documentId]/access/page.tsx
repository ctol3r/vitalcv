'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  UserPlus,
  Mail,
  Shield,
  Eye,
  Edit,
  Trash2,
  Clock,
  User,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalFooter,
} from '@/components/design/Modal'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AccessibleDataTable, TableColumn } from '@/components/accessibility/AccessibleDataTable'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

// Types
type AccessLevel = 'read' | 'write' | 'admin'

interface AccessRight {
  id: string
  userId?: string
  roleId?: string
  userName?: string
  roleName?: string
  accessLevel: AccessLevel
  grantedBy: string
  grantedAt: string
  expiresAt?: string
}

interface AuditLog {
  id: string
  action: string
  user: string
  timestamp: string
  details?: string
}

// Mock data - replace with API call
const mockAccessRights: AccessRight[] = [
  {
    id: '1',
    userId: 'user-1',
    userName: 'Dr. Jane Smith',
    accessLevel: 'admin',
    grantedBy: 'System',
    grantedAt: '2024-01-01',
  },
  {
    id: '2',
    userId: 'user-2',
    userName: 'Dr. John Doe',
    accessLevel: 'write',
    grantedBy: 'Dr. Jane Smith',
    grantedAt: '2024-01-05',
  },
  {
    id: '3',
    roleId: 'role-1',
    roleName: 'Clinical Staff',
    accessLevel: 'read',
    grantedBy: 'Dr. Jane Smith',
    grantedAt: '2024-01-10',
  },
]

const mockAuditLogs: AuditLog[] = [
  {
    id: '1',
    action: 'Access granted',
    user: 'Dr. Jane Smith',
    timestamp: '2024-01-01T10:00:00Z',
    details: 'Granted admin access to Dr. Jane Smith',
  },
  {
    id: '2',
    action: 'Access granted',
    user: 'Dr. Jane Smith',
    timestamp: '2024-01-05T14:30:00Z',
    details: 'Granted write access to Dr. John Doe',
  },
  {
    id: '3',
    action: 'Access revoked',
    user: 'Dr. Jane Smith',
    timestamp: '2024-01-12T09:15:00Z',
    details: 'Revoked read access from Clinical Staff role',
  },
]

const accessLevelColors = {
  read: 'secondary',
  write: 'default',
  admin: 'destructive',
} as const

export default function DocumentAccessManagementPage() {
  const params = useParams()
  const router = useRouter()
  const documentId = params.documentId as string

  const [accessRights, setAccessRights] = useState<AccessRight[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [showGrantModal, setShowGrantModal] = useState(false)
  const [grantType, setGrantType] = useState<'user' | 'role'>('user')
  const [grantData, setGrantData] = useState({
    userId: '',
    roleId: '',
    accessLevel: 'read' as AccessLevel,
    email: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Mock users and roles - replace with API call
  const mockUsers = [
    { id: 'user-1', name: 'Dr. Jane Smith', email: 'jane@example.com' },
    { id: 'user-2', name: 'Dr. John Doe', email: 'john@example.com' },
    { id: 'user-3', name: 'Dr. Sarah Johnson', email: 'sarah@example.com' },
  ]

  const mockRoles = [
    { id: 'role-1', name: 'Clinical Staff' },
    { id: 'role-2', name: 'Administrators' },
    { id: 'role-3', name: 'Compliance Team' },
  ]

  useEffect(() => {
    // In a real app, fetch access rights and audit logs
    // const fetchData = async () => {
    //   const [rights, logs] = await Promise.all([
    //     fetch(`/api/documents/${documentId}/access`),
    //     fetch(`/api/documents/${documentId}/access/audit`),
    //   ])
    //   const rightsData = await rights.json()
    //   const logsData = await logs.json()
    //   setAccessRights(rightsData)
    //   setAuditLogs(logsData)
    // }
    // fetchData()
    setAccessRights(mockAccessRights)
    setAuditLogs(mockAuditLogs)
  }, [documentId])

  const handleGrantAccess = async () => {
    const newErrors: Record<string, string> = {}

    if (grantType === 'user') {
      if (!grantData.userId && !grantData.email) {
        newErrors.user = 'User or email is required'
      }
    } else {
      if (!grantData.roleId) {
        newErrors.role = 'Role is required'
      }
    }

    if (!grantData.accessLevel) {
      newErrors.accessLevel = 'Access level is required'
    }

    setErrors(newErrors)
    if (Object.keys(newErrors).length > 0) return

    try {
      // In a real app, grant access
      // await fetch(`/api/documents/${documentId}/access`, {
      //   method: 'POST',
      //   body: JSON.stringify(grantData),
      // })

      const newRight: AccessRight = {
        id: `right-${Date.now()}`,
        userId: grantType === 'user' ? grantData.userId : undefined,
        roleId: grantType === 'role' ? grantData.roleId : undefined,
        userName: grantType === 'user' ? mockUsers.find((u) => u.id === grantData.userId)?.name : undefined,
        roleName: grantType === 'role' ? mockRoles.find((r) => r.id === grantData.roleId)?.name : undefined,
        accessLevel: grantData.accessLevel,
        grantedBy: 'Current User',
        grantedAt: new Date().toISOString(),
      }

      setAccessRights([...accessRights, newRight])
      handleCloseGrantModal()
    } catch (error) {
      console.error('Error granting access:', error)
      setErrors({ submit: 'Failed to grant access' })
    }
  }

  const handleRevokeAccess = async (rightId: string) => {
    if (!confirm('Are you sure you want to revoke this access?')) return

    try {
      // await fetch(`/api/documents/${documentId}/access/${rightId}`, {
      //   method: 'DELETE',
      // })
      setAccessRights(accessRights.filter((right) => right.id !== rightId))
    } catch (error) {
      console.error('Error revoking access:', error)
    }
  }

  const handleCloseGrantModal = () => {
    setShowGrantModal(false)
    setGrantData({ userId: '', roleId: '', accessLevel: 'read', email: '' })
    setErrors({})
  }

  const accessColumns: TableColumn<AccessRight>[] = [
    {
      id: 'entity',
      header: 'User / Role',
      accessor: (right) => (
        <div className="flex items-center gap-2">
          {right.userId ? (
            <User className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Users className="h-4 w-4 text-muted-foreground" />
          )}
          <span>{right.userName || right.roleName}</span>
        </div>
      ),
    },
    {
      id: 'accessLevel',
      header: 'Access Level',
      accessor: (right) => (
        <Badge variant={accessLevelColors[right.accessLevel]}>
          {right.accessLevel.toUpperCase()}
        </Badge>
      ),
      sortable: true,
    },
    {
      id: 'grantedBy',
      header: 'Granted By',
      accessor: (right) => right.grantedBy,
    },
    {
      id: 'grantedAt',
      header: 'Granted At',
      accessor: (right) => new Date(right.grantedAt).toLocaleDateString(),
      sortable: true,
    },
    {
      id: 'actions',
      header: 'Actions',
      accessor: (right) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleRevokeAccess(right.id)}
          aria-label={`Revoke access for ${right.userName || right.roleName}`}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      ),
    },
  ]

  const auditColumns: TableColumn<AuditLog>[] = [
    {
      id: 'action',
      header: 'Action',
      accessor: (log) => (
        <Badge variant={log.action.includes('granted') ? 'default' : 'destructive'}>
          {log.action}
        </Badge>
      ),
    },
    {
      id: 'user',
      header: 'User',
      accessor: (log) => log.user,
    },
    {
      id: 'details',
      header: 'Details',
      accessor: (log) => log.details || '-',
    },
    {
      id: 'timestamp',
      header: 'Timestamp',
      accessor: (log) => new Date(log.timestamp).toLocaleString(),
      sortable: true,
    },
  ]

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Button
            variant="ghost"
            onClick={() => router.push(`/docs/${documentId}`)}
            className="mb-4"
            aria-label="Back to document"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Document
          </Button>
          <h1 className="text-3xl font-bold">Access Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage who can read, write, or administer this document
          </p>
        </div>
        <Button onClick={() => setShowGrantModal(true)} aria-label="Grant access">
          <UserPlus className="mr-2 h-4 w-4" />
          Grant Access
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="rights">
        <TabsList>
          <TabsTrigger value="rights">Access Rights</TabsTrigger>
          <TabsTrigger value="audit">Audit Trail</TabsTrigger>
        </TabsList>

        <TabsContent value="rights" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Current Access Rights</CardTitle>
              <CardDescription>
                Users and roles with access to this document
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AccessibleDataTable
                data={accessRights}
                columns={accessColumns}
                caption="Document access rights management"
                filterable={true}
                filterPlaceholder="Filter access rights..."
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Audit Trail</CardTitle>
              <CardDescription>
                History of all access-related actions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AccessibleDataTable
                data={auditLogs}
                columns={auditColumns}
                caption="Document access audit trail"
                filterable={true}
                filterPlaceholder="Filter audit logs..."
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Grant Access Modal */}
      {showGrantModal && (
        <Modal open={true} onOpenChange={handleCloseGrantModal}>
          <ModalContent size="medium">
            <ModalHeader>
              <ModalTitle>Grant Access</ModalTitle>
              <ModalDescription>
                Grant access to a user or role for this document
              </ModalDescription>
            </ModalHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Grant Type</Label>
                <Select
                  value={grantType}
                  onValueChange={(value) => setGrantType(value as 'user' | 'role')}
                >
                  <SelectTrigger aria-label="Select grant type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="role">Role</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {grantType === 'user' ? (
                <div className="space-y-2">
                  <Label htmlFor="userId">
                    User <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={grantData.userId}
                    onValueChange={(value) => setGrantData({ ...grantData, userId: value })}
                  >
                    <SelectTrigger id="userId" aria-label="Select user" aria-invalid={!!errors.user}>
                      <SelectValue placeholder="Select a user" />
                    </SelectTrigger>
                    <SelectContent>
                      {mockUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name} ({user.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.user && (
                    <p className="text-sm text-destructive">{errors.user}</p>
                  )}
                  <div className="text-sm text-muted-foreground">
                    Or invite by email:
                  </div>
                  <Input
                    type="email"
                    placeholder="email@example.com"
                    value={grantData.email}
                    onChange={(e) => setGrantData({ ...grantData, email: e.target.value })}
                    aria-label="Email address"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="roleId">
                    Role <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={grantData.roleId}
                    onValueChange={(value) => setGrantData({ ...grantData, roleId: value })}
                  >
                    <SelectTrigger id="roleId" aria-label="Select role" aria-invalid={!!errors.role}>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {mockRoles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.role && (
                    <p className="text-sm text-destructive">{errors.role}</p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="accessLevel">
                  Access Level <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={grantData.accessLevel}
                  onValueChange={(value) =>
                    setGrantData({ ...grantData, accessLevel: value as AccessLevel })
                  }
                >
                  <SelectTrigger id="accessLevel" aria-label="Select access level" aria-invalid={!!errors.accessLevel}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="read">
                      <div className="flex items-center gap-2">
                        <Eye className="h-4 w-4" />
                        Read - View document only
                      </div>
                    </SelectItem>
                    <SelectItem value="write">
                      <div className="flex items-center gap-2">
                        <Edit className="h-4 w-4" />
                        Write - View and edit document
                      </div>
                    </SelectItem>
                    <SelectItem value="admin">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Admin - Full control including access management
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                {errors.accessLevel && (
                  <p className="text-sm text-destructive">{errors.accessLevel}</p>
                )}
              </div>

              {errors.submit && (
                <p className="text-sm text-destructive">{errors.submit}</p>
              )}
            </div>

            <ModalFooter>
              <Button variant="outline" onClick={handleCloseGrantModal}>
                Cancel
              </Button>
              <Button onClick={handleGrantAccess} aria-label="Grant access">
                <UserPlus className="mr-2 h-4 w-4" />
                Grant Access
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}
    </div>
  )
}

