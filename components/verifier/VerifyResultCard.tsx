'use client'

/**
 * Verify Result Card Component
 *
 * Displays verification results with accessible colors and status indicators.
 * Supports DCQL verification results with detailed claim display.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle2, XCircle, AlertTriangle, Clock, Shield } from 'lucide-react'
import type { VerificationResult } from '@/lib/verifier/dcql'

export interface VerifyResultCardProps {
  result: VerificationResult
  showClaims?: boolean
}

export function VerifyResultCard({ result, showClaims = true }: VerifyResultCardProps) {
  const getStatusConfig = () => {
    switch (result.status) {
      case 'success':
        return {
          icon: <CheckCircle2 className="h-6 w-6 text-green-600" aria-hidden="true" />,
          badgeClass: 'bg-green-100 text-green-800 border-green-300',
          badgeText: 'Valid',
          alertVariant: 'default' as const,
          alertClass: 'bg-green-50 border-green-200',
          textClass: 'text-green-900',
          title: 'Verification Successful',
          description: 'The credential is valid and has been successfully verified.',
        }
      case 'fail':
        return {
          icon: <XCircle className="h-6 w-6 text-red-600" aria-hidden="true" />,
          badgeClass: 'bg-red-100 text-red-800 border-red-300',
          badgeText: 'Invalid',
          alertVariant: 'destructive' as const,
          alertClass: 'bg-red-50 border-red-200',
          textClass: 'text-red-900',
          title: 'Verification Failed',
          description: 'The credential could not be verified or has been revoked.',
        }
      default:
        return {
          icon: <AlertTriangle className="h-6 w-6 text-yellow-600" aria-hidden="true" />,
          badgeClass: 'bg-yellow-100 text-yellow-800 border-yellow-300',
          badgeText: 'Unknown',
          alertVariant: 'default' as const,
          alertClass: 'bg-yellow-50 border-yellow-200',
          textClass: 'text-yellow-900',
          title: 'Status Unknown',
          description: 'The credential status could not be determined.',
        }
    }
  }

  const config = getStatusConfig()

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div role="img" aria-label={`Verification status: ${result.status}`}>
              {config.icon}
            </div>
            <div>
              <CardTitle className="text-xl">{config.title}</CardTitle>
              <CardDescription>{config.description}</CardDescription>
            </div>
          </div>
          <Badge className={`${config.badgeClass} border`} aria-label={`Status: ${config.badgeText}`}>
            {config.badgeText}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Credential Details */}
        <div className="space-y-3 p-4 bg-gray-50 rounded-lg border">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-muted-foreground">Credential ID</span>
            <code className="text-xs font-mono bg-white px-2 py-1 rounded border">{result.credentialId}</code>
          </div>

          {result.auditRef && (
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-muted-foreground">Audit Reference</span>
              <code className="text-xs font-mono bg-white px-2 py-1 rounded border">{result.auditRef}</code>
            </div>
          )}

          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-muted-foreground">Verified At</span>
            <span className="text-sm flex items-center gap-1">
              <Clock className="h-3 w-3" aria-hidden="true" />
              {result.timestamp.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Verified Claims */}
        {showClaims && result.claims && Object.keys(result.claims).length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Shield className="h-4 w-4" aria-hidden="true" />
              Verified Claims
            </h4>
            <div className="space-y-2 p-4 bg-blue-50 rounded-lg border border-blue-200">
              {Object.entries(result.claims).map(([key, value]) => (
                <div key={key} className="flex justify-between items-start">
                  <span className="text-sm font-medium text-blue-900 capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </span>
                  <span className="text-sm text-blue-700 text-right max-w-xs break-words">
                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Errors */}
        {result.errors && result.errors.length > 0 && (
          <Alert variant={config.alertVariant} className={config.alertClass}>
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <AlertDescription className={config.textClass}>
              <strong>Issues Found:</strong>
              <ul className="mt-2 list-disc list-inside space-y-1">
                {result.errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Success Message */}
        {result.status === 'success' && !result.errors && (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden="true" />
            <AlertDescription className="text-green-900">
              This credential has been cryptographically verified and is currently valid. All signatures and proofs
              have been validated successfully.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
