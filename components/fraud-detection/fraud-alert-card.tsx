/**
 * Fraud Alert Card Component
 *
 * Displays fraud detection alert with details and recommended actions
 */

'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FraudScoreBadge } from './fraud-score-badge'
import { AlertCircle, CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react'

interface FraudReason {
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  evidence: string
  weight: number
}

interface FraudAlertCardProps {
  credentialId: string
  score: number
  risk: 'low' | 'medium' | 'high' | 'critical'
  confidence: number
  reasons: FraudReason[]
  recommendations?: string[]
  timestamp: Date
  onReview?: (resolution: 'legitimate' | 'fraudulent' | 'inconclusive') => void
}

export function FraudAlertCard({
  credentialId,
  score,
  risk,
  confidence,
  reasons,
  recommendations,
  timestamp,
  onReview,
}: FraudAlertCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg">Fraud Alert</CardTitle>
            <FraudScoreBadge score={score} risk={risk} />
          </div>
          <div className="text-sm text-muted-foreground">
            {timestamp.toLocaleString()}
          </div>
        </div>
        <CardDescription>
          Credential ID: <code className="text-xs bg-muted px-1 py-0.5 rounded">{credentialId.slice(0, 12)}...</code>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Confidence indicator */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Confidence:</span>
          <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-primary"
              style={{ width: `${confidence * 100}%` }}
            />
          </div>
          <span className="text-sm font-medium">{Math.round(confidence * 100)}%</span>
        </div>

        {/* Fraud reasons summary */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">
              Detection Reasons ({reasons.length})
            </h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <>
                  <ChevronUp className="w-4 h-4 mr-1" />
                  Hide Details
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 mr-1" />
                  Show Details
                </>
              )}
            </Button>
          </div>

          {/* Show top 3 reasons always */}
          <div className="space-y-2">
            {reasons.slice(0, 3).map((reason, index) => (
              <div
                key={index}
                className="flex items-start gap-2 p-2 bg-muted/50 rounded-md"
              >
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-destructive" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{reason.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">{reason.evidence}</p>
                </div>
                <Badge
                  variant={reason.severity === 'critical' || reason.severity === 'high' ? 'destructive' : 'secondary'}
                  className="text-xs"
                >
                  {reason.severity}
                </Badge>
              </div>
            ))}
          </div>

          {/* Show all reasons when expanded */}
          {expanded && reasons.length > 3 && (
            <div className="space-y-2 mt-2 pt-2 border-t">
              {reasons.slice(3).map((reason, index) => (
                <div
                  key={index + 3}
                  className="flex items-start gap-2 p-2 bg-muted/50 rounded-md"
                >
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-destructive" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{reason.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">{reason.evidence}</p>
                  </div>
                  <Badge
                    variant={reason.severity === 'critical' || reason.severity === 'high' ? 'destructive' : 'secondary'}
                    className="text-xs"
                  >
                    {reason.severity}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recommendations */}
        {recommendations && recommendations.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Recommended Actions</h4>
            <ul className="space-y-1">
              {recommendations.map((action, index) => (
                <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>{action}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Review actions */}
        {onReview && (
          <div className="flex items-center gap-2 pt-4 border-t">
            <span className="text-sm text-muted-foreground mr-2">Mark as:</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onReview('legitimate')}
              className="gap-2"
            >
              <CheckCircle className="w-4 h-4 text-green-600" />
              Legitimate
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onReview('fraudulent')}
              className="gap-2"
            >
              <XCircle className="w-4 h-4 text-red-600" />
              Fraudulent
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onReview('inconclusive')}
            >
              Needs Review
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
