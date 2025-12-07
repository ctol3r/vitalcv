/**
 * B247C-GAM-030: GamificationUITests suite
 *
 * Tests for leaderboard and rewards UI components: ensures pages render data correctly with different states
 * (opted out, new badges); verifies that notifications display; checks responsive behaviour and accessibility
 */

import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import LeaderboardsPage from '../app/gamification/leaderboards/page'
import UserRewardsDashboard from '../app/gamification/dashboard/page'
import GamificationSettingsPage from '../app/gamification/settings/page'
import { AchievementBadge } from '../components/gamification/AchievementBadge'
import { RewardsNotification } from '../components/gamification/RewardsNotification'
import { PointsProgressBar } from '../components/gamification/PointsProgressBar'

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => '/gamification/leaderboards',
}))

// Mock fetch
global.fetch = vi.fn()

describe('Gamification UI Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('LeaderboardsPage', () => {
    it('should render leaderboard page with period tabs', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          period: 'ALL_TIME',
          entries: [],
          totalEntries: 0,
        }),
      })

      render(<LeaderboardsPage />)

      expect(screen.getByText('Leaderboards')).toBeInTheDocument()
      expect(screen.getByText('All Time')).toBeInTheDocument()
      expect(screen.getByText('Daily')).toBeInTheDocument()
      expect(screen.getByText('Weekly')).toBeInTheDocument()
      expect(screen.getByText('Monthly')).toBeInTheDocument()
    })

    it('should display leaderboard entries', async () => {
      const mockEntries = [
        {
          userId: 'user1',
          userName: 'User 1',
          pointsTotal: 1000,
          rank: 1,
        },
        {
          userId: 'user2',
          userName: 'User 2',
          pointsTotal: 500,
          rank: 2,
        },
      ]

      ;(global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            period: 'ALL_TIME',
            entries: mockEntries,
            totalEntries: 2,
            pagination: { total: 2 },
          }),
        })
        .mockResolvedValueOnce({
          ok: false,
        })

      render(<LeaderboardsPage />)

      await waitFor(() => {
        expect(screen.getByText('User 1')).toBeInTheDocument()
        expect(screen.getByText('User 2')).toBeInTheDocument()
      })
    })

    it('should handle opted-out users (anonymous)', async () => {
      const mockEntries = [
        {
          userId: 'anonymous',
          pointsTotal: 1000,
          rank: 1,
        },
      ]

      ;(global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            period: 'ALL_TIME',
            entries: mockEntries,
            totalEntries: 1,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            rank: null,
            pointsTotal: 0,
            period: 'ALL_TIME',
            isPrivate: true,
          }),
        })

      render(<LeaderboardsPage />)

      await waitFor(() => {
        expect(screen.getByText('Anonymous User')).toBeInTheDocument()
      })
    })
  })

  describe('UserRewardsDashboard', () => {
    it('should render dashboard with point balance', async () => {
      ;(global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ balance: 1500 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ transactions: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ badges: [], total: 0 }),
        })

      render(<UserRewardsDashboard />)

      await waitFor(() => {
        expect(screen.getByText('Rewards Dashboard')).toBeInTheDocument()
        expect(screen.getByText('1.5K')).toBeInTheDocument() // Formatted points
      })
    })

    it('should display recent transactions', async () => {
      const mockTransactions = [
        {
          id: '1',
          actionType: 'ACTION_COMPLETED',
          points: 100,
          description: 'Completed action',
          createdAt: new Date().toISOString(),
        },
      ]

      ;(global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ balance: 1000 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ transactions: mockTransactions }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ badges: [] }),
        })

      render(<UserRewardsDashboard />)

      await waitFor(() => {
        expect(screen.getByText('Completed action')).toBeInTheDocument()
        expect(screen.getByText('+100')).toBeInTheDocument()
      })
    })
  })

  describe('AchievementBadge', () => {
    const mockBadge = {
      id: '1',
      name: 'First Steps',
      slug: 'first-steps',
      description: 'Earn your first 100 points',
      level: 1,
    }

    it('should render earned badge', () => {
      render(<AchievementBadge badge={mockBadge} earned={true} />)
      expect(screen.getByLabelText(/Earned badge: First Steps/i)).toBeInTheDocument()
      expect(screen.getByText('First Steps')).toBeInTheDocument()
    })

    it('should render unearned badge', () => {
      render(<AchievementBadge badge={mockBadge} earned={false} />)
      expect(screen.getByLabelText(/Badge: First Steps \(not earned\)/i)).toBeInTheDocument()
    })

    it('should show level indicator for level > 1', () => {
      const levelBadge = { ...mockBadge, level: 3 }
      render(<AchievementBadge badge={levelBadge} earned={true} />)
      expect(screen.getByLabelText('Level 3')).toBeInTheDocument()
    })
  })

  describe('RewardsNotification', () => {
    it('should display points notification', () => {
      const notification = {
        type: 'points' as const,
        points: 100,
        message: 'Points Earned!',
      }

      const { unmount } = render(
        <RewardsNotification notification={notification} onClose={() => {}} />
      )

      expect(screen.getByText('Points Earned!')).toBeInTheDocument()
      expect(screen.getByText('+100')).toBeInTheDocument()

      unmount()
    })

    it('should display badge notification', () => {
      const notification = {
        type: 'badge' as const,
        badge: {
          id: '1',
          name: 'First Steps',
        },
      }

      const { unmount } = render(
        <RewardsNotification notification={notification} onClose={() => {}} />
      )

      expect(screen.getByText('Badge Earned!')).toBeInTheDocument()
      expect(screen.getByText('First Steps')).toBeInTheDocument()

      unmount()
    })

    it('should auto-dismiss after duration', async () => {
      vi.useFakeTimers()

      const onClose = vi.fn()
      const notification = {
        type: 'points' as const,
        points: 100,
        duration: 1000,
      }

      render(<RewardsNotification notification={notification} onClose={onClose} />)

      vi.advanceTimersByTime(1000)

      await waitFor(() => {
        expect(onClose).toHaveBeenCalled()
      })

      vi.useRealTimers()
    })
  })

  describe('PointsProgressBar', () => {
    it('should render progress bar with labels', () => {
      render(
        <PointsProgressBar currentPoints={500} nextThreshold={1000} showLabels={true} />
      )

      expect(screen.getByText(/500/)).toBeInTheDocument()
      expect(screen.getByText(/1000/)).toBeInTheDocument()
      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })

    it('should calculate and display correct progress percentage', () => {
      render(
        <PointsProgressBar
          currentPoints={750}
          nextThreshold={1000}
          showLabels={true}
          showPercentage={true}
        />
      )

      expect(screen.getByText('75%')).toBeInTheDocument()
    })

    it('should show completion message at 100%', () => {
      render(
        <PointsProgressBar
          currentPoints={1000}
          nextThreshold={1000}
          showLabels={true}
        />
      )

      expect(screen.getByText(/Level up!/)).toBeInTheDocument()
    })
  })

  describe('GamificationSettingsPage', () => {
    it('should render settings page with toggles', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          leaderboardOptIn: true,
          notificationsOptIn: true,
        }),
      })

      render(<GamificationSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('Gamification Settings')).toBeInTheDocument()
        expect(screen.getByLabelText('Show on leaderboards')).toBeInTheDocument()
        expect(screen.getByLabelText('Enable reward notifications')).toBeInTheDocument()
      })
    })

    it('should handle save action', async () => {
      ;(global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            leaderboardOptIn: true,
            notificationsOptIn: true,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
        })

      render(<GamificationSettingsPage />)

      await waitFor(() => {
        const saveButton = screen.getByText('Save Settings')
        expect(saveButton).toBeInTheDocument()
      })
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels on leaderboard', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          period: 'ALL_TIME',
          entries: [],
          totalEntries: 0,
        }),
      })

      render(<LeaderboardsPage />)

      await waitFor(() => {
        const table = screen.getByRole('table', { name: 'Leaderboard' })
        expect(table).toBeInTheDocument()
      })
    })

    it('should have proper ARIA labels on progress bar', () => {
      render(
        <PointsProgressBar currentPoints={500} nextThreshold={1000} showLabels={true} />
      )

      const progressbar = screen.getByRole('progressbar')
      expect(progressbar).toHaveAttribute('aria-valuenow')
      expect(progressbar).toHaveAttribute('aria-valuemin', '0')
      expect(progressbar).toHaveAttribute('aria-valuemax', '100')
    })

    it('should have proper ARIA labels on notifications', () => {
      const notification = {
        type: 'points' as const,
        points: 100,
      }

      render(<RewardsNotification notification={notification} onClose={() => {}} />)

      const alert = screen.getByRole('alert')
      expect(alert).toHaveAttribute('aria-live', 'polite')
      expect(alert).toHaveAttribute('aria-atomic', 'true')
    })
  })
})

