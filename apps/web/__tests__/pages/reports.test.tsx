import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import ReportPage from "@/app/reports/[id]/page"
import { jest } from "@jest/globals"

beforeEach(() => {
  global.fetch = jest.fn()
  // Mock URL.createObjectURL and related methods
  global.URL.createObjectURL = jest.fn(() => "mock-url")
  global.URL.revokeObjectURL = jest.fn()

  // Mock document.createElement and appendChild
  const mockLink = {
    href: "",
    download: "",
    click: jest.fn(),
  }
  document.createElement = jest.fn(() => mockLink as any)
  document.body.appendChild = jest.fn()
  document.body.removeChild = jest.fn()
})

afterEach(() => {
  jest.resetAllMocks()
})

describe("Report Page", () => {
  const mockParams = { id: "report-123" }

  it("renders report page", async () => {
    render(<ReportPage params={mockParams} />)

    await waitFor(() => {
      expect(screen.getByText("Verification Report")).toBeInTheDocument()
    })
  })

  it("displays report ID and timestamp", async () => {
    render(<ReportPage params={mockParams} />)

    await waitFor(() => {
      expect(screen.getByText("Report ID: report-123")).toBeInTheDocument()
    })
  })

  it("shows download buttons", async () => {
    render(<ReportPage params={mockParams} />)

    await waitFor(() => {
      expect(screen.getByText("Download PDF")).toBeInTheDocument()
      expect(screen.getByText("Download FHIR Bundle")).toBeInTheDocument()
      expect(screen.getByText("Share")).toBeInTheDocument()
      expect(screen.getByText("Archive")).toBeInTheDocument()
    })
  })

  it("displays FHIR bundle information", async () => {
    render(<ReportPage params={mockParams} />)

    await waitFor(() => {
      expect(screen.getByText("FHIR Bundle Available")).toBeInTheDocument()
      expect(screen.getByText("FHIR R4")).toBeInTheDocument()
      expect(screen.getByText("Practitioner Resource")).toBeInTheDocument()
    })
  })

  it("downloads FHIR bundle when button clicked", async () => {
    const mockBlob = new Blob(['{"test": "data"}'], { type: "application/fhir+json" })
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      blob: () => Promise.resolve(mockBlob),
    })

    render(<ReportPage params={mockParams} />)

    await waitFor(() => {
      const downloadButton = screen.getByText("Download FHIR Bundle")
      fireEvent.click(downloadButton)
    })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/reports/report-123/fhir-bundle", {
        method: "GET",
        headers: {
          Accept: "application/fhir+json",
        },
      })
    })
  })

  it("shows loading state during FHIR download", async () => {
    ;(global.fetch as jest.Mock).mockImplementation(() => new Promise(() => {})) // Never resolves

    render(<ReportPage params={mockParams} />)

    await waitFor(() => {
      const downloadButton = screen.getByText("Download FHIR Bundle")
      fireEvent.click(downloadButton)
    })

    expect(screen.getByText("Downloading...")).toBeInTheDocument()
  })

  it("displays recommendation badge", async () => {
    render(<ReportPage params={mockParams} />)

    await waitFor(() => {
      expect(screen.getByText("Proceed")).toBeInTheDocument()
    })
  })

  it("shows cleared and pending credentials", async () => {
    render(<ReportPage params={mockParams} />)

    await waitFor(() => {
      expect(screen.getByText("Cleared Credentials")).toBeInTheDocument()
      expect(screen.getByText("Pending Credentials")).toBeInTheDocument()
    })
  })
})
