'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import {
  FileText,
  CheckCircle2,
  XCircle,
  Users,
  Clock,
  AlertCircle,
  PenTool,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

type SignatureStatus = 'PENDING' | 'SIGNED' | 'DECLINED'

interface Contract {
  id: string
  title: string
  currentVersion?: {
    content: string
  }
  parties: ContractParty[]
}

interface ContractParty {
  id: string
  contactName: string | null
  contactEmail: string | null
  role: 'SIGNER' | 'WITNESS' | 'OBSERVER'
  signatureStatus: SignatureStatus
  signedAt: string | null
}

export default function ContractSigningPage() {
  const router = useRouter()
  const params = useParams()
  const contractId = params.contractId as string
  const [contract, setContract] = useState<Contract | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [signing, setSigning] = useState(false)
  const [declining, setDeclining] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    if (contractId) {
      loadContract()
      // In a real app, get current user ID from auth context
      setCurrentUserId('current-user-id')
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

  function getSignatureStatusBadge(status: SignatureStatus) {
    const variants: Record<SignatureStatus, { variant: 'default' | 'secondary' | 'outline' | 'destructive'; icon: any; label: string }> = {
      PENDING: { variant: 'outline', icon: Clock, label: 'Pending' },
      SIGNED: { variant: 'default', icon: CheckCircle2, label: 'Signed' },
      DECLINED: { variant: 'destructive', icon: XCircle, label: 'Declined' },
    }
    const { variant, icon: Icon, label } = variants[status]
    return (
      <Badge variant={variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {label}
      </Badge>
    )
  }

  function renderMarkdown(content: string) {
    return (
      <div className="prose prose-sm max-w-none">
        <pre className="whitespace-pre-wrap font-sans">{content}</pre>
      </div>
    )
  }

  async function handleSign() {
    if (!contract || !currentUserId) return
    try {
      setSigning(true)
      // Integrate with e-signature provider (e.g., DocuSign, HelloSign)
      const response = await fetch(`/api/contracts/${contractId}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partyId: contract.parties.find(p => p.contactEmail === currentUserId)?.id,
        }),
      })
      if (!response.ok) {
        throw new Error('Failed to sign contract')
      }
      // Redirect to success page or refresh
      router.push(`/contracts/${contractId}?signed=true`)
    } catch (err: any) {
      setError(err.message ?? 'Failed to sign contract')
    } finally {
      setSigning(false)
    }
  }

  async function handleDecline() {
    if (!contract || !currentUserId) return
    try {
      setDeclining(true)
      const response = await fetch(`/api/contracts/${contractId}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partyId: contract.parties.find(p => p.contactEmail === currentUserId)?.id,
        }),
      })
      if (!response.ok) {
        throw new Error('Failed to decline contract')
      }
      router.push(`/contracts/${contractId}?declined=true`)
    } catch (err: any) {
      setError(err.message ?? 'Failed to decline contract')
    } finally {
      setDeclining(false)
    }
  }

  const currentUserParty = contract?.parties.find(p => p.contactEmail === currentUserId)
  const canSign = currentUserParty?.signatureStatus === 'PENDING' && currentUserParty?.role === 'SIGNER'
  const allSignersSigned = contract?.parties.filter(p => p.role === 'SIGNER').every(p => p.signatureStatus === 'SIGNED')

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="py-16 text-center text-muted-foreground">Loading contract…</div>
      </div>
    )
  }

  if (error || !contract) {
    return (
      <div className="container mx-auto py-8">
        <Card className="border-destructive" role="alert">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
            <CardDescription>{error || 'Contract not found'}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/contracts/dashboard')}>
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto space-y-6 py-8 max-w-4xl">
      <header className="space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Link
            href={`/contracts/${contractId}`}
            className="text-sm text-muted-foreground hover:underline"
          >
            Contract
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-medium">Sign</span>
        </div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <FileText className="h-7 w-7 text-primary" aria-hidden="true" />
          Sign Contract
        </h1>
        <p className="text-muted-foreground">{contract.title}</p>
      </header>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {allSignersSigned && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Contract Fully Signed</AlertTitle>
          <AlertDescription>
            All parties have signed this contract. The contract is now active.
          </AlertDescription>
        </Alert>
      )}

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Signing Instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p>
              Please review the contract content below carefully before signing.
            </p>
            <p>
              By clicking "Sign Contract", you agree to the terms and conditions outlined in this document.
            </p>
            {currentUserParty && (
              <p className="font-medium">
                Your role: <Badge variant="outline">{currentUserParty.role}</Badge>
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Contract Content */}
      <Card>
        <CardHeader>
          <CardTitle>Contract Content</CardTitle>
          <CardDescription>Read-only view of the contract to be signed</CardDescription>
        </CardHeader>
        <CardContent>
          {contract.currentVersion ? (
            <div className="border rounded-lg p-4 bg-muted/50 max-h-[600px] overflow-y-auto">
              {renderMarkdown(contract.currentVersion.content)}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              No content available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Signature Status */}
      <Card>
        <CardHeader>
          <CardTitle>Signature Status</CardTitle>
          <CardDescription>Current status of all parties</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Party</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contract.parties.map((party) => (
                <TableRow key={party.id}>
                  <TableCell className="font-medium">
                    {party.contactName || party.contactEmail || 'Unknown'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{party.role}</Badge>
                  </TableCell>
                  <TableCell>{getSignatureStatusBadge(party.signatureStatus)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Signing Actions */}
      {canSign && (
        <Card>
          <CardHeader>
            <CardTitle>Sign Contract</CardTitle>
            <CardDescription>
              Review the contract above, then sign or decline
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Button
                variant="destructive"
                onClick={handleDecline}
                disabled={declining}
                className="flex-1"
              >
                <XCircle className="h-4 w-4 mr-2" />
                {declining ? 'Declining...' : 'Decline'}
              </Button>
              <Button
                onClick={handleSign}
                disabled={signing}
                className="flex-1"
              >
                <PenTool className="h-4 w-4 mr-2" />
                {signing ? 'Signing...' : 'Sign Contract'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!canSign && currentUserParty && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">
              {currentUserParty.signatureStatus === 'SIGNED' && (
                <p>You have already signed this contract.</p>
              )}
              {currentUserParty.signatureStatus === 'DECLINED' && (
                <p>You have declined this contract.</p>
              )}
              {currentUserParty.role !== 'SIGNER' && (
                <p>You are not a signer for this contract.</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

