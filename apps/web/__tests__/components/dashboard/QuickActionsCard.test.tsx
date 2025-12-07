import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { QuickActionsCard } from "@/components/dashboard/QuickActionsCard"
import { useToast } from "@/hooks/use-toast"
import jest from "jest" // Import jest to fix the undeclared variable error

jest.mock("@/hooks/use-toast")
const mockToast = jest.fn()
;(useToast as jest.Mock).mockReturnValue({ toast: mockToast })

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

// Mock window.open
Object.defineProperty(window, "open", {
  value: jest.fn(),
  writable: true,
})

describe("QuickActionsCard", () => {
  const mockProps = {
    npi: "1234567890",
    onDownloadPDF: jest.fn().mockResolvedValue(undefined),
    onShareProfile: jest.fn().mockResolvedValue(undefined),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders quick actions correctly", () => {
    render(<QuickActionsCard {...mockProps} />)

    expect(screen.getByText("Quick Actions")).toBeInTheDocument()
    expect(screen.getByText("Download PDF Report")).toBeInTheDocument()
    expect(screen.getByText("Share Profile Link")).toBeInTheDocument()
    expect(screen.getByText("Generate QR Code")).toBeInTheDocument()
  })

  it("handles PDF download", async () => {
    render(<QuickActionsCard {...mockProps} />)

    const downloadButton = screen.getByText("Download PDF Report")
    fireEvent.click(downloadButton)

    expect(screen.getByText("Generating PDF...")).toBeInTheDocument()
    expect(mockProps.onDownloadPDF).toHaveBeenCalled()

    await waitFor(() => {
      expect(screen.getByText("Download PDF Report")).toBeInTheDocument()
    })
  })

  it("handles profile sharing", async () => {
    render(<QuickActionsCard {...mockProps} />)

    const shareButton = screen.getByText("Share Profile Link")
    fireEvent.click(shareButton)

    expect(screen.getByText("Copying Link...")).toBeInTheDocument()
    expect(mockProps.onShareProfile).toHaveBeenCalled()

    await waitFor(() => {
      expect(screen.getByText("Share Profile Link")).toBeInTheDocument()
    })
  })

  it("opens QR code dialog", () => {
    render(<QuickActionsCard {...mockProps} />)

    const qrButton = screen.getByText("Generate QR Code")
    fireEvent.click(qrButton)

    expect(screen.getByText("Profile QR Code")).toBeInTheDocument()
    expect(screen.getByText("Share your verified profile with this QR code")).toBeInTheDocument()
  })

  it("handles copy profile link in QR dialog", async () => {
    render(<QuickActionsCard {...mockProps} />)

    const qrButton = screen.getByText("Generate QR Code")
    fireEvent.click(qrButton)

    const copyButton = screen.getByText("Copy Link")
    fireEvent.click(copyButton)

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith("https://vitalcv.com/profile/1234567890")
      expect(mockToast).toHaveBeenCalledWith({
        title: "Link Copied",
        description: "Profile link copied to clipboard",
      })
    })
  })

  it("handles errors gracefully", async () => {
    const failingOnDownload = jest.fn().mockRejectedValue(new Error("Download failed"))
    render(<QuickActionsCard {...mockProps} onDownloadPDF={failingOnDownload} />)

    const downloadButton = screen.getByText("Download PDF Report")
    fireEvent.click(downloadButton)

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: "Error",
        description: "Failed to download",
        variant: "destructive",
      })
    })
  })

  it("generates correct QR code URL", () => {
    render(<QuickActionsCard {...mockProps} />)

    const qrButton = screen.getByText("Generate QR Code")
    fireEvent.click(qrButton)

    const qrImage = screen.getByAltText("Profile QR Code")
    expect(qrImage).toHaveAttribute("src", expect.stringContaining("api.qrserver.com"))
    expect(qrImage).toHaveAttribute("src", expect.stringContaining("1234567890"))
  })

  it("handles view profile button in QR dialog", () => {
    render(<QuickActionsCard {...mockProps} />)

    const qrButton = screen.getByText("Generate QR Code")
    fireEvent.click(qrButton)

    const viewProfileButton = screen.getByText("View Profile")
    fireEvent.click(viewProfileButton)

    expect(window.open).toHaveBeenCalledWith("https://vitalcv.com/profile/1234567890", "_blank")
  })

  it("handles clipboard copy errors gracefully", async () => {
    const clipboardError = new Error("Clipboard access denied")
    ;(navigator.clipboard.writeText as jest.Mock).mockRejectedValueOnce(clipboardError)

    render(<QuickActionsCard {...mockProps} />)

    const qrButton = screen.getByText("Generate QR Code")
    fireEvent.click(qrButton)

    const copyButton = screen.getByText("Copy Link")
    fireEvent.click(copyButton)

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: "Error",
        description: "Failed to copy profile link",
        variant: "destructive",
      })
    })
  })

  it("disables buttons while actions are loading", async () => {
    render(<QuickActionsCard {...mockProps} />)

    const downloadButton = screen.getByText("Download PDF Report")
    const shareButton = screen.getByText("Share Profile Link")

    fireEvent.click(downloadButton)

    expect(downloadButton).toBeDisabled()
    expect(shareButton).not.toBeDisabled()

    await waitFor(() => {
      expect(downloadButton).not.toBeDisabled()
    })
  })
})
