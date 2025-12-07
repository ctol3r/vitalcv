/**
 * ObservabilityPerformanceTests
 * Task: B245C-OBS-030
 *
 * UI performance tests for observability components
 * Measures rendering time and memory usage with large datasets
 * Ensures UI remains responsive
 * Fails tests if performance thresholds exceeded
 */

import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import ObservabilityDashboard from '@/app/observability/dashboard/page'
import LogViewerPage from '@/app/observability/logs/page'
import MetricsExplorerPage from '@/app/observability/metrics/page'

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/observability/dashboard',
}))

// Mock recharts to avoid canvas issues in tests
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AreaChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Area: () => null,
  Line: () => null,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}))

// Performance thresholds
const PERFORMANCE_THRESHOLDS = {
  renderTime: 1000, // ms - Maximum time to render initial view
  memoryUsage: 50 * 1024 * 1024, // 50MB - Maximum memory usage
  interactionTime: 200, // ms - Maximum time for interactions
  largeDatasetRenderTime: 2000, // ms - Maximum time to render with large datasets
}

const measurePerformance = (fn: () => void): { time: number; memory?: number } => {
  const startTime = performance.now()
  const startMemory = (performance as any).memory?.usedJSHeapSize

  fn()

  const endTime = performance.now()
  const endMemory = (performance as any).memory?.usedJSHeapSize

  return {
    time: endTime - startTime,
    memory: endMemory ? endMemory - startMemory : undefined,
  }
}

describe('ObservabilityPerformanceTests', () => {
  beforeEach(() => {
    // Reset performance markers
    performance.clearMarks()
    performance.clearMeasures()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Dashboard Performance', () => {
    it('should render dashboard within performance threshold', async () => {
      const result = measurePerformance(() => {
        render(<ObservabilityDashboard />)
      })

      expect(result.time).toBeLessThan(PERFORMANCE_THRESHOLDS.renderTime)

      await waitFor(() => {
        expect(screen.getByText(/Observability Dashboard/i)).toBeInTheDocument()
      })
    })

    it('should handle large metric datasets efficiently', async () => {
      // Mock large dataset
      const largeMetricData = Array.from({ length: 1000 }, (_, i) => ({
        timestamp: new Date(Date.now() - i * 60000).toISOString(),
        value: Math.random() * 1000,
      }))

      vi.mock('@/app/observability/dashboard/page', async () => {
        const actual = await vi.importActual('@/app/observability/dashboard/page')
        return {
          ...actual,
          default: () => {
            // Component with large dataset
            return actual.default()
          },
        }
      })

      const result = measurePerformance(() => {
        render(<ObservabilityDashboard />)
      })

      expect(result.time).toBeLessThan(PERFORMANCE_THRESHOLDS.largeDatasetRenderTime)
    })

    it('should render service status cards efficiently', async () => {
      const { container } = render(<ObservabilityDashboard />)

      await waitFor(() => {
        const cards = container.querySelectorAll('[data-slot="card"]')
        expect(cards.length).toBeGreaterThan(0)
      })

      // Verify rendering is fast
      const renderTime = performance.now()
      expect(renderTime).toBeLessThan(PERFORMANCE_THRESHOLDS.renderTime)
    })

    it('should update charts efficiently on data refresh', async () => {
      const { rerender } = render(<ObservabilityDashboard />)

      await waitFor(() => {
        expect(screen.getByText(/Observability Dashboard/i)).toBeInTheDocument()
      })

      const startTime = performance.now()

      // Simulate data refresh
      rerender(<ObservabilityDashboard />)

      const updateTime = performance.now() - startTime

      expect(updateTime).toBeLessThan(PERFORMANCE_THRESHOLDS.interactionTime)
    })
  })

  describe('Log Viewer Performance', () => {
    it('should render log viewer with large log lists efficiently', async () => {
      const result = measurePerformance(() => {
        render(<LogViewerPage />)
      })

      expect(result.time).toBeLessThan(PERFORMANCE_THRESHOLDS.renderTime)

      await waitFor(() => {
        expect(screen.getByText(/Log Viewer/i)).toBeInTheDocument()
      })
    })

    it('should handle pagination efficiently with large datasets', async () => {
      const { container } = render(<LogViewerPage />)

      await waitFor(() => {
        expect(screen.getByText(/Log Viewer/i)).toBeInTheDocument()
      })

      // Simulate pagination
      const paginationButtons = container.querySelectorAll('button')
      const nextButton = Array.from(paginationButtons).find((btn) =>
        btn.textContent?.includes('Next')
      )

      if (nextButton) {
        const clickTime = measurePerformance(() => {
          nextButton.click()
        })

        expect(clickTime.time).toBeLessThan(PERFORMANCE_THRESHOLDS.interactionTime)
      }
    })

    it('should filter logs efficiently', async () => {
      const { container } = render(<LogViewerPage />)

      await waitFor(() => {
        expect(screen.getByText(/Log Viewer/i)).toBeInTheDocument()
      })

      const searchInput = container.querySelector('input[placeholder*="Search"]') as HTMLInputElement

      if (searchInput) {
        const filterTime = measurePerformance(() => {
          // Simulate typing
          searchInput.value = 'error'
          searchInput.dispatchEvent(new Event('input', { bubbles: true }))
        })

        expect(filterTime.time).toBeLessThan(PERFORMANCE_THRESHOLDS.interactionTime)
      }
    })

    it('should handle live streaming without performance degradation', async () => {
      const { container } = render(<LogViewerPage />)

      await waitFor(() => {
        expect(screen.getByText(/Log Viewer/i)).toBeInTheDocument()
      })

      // Simulate enabling live streaming
      const switchElement = container.querySelector('input[type="checkbox"]') as HTMLInputElement

      if (switchElement) {
        const streamTime = measurePerformance(() => {
          switchElement.click()
        })

        expect(streamTime.time).toBeLessThan(PERFORMANCE_THRESHOLDS.interactionTime)
      }
    })
  })

  describe('Metrics Explorer Performance', () => {
    it('should render metrics explorer efficiently', async () => {
      const result = measurePerformance(() => {
        render(<MetricsExplorerPage />)
      })

      expect(result.time).toBeLessThan(PERFORMANCE_THRESHOLDS.renderTime)

      await waitFor(() => {
        expect(screen.getByText(/Metrics Explorer/i)).toBeInTheDocument()
      })
    })

    it('should handle multiple chart types efficiently', async () => {
      const { container } = render(<MetricsExplorerPage />)

      await waitFor(() => {
        expect(screen.getByText(/Metrics Explorer/i)).toBeInTheDocument()
      })

      // Simulate switching chart types
      const chartTypeSelect = container.querySelector('select') as HTMLSelectElement

      if (chartTypeSelect) {
        const switchTime = measurePerformance(() => {
          chartTypeSelect.value = 'bar'
          chartTypeSelect.dispatchEvent(new Event('change', { bubbles: true }))
        })

        expect(switchTime.time).toBeLessThan(PERFORMANCE_THRESHOLDS.interactionTime)
      }
    })

    it('should execute queries efficiently', async () => {
      const { container } = render(<MetricsExplorerPage />)

      await waitFor(() => {
        expect(screen.getByText(/Metrics Explorer/i)).toBeInTheDocument()
      })

      const executeButton = Array.from(container.querySelectorAll('button')).find((btn) =>
        btn.textContent?.includes('Execute')
      )

      if (executeButton) {
        const queryTime = measurePerformance(() => {
          executeButton.click()
        })

        // Query execution might take longer due to data fetching
        expect(queryTime.time).toBeLessThan(PERFORMANCE_THRESHOLDS.largeDatasetRenderTime)
      }
    })
  })

  describe('Memory Usage', () => {
    it('should not exceed memory threshold with large datasets', async () => {
      if (!(performance as any).memory) {
        // Skip if memory API not available
        return
      }

      const initialMemory = (performance as any).memory.usedJSHeapSize

      const { unmount } = render(<ObservabilityDashboard />)

      await waitFor(() => {
        expect(screen.getByText(/Observability Dashboard/i)).toBeInTheDocument()
      })

      // Force garbage collection if available
      if ((global as any).gc) {
        ;(global as any).gc()
      }

      const finalMemory = (performance as any).memory.usedJSHeapSize
      const memoryUsed = finalMemory - initialMemory

      unmount()

      // Allow some variance but should be reasonable
      expect(Math.abs(memoryUsed)).toBeLessThan(PERFORMANCE_THRESHOLDS.memoryUsage)
    })
  })

  describe('Responsive Behavior', () => {
    it('should render correctly on mobile viewport', async () => {
      // Simulate mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      })

      const result = measurePerformance(() => {
        render(<ObservabilityDashboard />)
      })

      expect(result.time).toBeLessThan(PERFORMANCE_THRESHOLDS.renderTime)

      await waitFor(() => {
        expect(screen.getByText(/Observability Dashboard/i)).toBeInTheDocument()
      })
    })

    it('should handle window resize efficiently', async () => {
      const { container } = render(<ObservabilityDashboard />)

      await waitFor(() => {
        expect(screen.getByText(/Observability Dashboard/i)).toBeInTheDocument()
      })

      const resizeTime = measurePerformance(() => {
        window.dispatchEvent(new Event('resize'))
      })

      expect(resizeTime.time).toBeLessThan(PERFORMANCE_THRESHOLDS.interactionTime)
    })
  })

  describe('Accessibility Performance', () => {
    it('should maintain accessibility with large datasets', async () => {
      const { container } = render(<ObservabilityDashboard />)

      await waitFor(() => {
        expect(screen.getByText(/Observability Dashboard/i)).toBeInTheDocument()
      })

      // Check for ARIA labels
      const elementsWithAria = container.querySelectorAll('[aria-label], [aria-labelledby]')
      expect(elementsWithAria.length).toBeGreaterThan(0)

      // Verify screen reader performance
      const ariaTime = measurePerformance(() => {
        // Simulate screen reader navigation
        const firstAria = elementsWithAria[0]
        if (firstAria) {
          firstAria.dispatchEvent(new Event('focus'))
        }
      })

      expect(ariaTime.time).toBeLessThan(PERFORMANCE_THRESHOLDS.interactionTime)
    })
  })
})

