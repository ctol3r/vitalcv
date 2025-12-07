'use client'

/**
 * B247C-GAM-024: Leaderboard UI page
 *
 * Displays leaderboards for daily/weekly/monthly/all-time; shows user's current rank and points privately;
 * allows filtering by period; responsive layout; highlights progress to next rank; accessible
 */

import { useState, useEffect } from 'react'
import { Card } from '@/components/design/Card'
import { Button } from '@/components/design/Button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Trophy, Medal, Award, Star, TrendingUp, User } from 'lucide-react'

type LeaderboardPeriod = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ALL_TIME'

interface LeaderboardEntry {
  userId: string
  userName?: string
  userEmail?: string
  pointsTotal: number
  rank: number
}

interface LeaderboardData {
  period: LeaderboardPeriod
  entries: LeaderboardEntry[]
  totalEntries: number
  userRank?: number | null
  userPoints?: number
  isPrivate?: boolean
}

const PERIOD_LABELS: Record<LeaderboardPeriod, string> = {
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  ALL_TIME: 'All Time',
}

const PERIOD_ICONS: Record<LeaderboardPeriod, typeof Trophy> = {
  DAILY: Trophy,
  WEEKLY: Medal,
  MONTHLY: Award,
  ALL_TIME: Star,
}

function getRankIcon(rank: number) {
  if (rank === 1) return Trophy
  if (rank === 2) return Medal
  if (rank === 3) return Award
  return Star
}

function formatPoints(points: number): string {
  if (points >= 1000000) {
    return `${(points / 1000000).toFixed(1)}M`
  }
  if (points >= 1000) {
    return `${(points / 1000).toFixed(1)}K`
  }
  return points.toString()
}

export default function LeaderboardsPage() {
  const [selectedPeriod, setSelectedPeriod] = useState<LeaderboardPeriod>('ALL_TIME')
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchLeaderboard = async (period: LeaderboardPeriod) => {
    setLoading(true)
    setError(null)

    try {
      // Fetch top leaderboard
      const topResponse = await fetch(`/api/gamification/leaderboards/${period}?limit=100`)
      if (!topResponse.ok) {
        throw new Error('Failed to fetch leaderboard')
      }
      const topData = await topResponse.json()

      // Fetch user's rank (if authenticated)
      let userRankData = null
      try {
        const rankResponse = await fetch(`/api/gamification/leaderboards/${period}/my-rank`)
        if (rankResponse.ok) {
          userRankData = await rankResponse.json()
        }
      } catch (e) {
        // User not authenticated or opted out - that's okay
      }

      setLeaderboardData({
        period: topData.period,
        entries: topData.entries,
        totalEntries: topData.pagination?.total || topData.totalEntries || 0,
        userRank: userRankData?.rank ?? null,
        userPoints: userRankData?.pointsTotal ?? 0,
        isPrivate: userRankData?.isPrivate ?? false,
      })
    } catch (err: any) {
      setError(err.message || 'Failed to load leaderboard')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLeaderboard(selectedPeriod)
  }, [selectedPeriod])

  const handlePeriodChange = (period: string) => {
    setSelectedPeriod(period as LeaderboardPeriod)
  }

  const nextRankPoints = leaderboardData?.entries.find(
    (entry) => entry.rank === (leaderboardData.userRank || 0) + 1
  )?.pointsTotal

  const progressToNextRank =
    leaderboardData?.userRank && nextRankPoints && leaderboardData.userPoints
      ? Math.max(
          0,
          Math.min(
            100,
            ((leaderboardData.userPoints / nextRankPoints) * 100).toFixed(1)
          )
        )
      : null

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Leaderboards</h1>
        <p className="text-muted-foreground">
          Compete with other users and see how you rank across different time periods
        </p>
      </div>

      <Tabs value={selectedPeriod} onValueChange={handlePeriodChange} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          {Object.entries(PERIOD_LABELS).map(([period, label]) => {
            const Icon = PERIOD_ICONS[period as LeaderboardPeriod]
            return (
              <TabsTrigger key={period} value={period} className="flex items-center gap-2">
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">{label.split(' ')[0]}</span>
              </TabsTrigger>
            )
          })}
        </TabsList>

        {Object.keys(PERIOD_LABELS).map((period) => (
          <TabsContent key={period} value={period} className="mt-6">
            {loading ? (
              <Card>
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Loading leaderboard...</p>
                </div>
              </Card>
            ) : error ? (
              <Card>
                <div className="p-8 text-center">
                  <p className="text-destructive mb-4">{error}</p>
                  <Button onClick={() => fetchLeaderboard(period as LeaderboardPeriod)}>
                    Try Again
                  </Button>
                </div>
              </Card>
            ) : leaderboardData ? (
              <div className="space-y-6">
                {/* User's Rank Card */}
                {leaderboardData.userRank !== null && !leaderboardData.isPrivate && (
                  <Card className="bg-primary/5 border-primary/20">
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h2 className="text-xl font-semibold mb-1">Your Rank</h2>
                          <p className="text-sm text-muted-foreground">
                            {PERIOD_LABELS[selectedPeriod]} Leaderboard
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-3xl font-bold">#{leaderboardData.userRank}</div>
                          <div className="text-sm text-muted-foreground">
                            {formatPoints(leaderboardData.userPoints || 0)} points
                          </div>
                        </div>
                      </div>
                      {progressToNextRank && nextRankPoints && (
                        <div className="mt-4">
                          <div className="flex justify-between text-sm mb-2">
                            <span>Progress to next rank</span>
                            <span>{progressToNextRank}%</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full transition-all"
                              style={{ width: `${progressToNextRank}%` }}
                              role="progressbar"
                              aria-valuenow={Number(progressToNextRank)}
                              aria-valuemin={0}
                              aria-valuemax={100}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            {nextRankPoints - (leaderboardData.userPoints || 0)} points to rank #
                            {leaderboardData.userRank}
                          </p>
                        </div>
                      )}
                    </div>
                  </Card>
                )}

                {/* Leaderboard Table */}
                <Card>
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-semibold">
                        Top {leaderboardData.totalEntries} Players
                      </h2>
                      <span className="text-sm text-muted-foreground">
                        {leaderboardData.entries.length} shown
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full" role="table" aria-label="Leaderboard">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-3 px-4 font-semibold">Rank</th>
                            <th className="text-left py-3 px-4 font-semibold">User</th>
                            <th className="text-right py-3 px-4 font-semibold">Points</th>
                          </tr>
                        </thead>
                        <tbody>
                          {leaderboardData.entries.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="text-center py-8 text-muted-foreground">
                                No entries yet. Be the first to earn points!
                              </td>
                            </tr>
                          ) : (
                            leaderboardData.entries.map((entry, index) => {
                              const RankIcon = getRankIcon(entry.rank)
                              const isUserEntry =
                                entry.userId !== 'anonymous' &&
                                leaderboardData.userRank === entry.rank

                              return (
                                <tr
                                  key={entry.userId || index}
                                  className={`border-b transition-colors ${
                                    isUserEntry
                                      ? 'bg-primary/5 font-semibold'
                                      : 'hover:bg-muted/50'
                                  }`}
                                >
                                  <td className="py-4 px-4">
                                    <div className="flex items-center gap-2">
                                      {entry.rank <= 3 ? (
                                        <RankIcon
                                          className={`w-5 h-5 ${
                                            entry.rank === 1
                                              ? 'text-yellow-500'
                                              : entry.rank === 2
                                              ? 'text-gray-400'
                                              : 'text-amber-600'
                                          }`}
                                          aria-label={`Rank ${entry.rank}`}
                                        />
                                      ) : (
                                        <span className="text-muted-foreground">#{entry.rank}</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-4 px-4">
                                    {entry.userId === 'anonymous' ? (
                                      <span className="text-muted-foreground italic">
                                        Anonymous User
                                      </span>
                                    ) : (
                                      <div className="flex items-center gap-2">
                                        <User className="w-4 h-4 text-muted-foreground" />
                                        <span>{entry.userName || entry.userEmail || 'User'}</span>
                                        {isUserEntry && (
                                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                                            You
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </td>
                                  <td className="py-4 px-4 text-right font-mono">
                                    {formatPoints(entry.pointsTotal)}
                                  </td>
                                </tr>
                              )
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </Card>
              </div>
            ) : null}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}

