"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  Calendar,
  User,
  FileText,
  Copy,
  RefreshCw,
  Loader2,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { QRShare } from "@/components/QRShare"

interface VerificationResult {
  status: "valid" | "revoked" | "unknown"
  credentialId: string
  auditRef?: string
  timestamp?: string
  details?: {
    issuer?: string
    issuedDate?: string
    expiryDate?: string
    reason?: string
    disclosureType?: string
  }
}

interface VerifyResultProps {
  result: VerificationResult
  onRecheck: () => void
  isRechecking: boolean
  lastCheckTime?: Date | null
}

export function VerifyResult({ result, onRecheck, isRechecking, lastCheckTime }: VerifyResultProps) {
  const { toast } = useToast()

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "valid":
        return {
          icon: <CheckCircle className="h-6 w-6" />,
          color: "text-green-600",
          bgColor: "bg-green-50 border-green-200",
          badgeColor: "bg-green-100 text-green-800",
          title: "Credential Valid",
          description: "This credential has been successfully verified and is currently active.",
        }
      case "revoked":
        return {
          icon: <AlertTriangle className="h-6 w-6" />,
          color: "text-red-600",
          bgColor: "bg-red-50 border-red-200",
          badgeColor: "bg-red-100 text-red-800",
          title: "Credential Revoked",
          description: "This credential has been revoked and is no longer valid.",
        }
      case "unknown":
        return {
          icon: <XCircle className="h-6 w-6" />,
          color: "text-gray-600",
          bgColor: "bg-gray-50 border-gray-200",
          badgeColor: "bg-gray-100 text-gray-800",
          title: "Credential Unknown",
          description: "This credential could not be found in our verification system.",
        }
      default:
        return {
          icon: <XCircle className="h-6 w-6" />,
          color: "text-gray-600",
          bgColor: "bg-gray-50 border-gray-200",
          badgeColor: "bg-gray-100 text-gray-800",
          title: "Unknown Status",
          description: "Unable to determine credential status.",
        }
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
    <Card className={`${config.bgColor} border-2 shadow-lg`} role="region" aria-live="polite">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={config.color} aria-hidden="true">{config.icon}</div>
            <div>
              <CardTitle className="text-lg">{config.title}</CardTitle>
              <CardDescription className="text-sm">{config.description}</CardDescription>
            </div>
          </div>
          <Badge className={`capitalize ${config.badgeColor}`}>
            {result.status}
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-gray-500" aria-hidden="true" />
              <span className="font-medium">Credential ID:</span>
              <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{result.credentialId}</span>
            </div>

            {result.details?.issuer && (
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-gray-500" aria-hidden="true" />
                <span className="font-medium">Issuer:</span>
                <span>{result.details.issuer}</span>
              </div>
            )}
          </div>

          {result.details && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {result.details.issuedDate && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-gray-500" aria-hidden="true" />
                  <span className="font-medium">Issued:</span>
                  <span>{new Date(result.details.issuedDate).toLocaleDateString()}</span>
                </div>
              )}

              {result.details.expiryDate && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-gray-500" aria-hidden="true" />
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

          {result.timestamp && (
            <div className="mt-2">
              <Badge variant="outline" className="text-xs">
                Verified: {new Date(result.timestamp).toLocaleString()}
              </Badge>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t">
            <Button
              onClick={onRecheck}
              disabled={isRechecking}
              variant="outline"
              size="sm"
              className="flex-1 bg-transparent"
              aria-label="Re-check credential status"
            >
              {isRechecking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Re-checking...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Recheck
                </>
              )}
            </Button>

            <Button
              onClick={() => copyToClipboard(result.credentialId, "Credential ID")}
              variant="outline"
              size="sm"
              className="flex-1 bg-transparent"
              aria-label="Copy credential ID to clipboard"
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy ID
            </Button>

            <QRShare
              credentialId={result.credentialId}
              status={result.status}
              details={result.details}
            />
          </div>

          {lastCheckTime && (
            <p className="text-xs text-gray-500 text-center">
              Last checked: {lastCheckTime.toLocaleTimeString()}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

