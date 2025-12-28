"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"

interface MatchFunnelData {
  totalCandidates: number
  matched: number
  nearMatch: number
  belowThreshold: number
}

interface MissingCredential {
  credentialType: string
  missingPercent: number
}

interface MatchFunnelCardProps {
  funnel: MatchFunnelData
  missingByCredential: MissingCredential[]
}

export function MatchFunnelCard({ funnel, missingByCredential }: MatchFunnelCardProps) {
  const total = Math.max(funnel.totalCandidates, 1)
  const matchedPercent = Math.round((funnel.matched / total) * 100)
  const nearMatchPercent = Math.round((funnel.nearMatch / total) * 100)
  const belowPercent = Math.round((funnel.belowThreshold / total) * 100)

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-900">Match Funnel</CardTitle>
        <p className="text-sm text-gray-500">
          Recruiter visibility into match readiness and missing criteria
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-lg border border-gray-100 p-4">
            <p className="text-sm text-gray-500">Total candidates</p>
            <p className="text-2xl font-semibold text-gray-900">{funnel.totalCandidates}</p>
          </div>
          <div className="rounded-lg border border-gray-100 p-4">
            <p className="text-sm text-gray-500">Matched</p>
            <p className="text-2xl font-semibold text-emerald-600">{funnel.matched}</p>
          </div>
          <div className="rounded-lg border border-gray-100 p-4">
            <p className="text-sm text-gray-500">Near match (80–90%)</p>
            <p className="text-2xl font-semibold text-amber-600">{funnel.nearMatch}</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>Matched</span>
              <span>{matchedPercent}%</span>
            </div>
            <Progress value={matchedPercent} className="h-2" />
          </div>
          <div>
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>Near match</span>
              <span>{nearMatchPercent}%</span>
            </div>
            <Progress value={nearMatchPercent} className="h-2" />
          </div>
          <div>
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>Below threshold</span>
              <span>{belowPercent}%</span>
            </div>
            <Progress value={belowPercent} className="h-2" />
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-gray-700 mb-2">Top missing criteria</p>
          <div className="flex flex-wrap gap-2">
            {missingByCredential.slice(0, 5).map((item) => (
              <Badge key={item.credentialType} variant="outline" className="text-xs">
                {item.credentialType} · {item.missingPercent}%
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
