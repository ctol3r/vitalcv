import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import AnalyticsPage from "@/app/analytics/page"
import { jest } from "@jest/globals"

beforeEach(() => {
  global.fetch = jest.fn()
})

afterEach(() => {
  jest.resetAllMocks()
})

describe("Analytics Page", () => {
  it("renders analytics dashboard", async () => {
    render(<AnalyticsPage />)

    await waitFor(() => {
      expect(screen.getByText("Analytics Dashboard")).toBeInTheDocument()
    })
  })

  it("displays key metrics", async () => {
    render(<AnalyticsPage />)

    await waitFor(() => {
      expect(screen.getByText("Success Rate")).toBeInTheDocument()
      expect(screen.getByText("Revocation Rate")).toBeInTheDocument()
      expect(screen.getByText("P50 Verify Time")).toBeInTheDocument()
      expect(screen.getByText("P95 Verify Time")).toBeInTheDocument()
    })
  })

  it("shows time range selector", async () => {
    render(<AnalyticsPage />)

    await waitFor(() => {
      expect(screen.getByText("Time Range:")).toBeInTheDocument()
    })
  })

  it("changes time range when selected", async () => {
    render(<AnalyticsPage />)

    await waitFor(() => {
      const timeRangeSelect = screen.getByRole("combobox")
      fireEvent.click(timeRangeSelect)
    })

    await waitFor(() => {
      const sevenDaysOption = screen.getByText("7 days")
      fireEvent.click(sevenDaysOption)
    })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/analytics?timeRange=7d", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      })
    })
  })

  it("displays charts", async () => {
    render(<AnalyticsPage />)

    await waitFor(() => {
      expect(screen.getByText("Success Rate Trends")).toBeInTheDocument()
      expect(screen.getByText("Revocations Over Time")).toBeInTheDocument()
      expect(screen.getByText("Verification Time Distribution")).toBeInTheDocument()
      expect(screen.getByText("Verification Volume")).toBeInTheDocument()
    })
  })

  it("shows recent alerts", async () => {
    render(<AnalyticsPage />)

    await waitFor(() => {
      expect(screen.getByText("Recent Alerts")).toBeInTheDocument()
      expect(screen.getByText("Suspicious credential pattern detected in CRED-99887")).toBeInTheDocument()
    })
  })

  it("displays performance metrics", async () => {
    render(<AnalyticsPage />)

    await waitFor(() => {
      expect(screen.getByText("98.2%")).toBeInTheDocument() // Success rate
      expect(screen.getByText("1.8%")).toBeInTheDocument() // Revocation rate
      expect(screen.getByText("1.8s")).toBeInTheDocument() // P50 time
      expect(screen.getByText("4.2s")).toBeInTheDocument() // P95 time
    })
  })
})
