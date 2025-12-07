'use client'

import { useEffect, useState } from 'react'
import { Download, FileText, History, CheckCircle2, Clock, User } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface SignedContractViewerProps {
  contractId: string
}

interface ContractVersion {
  id: string
  version: string
  createdAt: string
  createdBy: string
  createdByName: string
  changes?: string
}

interface Signature {
  id: string
  signatoryId: string
  signatoryName: string
  signatoryEmail: string
  role?: string
  signedAt: string
  signatureMethod: 'electronic' | 'digital'
  certificateUrl?: string
}

interface CertificateOfCompletion {
  contractId: string
  version: string
  completedAt: string
  allSignaturesComplete: boolean
  signatures: Signature[]
  documentHash: string
  certificateUrl?: string
}

export function SignedContractViewer({ contractId }: SignedContractViewerProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedVersion, setSelectedVersion] = useState<string>('latest')
  const [versions, setVersions] = useState<ContractVersion[]>([])
  const [signatures, setSignatures] = useState<Signature[]>([])
  const [certificate, setCertificate] = useState<CertificateOfCompletion | null>(null)
  const [contractContent, setContractContent] = useState<string>('')
  const [signedPdfUrl, setSignedPdfUrl] = useState<string | null>(null)

  useEffect(() => {
    loadContractData()
  }, [contractId, selectedVersion])

  async function loadContractData() {
    setLoading(true)
    setError(null)

    try {
      const [versionsRes, signaturesRes, certificateRes, contentRes] = await Promise.all([
        fetch(`/api/demo/org/contracts/${contractId}/versions`),
        fetch(`/api/demo/org/contracts/${contractId}/signatures`),
        fetch(`/api/demo/org/contracts/${contractId}/certificate`),
        fetch(`/api/demo/org/contracts/${contractId}/content?version=${selectedVersion}`),
      ])

      if (versionsRes.ok) {
        const versionsData = await versionsRes.json()
        setVersions(versionsData.versions || [])
      }

      if (signaturesRes.ok) {
        const signaturesData = await signaturesRes.json()
        setSignatures(signaturesData.signatures || [])
      }

      if (certificateRes.ok) {
        const certificateData = await certificateRes.json()
        setCertificate(certificateData.certificate || null)
        setSignedPdfUrl(certificateData.signedPdfUrl || null)
      }

      if (contentRes.ok) {
        const contentData = await contentRes.json()
        setContractContent(contentData.content || '')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load contract data')
    } finally {
      setLoading(false)
    }
  }

  function handleDownload() {
    if (signedPdfUrl) {
      window.open(signedPdfUrl, '_blank')
    } else {
      // Fallback: generate download link
      const link = document.createElement('a')
      link.href = `/api/demo/org/contracts/${contractId}/download?version=${selectedVersion}`
      link.download = `contract-${contractId}-${selectedVersion}.pdf`
      link.click()
    }
  }

  function handleDownloadCertificate() {
    if (certificate?.certificateUrl) {
      window.open(certificate.certificateUrl, '_blank')
    } else {
      const link = document.createElement('a')
      link.href = `/api/demo/org/contracts/${contractId}/certificate/download`
      link.download = `certificate-${contractId}.pdf`
      link.click()
    }
  }

  if (loading) {
    return (
      <div className="py-8 text-center text-muted-foreground">Loading contract...</div>
    )
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Error</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Signed Contract</h3>
          <p className="text-sm text-muted-foreground">Contract ID: {contractId}</p>
        </div>
        <div className="flex gap-2">
          {versions.length > 1 && (
            <Select value={selectedVersion} onValueChange={setSelectedVersion}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select version" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="latest">Latest Version</SelectItem>
                {versions.map((version) => (
                  <SelectItem key={version.id} value={version.version}>
                    Version {version.version}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
          {certificate && (
            <Button variant="outline" onClick={handleDownloadCertificate}>
              <FileText className="h-4 w-4 mr-2" />
              Certificate
            </Button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="document" className="w-full">
        <TabsList>
          <TabsTrigger value="document">Document</TabsTrigger>
          <TabsTrigger value="signatures">Signatures</TabsTrigger>
          <TabsTrigger value="history">Version History</TabsTrigger>
          {certificate && <TabsTrigger value="certificate">Certificate</TabsTrigger>}
        </TabsList>

        {/* Document Tab */}
        <TabsContent value="document" className="space-y-4">
          {signedPdfUrl ? (
            <Card>
              <CardContent className="pt-6">
                <iframe
                  src={signedPdfUrl}
                  className="w-full h-[600px] border rounded-lg"
                  title="Contract Document"
                />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Contract Content</CardTitle>
                <CardDescription>Version {selectedVersion === 'latest' ? versions[0]?.version || '1.0' : selectedVersion}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none">
                  <pre className="whitespace-pre-wrap font-sans text-sm bg-muted p-4 rounded-lg">
                    {contractContent || 'Contract content not available'}
                  </pre>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Signatures Tab */}
        <TabsContent value="signatures" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Signatures</CardTitle>
              <CardDescription>
                {signatures.length} signature{signatures.length !== 1 ? 's' : ''} collected
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {signatures.map((signature) => (
                  <Card key={signature.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-4">
                        <div className="mt-1">
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">{signature.signatoryName}</div>
                          <div className="text-sm text-muted-foreground">
                            {signature.signatoryEmail}
                            {signature.role && ` • ${signature.role}`}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Signed {new Date(signature.signedAt).toLocaleString()}
                          </div>
                          <Badge variant="outline" className="mt-2">
                            {signature.signatureMethod === 'digital' ? 'Digital Signature' : 'Electronic Signature'}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {signatures.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    No signatures found
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Version History Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Version History</CardTitle>
              <CardDescription>
                {versions.length} version{versions.length !== 1 ? 's' : ''} available
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {versions.map((version) => (
                  <Card key={version.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-4">
                        <div className="mt-1">
                          <History className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Version {version.version}</span>
                            {version.version === (selectedVersion === 'latest' ? versions[0]?.version : selectedVersion) && (
                              <Badge variant="default">Current</Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            Created by {version.createdByName} on {new Date(version.createdAt).toLocaleString()}
                          </div>
                          {version.changes && (
                            <div className="text-sm mt-2 p-2 bg-muted rounded">
                              <strong>Changes:</strong> {version.changes}
                            </div>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedVersion(version.version)}
                        >
                          View
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {versions.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    No version history available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Certificate Tab */}
        {certificate && (
          <TabsContent value="certificate" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Certificate of Completion</CardTitle>
                <CardDescription>
                  This certificate confirms that all parties have signed the contract
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="text-sm font-medium mb-1">Contract ID</div>
                    <div className="text-sm text-muted-foreground">{certificate.contractId}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium mb-1">Version</div>
                    <div className="text-sm text-muted-foreground">{certificate.version}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium mb-1">Completed At</div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(certificate.completedAt).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium mb-1">Status</div>
                    <Badge variant={certificate.allSignaturesComplete ? 'default' : 'secondary'}>
                      {certificate.allSignaturesComplete ? 'Complete' : 'Pending'}
                    </Badge>
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium mb-2">Document Hash</div>
                  <div className="text-xs font-mono bg-muted p-2 rounded break-all">
                    {certificate.documentHash}
                  </div>
                </div>
                {certificate.certificateUrl && (
                  <div className="pt-4">
                    <Button onClick={handleDownloadCertificate}>
                      <Download className="h-4 w-4 mr-2" />
                      Download Certificate
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}

