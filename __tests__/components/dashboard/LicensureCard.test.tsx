import { render, screen } from "@testing-library/react"
import { LicensureCard } from "@/components/dashboard/LicensureCard"

describe("LicensureCard", () => {
  const mockLicenses = [
    {
      state: "California",
      number: "A12345",
      status: "active" as const,
      expiration: "2025-12-31",
      verified: true,
    },
    {
      state: "Nevada",
      number: "NV98765",
      status: "expiring_soon" as const,
      expiration: "2024-03-15",
      verified: true,
    },
    {
      state: "Arizona",
      number: "AZ54321",
      status: "expired" as const,
      expiration: "2023-11-30",
      verified: false,
    },
  ]

  it("renders licensure information correctly", () => {
    render(<LicensureCard licenses={mockLicenses} />)

    expect(screen.getByText("State Licensure")).toBeInTheDocument()
    expect(screen.getByText("Professional licenses and certifications")).toBeInTheDocument()

    expect(screen.getByText("California")).toBeInTheDocument()
    expect(screen.getByText("Nevada")).toBeInTheDocument()
    expect(screen.getByText("Arizona")).toBeInTheDocument()

    expect(screen.getByText("A12345")).toBeInTheDocument()
    expect(screen.getByText("NV98765")).toBeInTheDocument()
    expect(screen.getByText("AZ54321")).toBeInTheDocument()
  })

  it("displays correct status badges", () => {
    render(<LicensureCard licenses={mockLicenses} />)

    expect(screen.getByText("active")).toBeInTheDocument()
    expect(screen.getByText("expiring soon")).toBeInTheDocument()
    expect(screen.getByText("expired")).toBeInTheDocument()
  })

  it("shows verification status", () => {
    render(<LicensureCard licenses={mockLicenses} />)

    const verifiedElements = screen.getAllByText("Verified")
    const unverifiedElements = screen.getAllByText("Unverified")

    expect(verifiedElements).toHaveLength(2)
    expect(unverifiedElements).toHaveLength(1)
  })

  it("handles empty licenses array", () => {
    render(<LicensureCard licenses={[]} />)

    expect(screen.getByText("State Licensure")).toBeInTheDocument()
    expect(screen.getByText("Professional licenses and certifications")).toBeInTheDocument()
  })

  it("formats expiration dates correctly", () => {
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 30)

    const licensesWithFutureExpiration = [
      {
        state: "Texas",
        number: "TX12345",
        status: "active" as const,
        expiration: futureDate.toISOString().split("T")[0],
        verified: true,
      },
    ]

    render(<LicensureCard licenses={licensesWithFutureExpiration} />)
    expect(screen.getByText(/Expires in \d+ days/)).toBeInTheDocument()
  })

  it("handles expired licenses correctly", () => {
    const expiredLicense = [
      {
        state: "Florida",
        number: "FL99999",
        status: "expired" as const,
        expiration: "2023-01-01",
        verified: false,
      },
    ]

    render(<LicensureCard licenses={expiredLicense} />)
    expect(screen.getByText(/Expired \d+ days ago/)).toBeInTheDocument()
  })

  it("displays proper visual indicators for different statuses", () => {
    render(<LicensureCard licenses={mockLicenses} />)

    // Check that status badges have proper styling classes
    const activeStatus = screen.getByText("active")
    const expiringSoonStatus = screen.getByText("expiring soon")
    const expiredStatus = screen.getByText("expired")

    expect(activeStatus).toBeInTheDocument()
    expect(expiringSoonStatus).toBeInTheDocument()
    expect(expiredStatus).toBeInTheDocument()
  })
})
