import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { CredentialStatusCard } from "@/components/CredentialStatusCard"

const mockValidResult = {
  status: "valid" as const,
  credentialId: "CRED-12345",
  details: {
    issuer: "California Medical Board",
    issuedDate: "2023-01-15",
    expiryDate: "2025-01-15",
    disclosureType: "Selective disclosure",
  },
}

const mockRevokedResult = {
  status: "revoked" as const,
  credentialId: "CRED-REVOKED",
  details: {
    reason: "License suspended",
  },
}

describe("CredentialStatusCard", () => {
  it("renders valid credential correctly", () => {
    render(<CredentialStatusCard result={mockValidResult} />)

    expect(screen.getByText("Credential Valid")).toBeInTheDocument()
    expect(screen.getByText("CRED-12345")).toBeInTheDocument()
    expect(screen.getByText("California Medical Board")).toBeInTheDocument()
    expect(screen.getByText("valid")).toBeInTheDocument()
  })

  it("renders revoked credential correctly", () => {
    render(<CredentialStatusCard result={mockRevokedResult} />)

    expect(screen.getByText("Credential Revoked")).toBeInTheDocument()
    expect(screen.getByText("CRED-REVOKED")).toBeInTheDocument()
    expect(screen.getByText("License suspended")).toBeInTheDocument()
    expect(screen.getByText("revoked")).toBeInTheDocument()
  })

  it("displays credential details when provided", () => {
    render(<CredentialStatusCard result={mockValidResult} />)

    expect(screen.getByText("1/15/2023")).toBeInTheDocument()
    expect(screen.getByText("1/15/2025")).toBeInTheDocument()
    expect(screen.getByText("Selective disclosure")).toBeInTheDocument()
  })

  it("shows QR code and share buttons", () => {
    render(<CredentialStatusCard result={mockValidResult} />)

    expect(screen.getByText("Show QR Code")).toBeInTheDocument()
    expect(screen.getByText("Share Link")).toBeInTheDocument()
  })

  it("opens QR dialog when QR button is clicked", async () => {
    render(<CredentialStatusCard result={mockValidResult} />)

    const qrButton = screen.getByText("Show QR Code")
    fireEvent.click(qrButton)

    await waitFor(() => {
      expect(screen.getByText("Verifiable Presentation QR Code")).toBeInTheDocument()
    })
  })

  it("opens share dialog when share button is clicked", async () => {
    render(<CredentialStatusCard result={mockValidResult} />)

    const shareButton = screen.getByText("Share Link")
    fireEvent.click(shareButton)

    await waitFor(() => {
      expect(screen.getByText("One-Time Share Link")).toBeInTheDocument()
    })
  })

  it("generates VP token when QR dialog opens", async () => {
    render(<CredentialStatusCard result={mockValidResult} />)

    const qrButton = screen.getByText("Show QR Code")
    fireEvent.click(qrButton)

    await waitFor(() => {
      expect(screen.getByText("Verifiable Presentation QR Code")).toBeInTheDocument()
    })

    // Wait for VP token to be generated
    await waitFor(() => {
      expect(screen.getByText(/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9/)).toBeInTheDocument()
    })
  })

  it("generates share URL when share dialog opens", async () => {
    render(<CredentialStatusCard result={mockValidResult} />)

    const shareButton = screen.getByText("Share Link")
    fireEvent.click(shareButton)

    await waitFor(() => {
      expect(screen.getByText("One-Time Share Link")).toBeInTheDocument()
    })

    // Wait for share URL to be generated
    await waitFor(() => {
      expect(screen.getByText(/https:\/\/vitalcv\.com\/share\/abc123def456/)).toBeInTheDocument()
    })
  })
})
