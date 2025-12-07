import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { useSearchParams } from "next/navigation"
import ProfilePage from "@/app/profile/page"
import { useToast } from "@/hooks/use-toast"
import jest from "jest" // Declare the jest variable

// Mock dependencies
jest.mock("next/navigation", () => ({
  useSearchParams: jest.fn(),
}))

jest.mock("@/hooks/use-toast", () => ({
  useToast: jest.fn(),
}))

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn(),
  },
})

const mockToast = jest.fn()
const mockSearchParams = {
  get: jest.fn(),
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(useToast as jest.Mock).mockReturnValue({ toast: mockToast })
  ;(useSearchParams as jest.Mock).mockReturnValue(mockSearchParams)
})

describe("ProfilePage", () => {
  it("renders loading state initially", () => {
    mockSearchParams.get.mockReturnValue("1234567890")
    render(<ProfilePage />)

    expect(screen.getByText("VitalCV")).toBeInTheDocument()
    expect(screen.getAllByTestId("skeleton")).toHaveLength(expect.any(Number))
  })

  it("renders profile data after loading", async () => {
    mockSearchParams.get.mockReturnValue("1234567890")
    render(<ProfilePage />)

    await waitFor(() => {
      expect(screen.getByText("Dr. Sarah Johnson")).toBeInTheDocument()
    })

    expect(screen.getByText("Internal Medicine")).toBeInTheDocument()
    expect(screen.getByText("San Francisco, CA")).toBeInTheDocument()
    expect(screen.getByText("Verified via NPI")).toBeInTheDocument()
  })

  it("displays expandable sections", async () => {
    mockSearchParams.get.mockReturnValue("1234567890")
    render(<ProfilePage />)

    await waitFor(() => {
      expect(screen.getByText("Dr. Sarah Johnson")).toBeInTheDocument()
    })

    expect(screen.getByText("Education")).toBeInTheDocument()
    expect(screen.getByText("Experience")).toBeInTheDocument()
    expect(screen.getByText("Licenses")).toBeInTheDocument()
    expect(screen.getByText("Certifications")).toBeInTheDocument()
  })

  it("shows education details when expanded", async () => {
    mockSearchParams.get.mockReturnValue("1234567890")
    render(<ProfilePage />)

    await waitFor(() => {
      expect(screen.getByText("Dr. Sarah Johnson")).toBeInTheDocument()
    })

    // Education should be expanded by default
    expect(screen.getByText("Doctor of Medicine (MD)")).toBeInTheDocument()
    expect(screen.getByText("Stanford University School of Medicine")).toBeInTheDocument()
    expect(screen.getByText("Magna Cum Laude, Alpha Omega Alpha Honor Society")).toBeInTheDocument()
  })

  it("shows experience details when expanded", async () => {
    mockSearchParams.get.mockReturnValue("1234567890")
    render(<ProfilePage />)

    await waitFor(() => {
      expect(screen.getByText("Dr. Sarah Johnson")).toBeInTheDocument()
    })

    // Experience should be expanded by default
    expect(screen.getByText("Attending Physician, Internal Medicine")).toBeInTheDocument()
    expect(screen.getByText("UCSF Medical Center")).toBeInTheDocument()
  })

  it("displays license information with proper status badges", async () => {
    mockSearchParams.get.mockReturnValue("1234567890")
    render(<ProfilePage />)

    await waitFor(() => {
      expect(screen.getByText("Dr. Sarah Johnson")).toBeInTheDocument()
    })

    // Click to expand licenses section
    const licensesButton = screen.getByRole("button", { name: /licenses/i })
    fireEvent.click(licensesButton)

    await waitFor(() => {
      expect(screen.getByText("California")).toBeInTheDocument()
      expect(screen.getByText("Nevada")).toBeInTheDocument()
      expect(screen.getByText("Arizona")).toBeInTheDocument()
    })

    // Check status badges
    expect(screen.getByText("active")).toBeInTheDocument()
    expect(screen.getByText("expiring soon")).toBeInTheDocument()
    expect(screen.getByText("expired")).toBeInTheDocument()
  })

  it("displays certifications when expanded", async () => {
    mockSearchParams.get.mockReturnValue("1234567890")
    render(<ProfilePage />)

    await waitFor(() => {
      expect(screen.getByText("Dr. Sarah Johnson")).toBeInTheDocument()
    })

    // Click to expand certifications section
    const certificationsButton = screen.getByRole("button", { name: /certifications/i })
    fireEvent.click(certificationsButton)

    await waitFor(() => {
      expect(screen.getByText("Board Certification in Internal Medicine")).toBeInTheDocument()
      expect(screen.getByText("American Board of Internal Medicine")).toBeInTheDocument()
      expect(screen.getByText("Advanced Cardiac Life Support (ACLS)")).toBeInTheDocument()
    })
  })

  it("handles download PDF action", async () => {
    mockSearchParams.get.mockReturnValue("1234567890")
    render(<ProfilePage />)

    await waitFor(() => {
      expect(screen.getByText("Dr. Sarah Johnson")).toBeInTheDocument()
    })

    const downloadButton = screen.getByRole("button", { name: /download pdf/i })
    fireEvent.click(downloadButton)

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: "PDF Generated",
        description: "Profile PDF has been downloaded",
      })
    })
  })

  it("handles share profile action", async () => {
    mockSearchParams.get.mockReturnValue("1234567890")
    ;(navigator.clipboard.writeText as jest.Mock).mockResolvedValue(undefined)

    render(<ProfilePage />)

    await waitFor(() => {
      expect(screen.getByText("Dr. Sarah Johnson")).toBeInTheDocument()
    })

    const shareButton = screen.getByRole("button", { name: /share link/i })
    fireEvent.click(shareButton)

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining("/profile?id=1234567890"))
      expect(mockToast).toHaveBeenCalledWith({
        title: "Link Copied",
        description: "Profile link copied to clipboard",
      })
    })
  })

  it("opens QR code dialog", async () => {
    mockSearchParams.get.mockReturnValue("1234567890")
    render(<ProfilePage />)

    await waitFor(() => {
      expect(screen.getByText("Dr. Sarah Johnson")).toBeInTheDocument()
    })

    const qrButton = screen.getByRole("button", { name: /show qr/i })
    fireEvent.click(qrButton)

    await waitFor(() => {
      expect(screen.getByText("Profile QR Code")).toBeInTheDocument()
      expect(screen.getByText("Share this verified profile with the QR code")).toBeInTheDocument()
    })
  })

  it("handles missing profile ID", async () => {
    mockSearchParams.get.mockReturnValue(null)
    render(<ProfilePage />)

    await waitFor(() => {
      expect(screen.getByText("Dr. Sarah Johnson")).toBeInTheDocument()
    })

    // Should still render with default NPI
    expect(screen.getByText("Internal Medicine")).toBeInTheDocument()
  })

  it("handles clipboard copy errors gracefully", async () => {
    mockSearchParams.get.mockReturnValue("1234567890")
    ;(navigator.clipboard.writeText as jest.Mock).mockRejectedValue(new Error("Clipboard error"))

    render(<ProfilePage />)

    await waitFor(() => {
      expect(screen.getByText("Dr. Sarah Johnson")).toBeInTheDocument()
    })

    const shareButton = screen.getByRole("button", { name: /share link/i })
    fireEvent.click(shareButton)

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: "Error",
        description: "Failed to copy profile link",
        variant: "destructive",
      })
    })
  })

  it("renders responsive layout correctly", async () => {
    mockSearchParams.get.mockReturnValue("1234567890")
    render(<ProfilePage />)

    await waitFor(() => {
      expect(screen.getByText("Dr. Sarah Johnson")).toBeInTheDocument()
    })

    // Check that responsive classes are applied
    const container = screen.getByText("Dr. Sarah Johnson").closest(".container")
    expect(container).toHaveClass("mx-auto", "px-4")
  })

  it("displays proper theme-aware styling", async () => {
    mockSearchParams.get.mockReturnValue("1234567890")
    render(<ProfilePage />)

    await waitFor(() => {
      expect(screen.getByText("Dr. Sarah Johnson")).toBeInTheDocument()
    })

    // Check glassmorphism background
    const mainContainer = document.querySelector(".bg-gradient-to-br")
    expect(mainContainer).toHaveClass("from-blue-50", "via-white", "to-teal-50")

    // Check card styling
    const cards = document.querySelectorAll(".bg-white\\/80")
    expect(cards.length).toBeGreaterThan(0)
  })
})
