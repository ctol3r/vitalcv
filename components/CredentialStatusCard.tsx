"use client"

import { useState, useMemo } from "react"
import { QRCodeSVG } from "qrcode.react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Calendar, User, FileText, QrCode, Share2, Copy, ExternalLink } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { getCredentialStatusConfig } from "@/lib/credential-status-config"

interface VerificationResult {
  status: "valid" | "revoked" | "expired" | "unknown"
  credentialId: string
  auditRef?: string
  details?: {
    issuer?: string
    issuedDate?: string
    expiryDate?: string
    reason?: string
    disclosureType?: string
  }
}

interface CredentialStatusCardProps {
  result: VerificationResult
}

export function CredentialStatusCard({ result }: CredentialStatusCardProps) {
  const [qrDialogOpen, setQrDialogOpen] = useState(false)
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [vpToken, setVpToken] = useState<string | null>(null)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const { toast } = useToast()

  // Get configuration from centralized config
  const config = getCredentialStatusConfig(result.status)
  const StatusIcon = config.icon

  const generateVPToken = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/verifier/vp-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          credentialId: result.credentialId,
          status: result.status,
          details: result.details,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to generate VP token")
      }

      const data = await response.json()
      setVpToken(data.vpToken)
    } catch (err) {
      toast({
        title: "Failed to Generate VP Token",
        description: "Please check your internet connection and try again. If the problem persists, contact support.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const generateShareUrl = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/share/one-time-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          credentialId: result.credentialId,
          status: result.status,
          details: result.details,
          expiresIn: 3600, // 1 hour
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to generate share URL")
      }

      const data = await response.json()
      setShareUrl(data.shareUrl)
    } catch (err) {
      toast({
        title: "Failed to Generate Share URL",
        description: "Please check your internet connection and try again. If the problem persists, contact support.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({
        title: "Copied",
        description: `${type} copied to clipboard`,
      })
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      })
    }
  }

  return (
    <Card className={`${config.bgColor} ${config.borderColor} border-2 shadow-lg`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={config.color} aria-hidden="true">
              <StatusIcon className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-lg">{config.title}</CardTitle>
              <CardDescription className="text-sm">{config.description}</CardDescription>
            </div>
          </div>
          <Badge variant={config.badgeVariant} className={`capitalize ${config.badgeColor}`}>
            {result.status}
            <span className="sr-only">{config.ariaLabel}</span>
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-gray-500" />
              <span className="font-medium">Credential ID:</span>
              <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{result.credentialId}</span>
            </div>

            {result.details?.issuer && (
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-gray-500" />
                <span className="font-medium">Issuer:</span>
                <span>{result.details.issuer}</span>
              </div>
            )}
          </div>

          {result.details && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {result.details.issuedDate && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <span className="font-medium">Issued:</span>
                  <span>{new Date(result.details.issuedDate).toLocaleDateString()}</span>
                </div>
              )}

              {result.details.expiryDate && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <span className="font-medium">Expires:</span>
                  <span>{new Date(result.details.expiryDate).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          )}

          {result.details?.reason && (
            <div className="mt-4 p-3 bg-white/50 rounded-lg border">
              <p className="text-sm">
                <span className="font-medium">Reason:</span> {result.details.reason}
              </p>
            </div>
          )}

          {result.details?.disclosureType && (
            <div className="mt-2">
              <Badge variant="outline" className="text-xs">
                {result.details.disclosureType}
              </Badge>
            </div>
          )}

          {result.auditRef && (
            <div className="mt-2">
              <Badge variant="outline" className="text-xs">
                Audit Reference: {result.auditRef}
              </Badge>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t">
            <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 bg-transparent"
                  onClick={() => {
                    if (!vpToken) {
                      generateVPToken()
                    }
                  }}
                >
                  <QrCode className="h-4 w-4 mr-2" />
                  Show QR Code
                </Button>
              </DialogTrigger>
              <DialogContent
                className="sm:max-w-md"
                aria-labelledby="qr-dialog-title"
                aria-describedby="qr-dialog-desc"
              >
                <DialogHeader>
                  <DialogTitle id="qr-dialog-title">Verifiable Presentation QR Code</DialogTitle>
                  <DialogDescription id="qr-dialog-desc">
                    Scan this QR code to access the verifiable presentation token
                  </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col items-center space-y-4">
                  {loading ? (
                    <div
                      className="flex items-center justify-center size-48 bg-muted rounded-lg"
                      role="status"
                      aria-live="polite"
                    >
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary">
                        <span className="sr-only">Generating VP token...</span>
                      </div>
                    </div>
                  ) : vpToken ? (
                    <>
                      <div className="p-4 bg-white dark:bg-card border-2 border-border rounded-lg">
                        <QRCodeSVG value={vpToken} size={200} level="H" includeMargin={false} />
                      </div>
                      <div className="flex items-center gap-2 w-full">
                        <code className="flex-1 text-xs bg-muted p-2 rounded truncate font-mono">{vpToken}</code>
                        <Button size="sm" variant="outline" onClick={() => copyToClipboard(vpToken, "VP Token")}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </>
                  ) : (
                    <Alert variant="destructive">
                      <AlertTitle>Generation Failed</AlertTitle>
                      <AlertDescription>
                        Failed to generate VP token. Please check your connection and try again.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 bg-transparent"
                  onClick={() => {
                    if (!shareUrl) {
                      generateShareUrl()
                    }
                  }}
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Share Link
                </Button>
              </DialogTrigger>
              <DialogContent
                className="sm:max-w-md"
                aria-labelledby="share-dialog-title"
                aria-describedby="share-dialog-desc"
              >
                <DialogHeader>
                  <DialogTitle id="share-dialog-title">One-Time Share Link</DialogTitle>
                  <DialogDescription id="share-dialog-desc">
                    This link will expire in 1 hour and can only be accessed once
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  {loading ? (
                    <div className="flex items-center justify-center h-16" role="status" aria-live="polite">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary">
                        <span className="sr-only">Generating share URL...</span>
                      </div>
                    </div>
                  ) : shareUrl ? (
                    <>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-sm bg-muted p-3 rounded break-all font-mono">{shareUrl}</code>
                        <Button size="sm" variant="outline" onClick={() => copyToClipboard(shareUrl, "Share URL")}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 bg-transparent"
                          onClick={() => window.open(shareUrl, "_blank")}
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Open Link
                        </Button>
                        <Button size="sm" className="flex-1" onClick={() => copyToClipboard(shareUrl, "Share URL")}>
                          <Copy className="h-4 w-4 mr-2" />
                          Copy Link
                        </Button>
                      </div>
                      <Alert>
                        <AlertDescription className="text-xs">
                          This link will expire in 1 hour and can only be accessed once for security.
                        </AlertDescription>
                      </Alert>
                    </>
                  ) : (
                    <Alert>
                      <AlertDescription>Failed to generate share URL. Please try again.</AlertDescription>
                    </Alert>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
