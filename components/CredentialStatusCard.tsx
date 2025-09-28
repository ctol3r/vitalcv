"use client"

import { useState } from "react"
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
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  Calendar,
  User,
  FileText,
  QrCode,
  Share2,
  Copy,
  ExternalLink,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface VerificationResult {
  status: "valid" | "revoked" | "unknown"
  credentialId: string
  auditRef?: string // Added auditRef field
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

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "valid":
        return {
          icon: <CheckCircle className="h-6 w-6" />,
          color: "text-green-600",
          bgColor: "bg-green-50 border-green-200",
          badgeVariant: "default" as const,
          badgeColor: "bg-green-100 text-green-800", // Added specific badge colors
          title: "Credential Valid",
          description: "This credential has been successfully verified and is currently active.",
        }
      case "revoked":
        return {
          icon: <AlertTriangle className="h-6 w-6" />,
          color: "text-red-600", // Changed from yellow to red for revoked
          bgColor: "bg-red-50 border-red-200", // Changed from yellow to red
          badgeVariant: "destructive" as const, // Changed to destructive variant
          badgeColor: "bg-red-100 text-red-800", // Added specific badge colors
          title: "Credential Revoked",
          description: "This credential has been revoked and is no longer valid.",
        }
      case "unknown":
        return {
          icon: <XCircle className="h-6 w-6" />,
          color: "text-gray-600", // Changed from red to gray for unknown
          bgColor: "bg-gray-50 border-gray-200", // Changed from red to gray
          badgeVariant: "secondary" as const, // Changed to secondary variant
          badgeColor: "bg-gray-100 text-gray-800", // Added specific badge colors
          title: "Credential Unknown",
          description: "This credential could not be found in our verification system.",
        }
      default:
        return {
          icon: <XCircle className="h-6 w-6" />,
          color: "text-gray-600",
          bgColor: "bg-gray-50 border-gray-200",
          badgeVariant: "secondary" as const,
          badgeColor: "bg-gray-100 text-gray-800",
          title: "Unknown Status",
          description: "Unable to determine credential status.",
        }
    }
  }

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
        title: "Error",
        description: "Failed to generate VP token",
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
        title: "Error",
        description: "Failed to generate share URL",
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

  const config = getStatusConfig(result.status)

  return (
    <Card className={`${config.bgColor} border-2 shadow-lg`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={config.color}>{config.icon}</div>
            <div>
              <CardTitle className="text-lg">{config.title}</CardTitle>
              <CardDescription className="text-sm">{config.description}</CardDescription>
            </div>
          </div>
          <Badge variant={config.badgeVariant} className={`capitalize ${config.badgeColor}`}>
            {result.status}
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
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Verifiable Presentation QR Code</DialogTitle>
                  <DialogDescription>Scan this QR code to access the verifiable presentation token</DialogDescription>
                </DialogHeader>
                <div className="flex flex-col items-center space-y-4">
                  {loading ? (
                    <div className="flex items-center justify-center h-48 w-48 bg-gray-100 rounded-lg">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                  ) : vpToken ? (
                    <>
                      <div className="h-48 w-48 bg-white border-2 border-gray-200 rounded-lg flex items-center justify-center">
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(vpToken)}`}
                          alt="VP Token QR Code"
                          className="h-44 w-44"
                        />
                      </div>
                      <div className="flex items-center gap-2 w-full">
                        <code className="flex-1 text-xs bg-gray-100 p-2 rounded truncate">{vpToken}</code>
                        <Button size="sm" variant="outline" onClick={() => copyToClipboard(vpToken, "VP Token")}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </>
                  ) : (
                    <Alert>
                      <AlertDescription>Failed to generate VP token. Please try again.</AlertDescription>
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
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>One-Time Share Link</DialogTitle>
                  <DialogDescription>This link will expire in 1 hour and can only be accessed once</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  {loading ? (
                    <div className="flex items-center justify-center h-16">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    </div>
                  ) : shareUrl ? (
                    <>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-sm bg-gray-100 p-3 rounded break-all">{shareUrl}</code>
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
