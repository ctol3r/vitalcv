import { render, screen } from "@testing-library/react"
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
})
