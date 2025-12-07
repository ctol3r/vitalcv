'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ExternalLink, Info, Link as LinkIcon, Shield } from 'lucide-react'

interface ExplainabilityReportProps {
  credentialId: string
}

interface Explanation {
  id: string
  credentialId: string
  model: string
  explanation: string
  dataSources: Array<{
    id: string
    name: string
    type: string
    url?: string
  }>
  confidence: number
  timestamp: Date
  metadata?: Record<string, unknown>
}

const MOCK_EXPLANATION: Explanation = {
  id: 'expl-1',
  credentialId: 'cred-12345',
  model: 'local-stub-v0',
  explanation:
    'This credential decision was made based on the following factors:\n\n' +
    '1. **NPPES Verification**: The provider\'s NPI was verified against the NPPES registry and confirmed active.\n\n' +
    '2. **State Board License**: A valid medical license was found in the state board database with no restrictions.\n\n' +
    '3. **AI Link Inference**: The system identified connections between this provider and verified institutions.\n\n' +
    '4. **Credential Verification**: All submitted credentials were verified against issuer records.\n\n' +
    'The decision to grant this credential was made with high confidence based on the consistency of data across multiple sources.',
  dataSources: [
    {
      id: 'nppes-1',
      name: 'NPPES Registry',
      type: 'external_api',
      url: 'https://npiregistry.cms.hhs.gov/api/?number=1234567893',
    },
    {
      id: 'state-board-1',
      name: 'State Medical Board Database',
      type: 'external_api',
      url: 'https://stateboard.example.gov/license/12345',
    },
    {
      id: 'ai-links-1',
      name: 'AI Link Inference Service',
      type: 'internal_service',
    },
    {
      id: 'cred-verify-1',
      name: 'Credential Verification Service',
      type: 'internal_service',
    },
  ],
  confidence: 0.92,
  timestamp: new Date('2025-01-15T10:30:00Z'),
  metadata: {
    decisionType: 'credential_grant',
    riskLevel: 'low',
    auditTrail: 'anchored-on-chain',
  },
}

export function ExplainabilityReport({ credentialId }: ExplainabilityReportProps) {
  const [explanation, setExplanation] = useState<Explanation | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // In production, fetch explanation from API
    // For now, use mock data
    setIsLoading(true)
    setTimeout(() => {
      setExplanation(MOCK_EXPLANATION)
      setIsLoading(false)
    }, 500)
  }, [credentialId])

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-green-600'
    if (confidence >= 0.7) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getConfidenceBadgeVariant = (confidence: number) => {
    if (confidence >= 0.9) return 'default'
    if (confidence >= 0.7) return 'secondary'
    return 'destructive'
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground">Loading explanation...</p>
      </div>
    )
  }

  if (!explanation) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground">No explanation found for this credential</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Explainability Report</CardTitle>
              <CardDescription>
                Human-readable explanation for credential decision
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={getConfidenceBadgeVariant(explanation.confidence)}>
                {(explanation.confidence * 100).toFixed(0)}% Confidence
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Model Info */}
          <div className="flex items-center gap-2 text-sm">
            <Info className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Model:</span>
            <span className="font-medium">{explanation.model}</span>
            <span className="text-muted-foreground">•</span>
            <span className="text-muted-foreground">
              Generated: {explanation.timestamp.toLocaleString()}
            </span>
          </div>

          {/* Explanation Text */}
          <div className="prose prose-sm max-w-none">
            <div className="whitespace-pre-wrap text-sm leading-relaxed">
              {explanation.explanation.split('\n').map((line, index) => {
                if (line.startsWith('**') && line.endsWith('**')) {
                  return (
                    <h3 key={index} className="font-semibold mt-4 mb-2 text-base">
                      {line.replace(/\*\*/g, '')}
                    </h3>
                  )
                }
                if (line.trim() === '') {
                  return <br key={index} />
                }
                return <p key={index} className="mb-2">{line}</p>
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Sources */}
      <Card>
        <CardHeader>
          <CardTitle>Underlying Data Sources</CardTitle>
          <CardDescription>
            Links to the data sources used in this decision
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {explanation.dataSources.map((source) => (
              <div
                key={source.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'p-2 rounded-lg',
                      source.type === 'external_api'
                        ? 'bg-blue-100 text-blue-900'
                        : 'bg-purple-100 text-purple-900'
                    )}
                  >
                    {source.type === 'external_api' ? (
                      <ExternalLink className="h-4 w-4" />
                    ) : (
                      <LinkIcon className="h-4 w-4" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{source.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {source.type === 'external_api' ? 'External API' : 'Internal Service'}
                    </p>
                  </div>
                </div>
                {source.url && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={source.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View Source
                    </a>
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Metadata */}
      {explanation.metadata && Object.keys(explanation.metadata).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Additional Metadata</CardTitle>
            <CardDescription>Additional context about this explanation</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(explanation.metadata).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground font-medium capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}:
                  </span>
                  <span className="font-medium">
                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Audit Trail */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Audit Trail
          </CardTitle>
          <CardDescription>
            This explanation has been logged and anchored for audit purposes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="outline">Anchored on-chain</Badge>
            <span className="text-muted-foreground">
              Explanation ID: {explanation.id}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

