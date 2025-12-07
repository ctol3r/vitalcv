'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Building2, Mail, Phone, Globe, MapPin, Edit, Send, RefreshCw, AlertCircle, CheckCircle2, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { VendorContracts } from '@/components/vendor/VendorContracts'
import { VendorDocumentsUpload } from '@/components/vendor/VendorDocumentsUpload'
import { VendorCommunication } from '@/components/vendor/VendorCommunication'
import Link from 'next/link'

interface VendorProfile {
  id: string
  name: string
  email: string
  phone?: string
  website?: string
  address?: string
  taxId?: string
  description?: string
  category?: {
    id: string
    name: string
  }
  riskScore?: number
  complianceStatus: 'compliant' | 'non_compliant' | 'pending' | 'expired'
  createdAt: string
  updatedAt: string
}

interface Contact {
  id: string
  name: string
  email: string
  phone?: string
  role: string
  isPrimary: boolean
}

export default function VendorProfilePage() {
  const params = useParams()
  const vendorId = params.vendorId as string

  const [vendor, setVendor] = useState<VendorProfile | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchVendorProfile()
  }, [vendorId])

  async function fetchVendorProfile() {
    try {
      setLoading(true)
      const response = await fetch(`/api/demo/vendor/${vendorId}`)
      if (!response.ok) throw new Error('Failed to fetch vendor profile')
      const payload = await response.json()
      setVendor(payload.vendor || payload)

      // Fetch contacts
      const contactsResponse = await fetch(`/api/demo/vendor/${vendorId}/contacts`)
      if (contactsResponse.ok) {
        const contactsData = await contactsResponse.json()
        setContacts(contactsData.contacts || [])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  function getComplianceBadge(status: VendorProfile['complianceStatus']) {
    const configs = {
      compliant: { variant: 'default' as const, icon: CheckCircle2, label: 'Compliant' },
      non_compliant: { variant: 'destructive' as const, icon: XCircle, label: 'Non-Compliant' },
      pending: { variant: 'secondary' as const, icon: AlertCircle, label: 'Pending' },
      expired: { variant: 'destructive' as const, icon: XCircle, label: 'Expired' },
    }
    const config = configs[status] || configs.pending
    const Icon = config.icon
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    )
  }

  function getRiskBadge(riskScore?: number) {
    if (riskScore === undefined) return null
    const color =
      riskScore < 30 ? 'bg-green-600' : riskScore < 70 ? 'bg-yellow-600' : 'bg-red-600'
    const label = riskScore < 30 ? 'Low' : riskScore < 70 ? 'Medium' : 'High'
    return (
      <div className="flex items-center gap-2">
        <span className="text-2xl font-bold">{riskScore}</span>
        <Badge variant="outline" className={color}>
          {label} Risk
        </Badge>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-sm text-muted-foreground">Loading vendor profile...</div>
      </div>
    )
  }

  if (error || !vendor) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-sm text-destructive">Error: {error || 'Vendor not found'}</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{vendor.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Vendor Profile • Created {new Date(vendor.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchVendorProfile}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline">
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button>
            <Send className="h-4 w-4 mr-2" />
            Send Message
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Risk Score</CardTitle>
          </CardHeader>
          <CardContent>
            {getRiskBadge(vendor.riskScore)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Compliance Status</CardTitle>
          </CardHeader>
          <CardContent>
            {getComplianceBadge(vendor.complianceStatus)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">
              {vendor.category?.name || 'Uncategorized'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="contracts">Contracts</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="communication">Communication</TabsTrigger>
          <TabsTrigger value="performance">
            <Link href={`/demo/vendor/${vendorId}/performance`}>Performance</Link>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Vendor Details */}
          <Card>
            <CardHeader>
              <CardTitle>Vendor Information</CardTitle>
              <CardDescription>Basic vendor details and contact information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <div className="text-sm font-medium text-muted-foreground">Name</div>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span>{vendor.name}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium text-muted-foreground">Email</div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a href={`mailto:${vendor.email}`} className="text-primary hover:underline">
                      {vendor.email}
                    </a>
                  </div>
                </div>
                {vendor.phone && (
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-muted-foreground">Phone</div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <a href={`tel:${vendor.phone}`} className="text-primary hover:underline">
                        {vendor.phone}
                      </a>
                    </div>
                  </div>
                )}
                {vendor.website && (
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-muted-foreground">Website</div>
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <a
                        href={vendor.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {vendor.website}
                      </a>
                    </div>
                  </div>
                )}
                {vendor.address && (
                  <div className="space-y-1 md:col-span-2">
                    <div className="text-sm font-medium text-muted-foreground">Address</div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{vendor.address}</span>
                    </div>
                  </div>
                )}
                {vendor.taxId && (
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-muted-foreground">Tax ID / EIN</div>
                    <span>{vendor.taxId}</span>
                  </div>
                )}
              </div>
              {vendor.description && (
                <div className="space-y-1 pt-4 border-t">
                  <div className="text-sm font-medium text-muted-foreground">Description</div>
                  <p className="text-sm">{vendor.description}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline">
                  <Send className="h-4 w-4 mr-2" />
                  Request Renewal
                </Button>
                <Button variant="outline">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Update Compliance
                </Button>
                <Link href={`/demo/vendor/${vendorId}/performance`}>
                  <Button variant="outline">
                    View Performance
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contacts">
          <Card>
            <CardHeader>
              <CardTitle>Contacts</CardTitle>
              <CardDescription>Vendor contact persons</CardDescription>
            </CardHeader>
            <CardContent>
              {contacts.length > 0 ? (
                <div className="space-y-4">
                  {contacts.map((contact) => (
                    <Card key={contact.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{contact.name}</span>
                              {contact.isPrimary && (
                                <Badge variant="default">Primary</Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">
                              {contact.role}
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">
                              <a href={`mailto:${contact.email}`} className="text-primary hover:underline">
                                {contact.email}
                              </a>
                              {contact.phone && (
                                <>
                                  {' • '}
                                  <a href={`tel:${contact.phone}`} className="text-primary hover:underline">
                                    {contact.phone}
                                  </a>
                                </>
                              )}
                            </div>
                          </div>
                          <Button variant="outline" size="sm">
                            <Send className="h-4 w-4 mr-1" />
                            Message
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No contacts available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contracts">
          <VendorContracts vendorId={vendorId} />
        </TabsContent>

        <TabsContent value="documents">
          <VendorDocumentsUpload vendorId={vendorId} />
        </TabsContent>

        <TabsContent value="communication">
          <VendorCommunication vendorId={vendorId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

