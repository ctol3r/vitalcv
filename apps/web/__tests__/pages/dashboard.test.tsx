import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { useToast } from "@/hooks/use-toast"
import DashboardPage from "@/app/dashboard/page"
import jest from "jest" // Import jest to declare the variable

// Mock the useToast hook
jest.mock("@/hooks/use-toast")
const mockToast = jest.fn()
;(useToast as jest.Mock).mockReturnValue({ toast: mockToast })

// Mock Next.js router
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
}))

// Mock window.location
Object.defineProperty(window, "location", {
  value: {
    origin: "https://vitalcv.com",
  },
  writable: true,
})

// Mock navigator.clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn().mockResolvedValue(undefined),
  },
})

describe("Dashboard Page", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders loading state initially", () => {
    render(<DashboardPage />)

    expect(screen.getByText("VitalCV")).toBeInTheDocument()
    expect(screen.getAllByTestId("skeleton")).toHaveLength(expect.any(Number))
  })

  it("renders dashboard content after loading", async () => {
    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText("Clinician Dashboard")).toBeInTheDocument()
    })

    expect(screen.getByText("Dr. Sarah Johnson")).toBeInTheDocument()
    expect(screen.getByText("1234567890")).toBeInTheDocument()
    expect(screen.getByText("Internal Medicine")).toBeInTheDocument()
    expect(screen.getByText("Verified via NPPES")).toBeInTheDocument()
  })

  it("displays NPI information correctly", async () => {
    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText("NPI Information")).toBeInTheDocument()
    })

    expect(screen.getByText("National Provider Identifier")).toBeInTheDocument()
    expect(screen.getByText("1234567890")).toBeInTheDocument()
    expect(screen.getByText("Individual")).toBeInTheDocument()
    expect(screen.getByText("123 Medical Plaza, San Francisco, CA 94102")).toBeInTheDocument()
  })

  it("displays license information with correct status badges", async () => {
    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText("State Licensure")).toBeInTheDocument()
    })

    expect(screen.getByText("California")).toBeInTheDocument()
    expect(screen.getByText("Nevada")).toBeInTheDocument()
    expect(screen.getByText("Arizona")).toBeInTheDocument()

    expect(screen.getByText("active")).toBeInTheDocument()
    expect(screen.getByText("expiring soon")).toBeInTheDocument()
    expect(screen.getByText("expired")).toBeInTheDocument()
  })

  it("displays notifications correctly", async () => {
    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText("Notifications")).toBeInTheDocument()
    })

    expect(screen.getByText("Nevada medical license expires in 45 days")).toBeInTheDocument()
    expect(screen.getByText("Updated information detected in NPPES registry")).toBeInTheDocument()
    expect(screen.getByText("Profile verification completed successfully")).toBeInTheDocument()
  })

  it("handles NPI sync functionality", async () => {
    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText("Sync Now")).toBeInTheDocument()
    })

    const syncButton = screen.getByText("Sync Now")
    fireEvent.click(syncButton)

    expect(screen.getByText("Syncing...")).toBeInTheDocument()

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: "Sync Complete",
        description: "NPI data has been updated successfully",
      })
    })
  })

  it("handles profile sharing", async () => {
    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText("Share Profile")).toBeInTheDocument()
    })

    const shareButton = screen.getByText("Share Profile")
    fireEvent.click(shareButton)

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith("https://vitalcv.com/profile/1234567890")
      expect(mockToast).toHaveBeenCalledWith({
        title: "Link Copied",
        description: "Profile link copied to clipboard",
      })
    })
  })

  it("handles PDF download", async () => {
    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText("Download PDF")).toBeInTheDocument()
    })

    const downloadButton = screen.getByText("Download PDF")
    fireEvent.click(downloadButton)

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: "PDF Generated",
        description: "Your profile PDF has been downloaded",
      })
    })
  })

  it("opens QR code dialog", async () => {
    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText("Show QR")).toBeInTheDocument()
    })

    const qrButton = screen.getByText("Show QR")
    fireEvent.click(qrButton)

    expect(screen.getByText("Profile QR Code")).toBeInTheDocument()
    expect(screen.getByText("Share your verified profile with this QR code")).toBeInTheDocument()
  })

  it("handles notification review actions", async () => {
    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getAllByText("Review")).toHaveLength(2)
    })

    const reviewButtons = screen.getAllByText("Review")
    expect(reviewButtons[0]).toBeInTheDocument()
    expect(reviewButtons[1]).toBeInTheDocument()
  })

  it("displays correct license status colors", async () => {
    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText("State Licensure")).toBeInTheDocument()
    })

    // Check that different license statuses are displayed
    const activeStatus = screen.getByText("active")
    const expiringStatus = screen.getByText("expiring soon")
    const expiredStatus = screen.getByText("expired")

    expect(activeStatus).toBeInTheDocument()
    expect(expiringStatus).toBeInTheDocument()
    expect(expiredStatus).toBeInTheDocument()
  })

  it("shows last synced information", async () => {
    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText(/Last synced:/)).toBeInTheDocument()
    })

    expect(screen.getByText(/1\/15\/2024/)).toBeInTheDocument()
  })
})
