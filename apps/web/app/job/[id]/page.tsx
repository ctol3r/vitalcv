"use client"

import { MatchFunnelCard } from "@/components/dashboard/MatchFunnelCard"
import { AuthGuard } from "@/components/auth-guard"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { Shield } from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useEffect, useState } from "react"

interface MatchGapResponse {
  jobId: string
  jobTitle: string | null
  candidateCount: number
  missingByCredential: Array<{ credentialType: string; missingPercent: number }>
  nearMissProfiles: Array<{
    candidateId: number
    matchScore: number
    missingCredentials: string[]
  }>
  funnel: {
    totalCandidates: number
    matched: number
    nearMatch: number
    belowThreshold: number
  }
  commonDisqualifiers: string[]
}

export default function JobMatchInsightsPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<MatchGapResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    const fetchInsights = async () => {
      setLoading(true)
      try {
        const response = await fetch(`/api/analytics/match-gaps?jobId=${encodeURIComponent(id)}`)
        if (!response.ok) {
          const error = await response.json()
          throw new Error(error?.error || "Failed to load match gap insights")
        }
        const payload = (await response.json()) as MatchGapResponse
        setData(payload)
      } catch (error) {
        toast({
          title: "Unable to load match insights",
          description:
            error instanceof Error ? error.message : "Please try again or contact support.",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    if (id) {
      fetchInsights()
    }
  }, [id, toast])

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50">
        <header className="border-b bg-white/80 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-2">
              <Shield className="h-8 w-8 text-blue-600" />
              <span className="text-2xl font-bold text-gray-900">VitalCV</span>
            </Link>
            <nav className="hidden md:flex items-center space-x-6">
              <Link href="/dashboard" className="text-gray-600 hover:text-blue-600 transition-colors">
                Dashboard
              </Link>
              <Link href="/analytics" className="text-gray-600 hover:text-blue-600 transition-colors">
                Analytics
              </Link>
              <Link href="/support" className="text-gray-600 hover:text-blue-600 transition-colors">
                Support
              </Link>
            </nav>
          </div>
        </header>

        <div className="container mx-auto px-4 py-8 lg:py-12 space-y-6">
          <div>
            <p className="text-sm text-gray-500 mb-2">Job ID: {id}</p>
            <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
              Match Gap Insights
            </h1>
            <p className="text-lg text-gray-600">
              Understand why candidates drop and which credentials are missing.
            </p>
          </div>

          {loading || !data ? (
            <div className="space-y-6">
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2 space-y-6">
                <MatchFunnelCard
                  funnel={data.funnel}
                  missingByCredential={data.missingByCredential}
                />

                <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold text-gray-900">
                      Near-miss candidates
                    </CardTitle>
                    <p className="text-sm text-gray-500">
                      Candidates within 80–90% of requirements.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {data.nearMissProfiles.length === 0 ? (
                      <p className="text-sm text-gray-500">No near-miss candidates yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {data.nearMissProfiles.map((profile) => (
                          <div
                            key={profile.candidateId}
                            className="flex items-start justify-between border rounded-lg p-4 bg-white"
                          >
                            <div>
                              <p className="text-sm font-semibold text-gray-900">
                                Candidate #{profile.candidateId}
                              </p>
                              <p className="text-xs text-gray-500">
                                Missing: {profile.missingCredentials.join(", ") || "None"}
                              </p>
                            </div>
                            <span className="text-sm font-semibold text-amber-600">
                              {profile.matchScore}%
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">
                <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold text-gray-900">
                      Common disqualifiers
                    </CardTitle>
                    <p className="text-sm text-gray-500">
                      Most frequent criteria blocking matches.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {data.commonDisqualifiers.length === 0 ? (
                      <p className="text-sm text-gray-500">
                        No dominant disqualifiers detected.
                      </p>
                    ) : (
                      <ul className="space-y-2 text-sm text-gray-700">
                        {data.commonDisqualifiers.map((disqualifier) => (
                          <li key={disqualifier} className="flex items-start gap-2">
                            <span className="mt-1 h-2 w-2 rounded-full bg-rose-500" />
                            {disqualifier}
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold text-gray-900">
                      Match summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-center justify-between">
                      <span>Total candidates</span>
                      <span className="font-semibold text-gray-900">{data.candidateCount}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Matched</span>
                      <span className="font-semibold text-emerald-600">{data.funnel.matched}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Near match</span>
                      <span className="font-semibold text-amber-600">{data.funnel.nearMatch}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Below threshold</span>
                      <span className="font-semibold text-gray-900">
                        {data.funnel.belowThreshold}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  )
}
