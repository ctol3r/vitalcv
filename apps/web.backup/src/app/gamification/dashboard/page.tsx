'use client'

/**
 * B247C-GAM-025: UserRewardsDashboard UI
 *
 * Shows user's point balance, recent point transactions, badges earned; includes summary stats;
 * responsive design; allows navigation to leaderboards and badges pages; accessible UI elements
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card } from '@/components/design/Card'
import { Button } from '@/components/design/Button'
import { Trophy, Award, TrendingUp, Clock, ArrowRight, Star } from 'lucide-react'
import { AchievementBadge } from '@/components/gamification/AchievementBadge'
import { PointsProgressBar } from '@/components/gamification/PointsProgressBar'

interface PointTransaction {
  id: string
  actionType: string
  points: number
  description: string
  createdAt: string
}

interface Badge {
  id: string
  name: string
  slug: string
  description?: string
  iconId?: string
  level: number
  awardedAt: string
}

interface DashboardData {
  pointBalance: number
  recentTransactions: PointTransaction[]
  earnedBadges: Badge[]
  totalBadges: number
  currentLevel?: number
  pointsToNextLevel?: number
}

export default function UserRewardsDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    setLoading(true)
    setError(null)

    try {
      // Fetch point balance
      const balanceResponse = await fetch('/api/gamification/rewards/balance')
      const balanceData = balanceResponse.ok ? await balanceResponse.json() : { balance: 0 }

      // Fetch recent transactions
      const transactionsResponse = await fetch('/api/gamification/rewards/transactions?limit=10')
      const transactionsData = transactionsResponse.ok
        ? await transactionsResponse.json()
        : { transactions: [] }

      // Fetch earned badges
      const badgesResponse = await fetch('/api/gamification/badges/my-badges')
      const badgesData = badgesResponse.ok ? await badgesResponse.json() : { badges: [] }

      setData({
        pointBalance: balanceData.balance || 0,
        recentTransactions: transactionsData.transactions || [],
        earnedBadges: badgesData.badges || [],
        totalBadges: badgesData.total || 0,
      })
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  const formatPoints = (points: number): string => {
    if (points >= 1000000) {
      return `${(points / 1000000).toFixed(1)}M`
    }
    if (points >= 1000) {
      return `${(points / 1000).toFixed(1)}K`
    }
    return points.toString()
  }

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date)
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Card>
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading dashboard...</p>
          </div>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Card>
          <div className="p-8 text-center">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={fetchDashboardData}>Try Again</Button>
          </div>
        </Card>
      </div>
    )
  }

  if (!data) {
    return null
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Rewards Dashboard</h1>
        <p className="text-muted-foreground">
          Track your points, badges, and achievements
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Point Balance Card */}
        <Card className="bg-primary/5 border-primary/20">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Points</p>
                <h2 className="text-3xl font-bold">{formatPoints(data.pointBalance)}</h2>
              </div>
              <Trophy className="w-10 h-10 text-primary" />
            </div>
            <Link href="/gamification/leaderboards">
              <Button variant="tertiary" size="small" className="w-full">
                View Leaderboards <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </Card>

        {/* Badges Card */}
        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Badges Earned</p>
                <h2 className="text-3xl font-bold">{data.earnedBadges.length}</h2>
              </div>
              <Award className="w-10 h-10 text-muted-foreground" />
            </div>
            <Link href="/gamification/badges">
              <Button variant="tertiary" size="small" className="w-full">
                View All Badges <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </Card>

        {/* Recent Activity Card */}
        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Recent Activity</p>
                <h2 className="text-3xl font-bold">{data.recentTransactions.length}</h2>
              </div>
              <TrendingUp className="w-10 h-10 text-muted-foreground" />
            </div>
            <Link href="/gamification/rewards/history">
              <Button variant="tertiary" size="small" className="w-full">
                View History <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </Card>
      </div>

      {/* Points Progress */}
      {data.currentLevel !== undefined && data.pointsToNextLevel !== undefined && (
        <Card className="mb-8">
          <div className="p-6">
            <h2 className="text-xl font-semibold mb-4">Progress to Next Level</h2>
            <PointsProgressBar
              currentPoints={data.pointBalance}
              nextThreshold={data.pointBalance + data.pointsToNextLevel}
            />
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Transactions */}
        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Recent Transactions</h2>
              <Link href="/gamification/rewards/history">
                <Button variant="ghost" size="small">
                  View All
                </Button>
              </Link>
            </div>
            <div className="space-y-3">
              {data.recentTransactions.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No transactions yet. Start earning points!
                </p>
              ) : (
                data.recentTransactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{transaction.description}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(transaction.createdAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-primary">
                        +{formatPoints(transaction.points)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>

        {/* Earned Badges */}
        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Recent Badges</h2>
              <Link href="/gamification/badges">
                <Button variant="ghost" size="small">
                  View All
                </Button>
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {data.earnedBadges.length === 0 ? (
                <div className="col-span-full text-center text-muted-foreground py-8">
                  No badges earned yet. Complete actions to earn badges!
                </div>
              ) : (
                data.earnedBadges.slice(0, 6).map((badge) => (
                  <AchievementBadge
                    key={badge.id}
                    badge={badge}
                    earned={true}
                    showTooltip={true}
                  />
                ))
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

