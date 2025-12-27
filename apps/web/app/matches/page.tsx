"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Shield } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"

interface MatchResult {
  jobId: number
  jobTitle: string
  score: number
  explanation: string[]
  readinessPercent: number
}

const resolveApiBase = () => {
  const base = (process.env.NEXT_PUBLIC_BACKEND_URL || "").replace(/\/+$/, "")
  return base || ""
}

export default function MatchesPage() {
  const searchParams = useSearchParams()
  const clinicianId = useMemo(() => searchParams.get("clinicianId") || "1", [searchParams])
  const [matches, setMatches] = useState<MatchResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchMatches = async () => {
      setLoading(true)
      setError(null)
      try {
        const base = resolveApiBase()
        const response = await fetch(
          `${base}/api/matches?clinicianId=${encodeURIComponent(clinicianId)}`,
          { cache: "no-store" }
        )
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || "Unable to load matches")
        }
        const data = await response.json()
        setMatches(Array.isArray(data) ? data : [])
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to load matches"
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    fetchMatches()
  }, [clinicianId])

  return (
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
            <Link href="/profile" className="text-gray-600 hover:text-blue-600 transition-colors">
              Profile
            </Link>
            <Link href="/analytics" className="text-gray-600 hover:text-blue-600 transition-colors">
              Analytics
            </Link>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">Job Matches</h1>
          <p className="text-gray-600">
            Personalized match scores based on your verified credentials and readiness.
          </p>
        </div>

        {loading ? (
          <div className="space-y-6">
            {[1, 2, 3].map((item) => (
              <Card key={item} className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                <CardHeader>
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-64" />
                </CardHeader>
                <CardContent className="space-y-4">
                  <Skeleton className="h-3 w-full" />
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-24" />
                    <Skeleton className="h-6 w-24" />
                    <Skeleton className="h-6 w-24" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : error ? (
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Unable to load matches</CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
          </Card>
        ) : matches.length === 0 ? (
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
            <CardHeader>
              <CardTitle>No matches yet</CardTitle>
              <CardDescription>Upload more verified credentials to see matches.</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="space-y-6">
            {matches.map((match) => (
              <Card key={match.jobId} className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                <CardHeader>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle className="text-xl">{match.jobTitle}</CardTitle>
                      <CardDescription>Job ID: {match.jobId}</CardDescription>
                    </div>
                    <Badge variant="outline" className="text-sm px-3 py-1">
                      Match score {Math.round(match.score * 100)}%
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                      <span>Readiness</span>
                      <span>{match.readinessPercent}%</span>
                    </div>
                    <Progress value={match.readinessPercent} className="h-2" />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {match.explanation.map((tag) => (
                      <Badge key={tag} variant="secondary" className="bg-blue-100 text-blue-700">
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  <div className="flex justify-end">
                    <Button variant="outline" disabled>
                      Apply (coming soon)
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
