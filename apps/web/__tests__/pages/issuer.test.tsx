import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import IssuerPage from "@/app/issuer/page"
import { jest } from "@jest/globals"

beforeEach(() => {
  global.fetch = jest.fn()
})

afterEach(() => {
  jest.resetAllMocks()
})

describe("Issuer Page", () => {
  it("renders issuer management interface", () => {
    render(<IssuerPage />)

    expect(screen.getByText("Credential Management")).toBeInTheDocument()
    expect(screen.getByText("Issue Credential")).toBeInTheDocument()
    expect(screen.getByText("Revoke Credential")).toBeInTheDocument()
  })

  it("renders issue credential form with subjectId field", () => {
    render(<IssuerPage />)

    expect(screen.getByText("Issue New Credential")).toBeInTheDocument()
    expect(screen.getByLabelText("Credential Type *")).toBeInTheDocument()
    expect(screen.getByLabelText("Subject ID *")).toBeInTheDocument()
    expect(screen.getByLabelText("License Number *")).toBeInTheDocument()
    expect(screen.getByLabelText("Issuing Authority *")).toBeInTheDocument()
    expect(screen.getByLabelText("Expiry Date")).toBeInTheDocument()
    expect(screen.getByLabelText("Additional Data (JSON)")).toBeInTheDocument()
  })

  it("switches between issue and revoke tabs", () => {
    render(<IssuerPage />)

    const revokeTab = screen.getByText("Revoke Credential")
    fireEvent.click(revokeTab)

    expect(screen.getByText("Revoke an existing credential and provide a reason")).toBeInTheDocument()
  })

  it("disables issue button when required fields are empty", () => {
    render(<IssuerPage />)

    const issueButton = screen.getByRole("button", { name: "Issue Credential" })
    expect(issueButton).toBeDisabled()
  })

  it("enables issue button when all required fields are filled", async () => {
    render(<IssuerPage />)

    // Fill required fields
    const credentialTypeSelect = screen.getByRole("combobox")
    fireEvent.click(credentialTypeSelect)

    await waitFor(() => {
      const medicalLicenseOption = screen.getByText("Medical License")
      fireEvent.click(medicalLicenseOption)
    })

    fireEvent.change(screen.getByLabelText("License Number *"), { target: { value: "LIC-12345" } })
    fireEvent.change(screen.getByLabelText("Subject ID *"), { target: { value: "1234567890" } })
    fireEvent.change(screen.getByLabelText("Issuing Authority *"), { target: { value: "Medical Board" } })

    const issueButton = screen.getByRole("button", { name: "Issue Credential" })
    expect(issueButton).not.toBeDisabled()
  })

  it("makes API call when issuing credential with subjectId", async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ credentialId: "CRED-12345", status: "issued" }),
    })

    render(<IssuerPage />)

    // Fill and submit form
    const credentialTypeSelect = screen.getByRole("combobox")
    fireEvent.click(credentialTypeSelect)

    await waitFor(() => {
      const medicalLicenseOption = screen.getByText("Medical License")
      fireEvent.click(medicalLicenseOption)
    })

    fireEvent.change(screen.getByLabelText("License Number *"), { target: { value: "LIC-12345" } })
    fireEvent.change(screen.getByLabelText("Subject ID *"), { target: { value: "1234567890" } })
    fireEvent.change(screen.getByLabelText("Issuing Authority *"), { target: { value: "Medical Board" } })

    const issueButton = screen.getByRole("button", { name: "Issue Credential" })
    fireEvent.click(issueButton)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/issuer/credential", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "Medical License",
          subjectId: "1234567890",
          licenseNumber: "LIC-12345",
          issuingAuthority: "Medical Board",
          expiryDate: "",
          additionalData: undefined,
        }),
      })
    })
  })

  it("shows success toast with profile link after issuing credential", async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ credentialId: "CRED-12345", status: "issued" }),
    })

    render(<IssuerPage />)

    // Fill and submit form
    const credentialTypeSelect = screen.getByRole("combobox")
    fireEvent.click(credentialTypeSelect)

    await waitFor(() => {
      const medicalLicenseOption = screen.getByText("Medical License")
      fireEvent.click(medicalLicenseOption)
    })

    fireEvent.change(screen.getByLabelText("License Number *"), { target: { value: "LIC-12345" } })
    fireEvent.change(screen.getByLabelText("Subject ID *"), { target: { value: "1234567890" } })
    fireEvent.change(screen.getByLabelText("Issuing Authority *"), { target: { value: "Medical Board" } })

    const issueButton = screen.getByRole("button", { name: "Issue Credential" })
    fireEvent.click(issueButton)

    await waitFor(() => {
      expect(screen.getByText("Credential Issued")).toBeInTheDocument()
      expect(screen.getByText("View Profile →")).toBeInTheDocument()
    })
  })

  it("handles API errors when issuing credential", async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: "Bad Request",
    })

    render(<IssuerPage />)

    // Fill and submit form
    const credentialTypeSelect = screen.getByRole("combobox")
    fireEvent.click(credentialTypeSelect)

    await waitFor(() => {
      const medicalLicenseOption = screen.getByText("Medical License")
      fireEvent.click(medicalLicenseOption)
    })

    fireEvent.change(screen.getByLabelText("License Number *"), { target: { value: "LIC-12345" } })
    fireEvent.change(screen.getByLabelText("Subject ID *"), { target: { value: "1234567890" } })
    fireEvent.change(screen.getByLabelText("Issuing Authority *"), { target: { value: "Medical Board" } })

    const issueButton = screen.getByRole("button", { name: "Issue Credential" })
    fireEvent.click(issueButton)

    await waitFor(() => {
      expect(screen.getByText("Issue Failed")).toBeInTheDocument()
    })
  })

  it("displays issued credentials list", () => {
    render(<IssuerPage />)

    const revokeTab = screen.getByText("Revoke Credential")
    fireEvent.click(revokeTab)

    expect(screen.getByText("Issued Credentials")).toBeInTheDocument()
    expect(screen.getByText("CRED-12345")).toBeInTheDocument()
    expect(screen.getByText("Dr. Sarah Johnson")).toBeInTheDocument()
  })

  it("shows revocation warning", () => {
    render(<IssuerPage />)

    const revokeTab = screen.getByText("Revoke Credential")
    fireEvent.click(revokeTab)

    expect(screen.getByText("Warning: Revoking a credential is permanent and cannot be undone.")).toBeInTheDocument()
  })

  it("makes API call when revoking credential", async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ credentialId: "CRED-12345", status: "revoked" }),
    })

    render(<IssuerPage />)

    const revokeTab = screen.getByText("Revoke Credential")
    fireEvent.click(revokeTab)

    // Select credential to revoke
    const credentialSelect = screen.getByRole("combobox")
    fireEvent.click(credentialSelect)

    await waitFor(() => {
      const credentialOption = screen.getByText("CRED-12345 - Dr. Sarah Johnson (Medical License)")
      fireEvent.click(credentialOption)
    })

    // Fill reason
    fireEvent.change(screen.getByLabelText("Reason for Revocation *"), {
      target: { value: "License expired" },
    })

    const revokeButton = screen.getByRole("button", { name: "Revoke Credential" })
    fireEvent.click(revokeButton)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/status/revoke", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          credentialId: "CRED-12345",
          reason: "License expired",
        }),
      })
    })
  })

  it("shows loading state when issuing credential", async () => {
    ;(global.fetch as jest.Mock).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ ok: true, json: () => ({}) }), 100)),
    )

    render(<IssuerPage />)

    // Fill and submit form
    const credentialTypeSelect = screen.getByRole("combobox")
    fireEvent.click(credentialTypeSelect)

    await waitFor(() => {
      const medicalLicenseOption = screen.getByText("Medical License")
      fireEvent.click(medicalLicenseOption)
    })

    fireEvent.change(screen.getByLabelText("License Number *"), { target: { value: "LIC-12345" } })
    fireEvent.change(screen.getByLabelText("Subject ID *"), { target: { value: "1234567890" } })
    fireEvent.change(screen.getByLabelText("Issuing Authority *"), { target: { value: "Medical Board" } })

    const issueButton = screen.getByRole("button", { name: "Issue Credential" })
    fireEvent.click(issueButton)

    expect(screen.getByText("Issuing Credential...")).toBeInTheDocument()
  })

  it("validates JSON format in additional data field", async () => {
    render(<IssuerPage />)

    const additionalDataField = screen.getByLabelText("Additional Data (JSON)")
    fireEvent.change(additionalDataField, { target: { value: "invalid json" } })

    const credentialTypeSelect = screen.getByRole("combobox")
    fireEvent.click(credentialTypeSelect)

    await waitFor(() => {
      const medicalLicenseOption = screen.getByText("Medical License")
      fireEvent.click(medicalLicenseOption)
    })

    fireEvent.change(screen.getByLabelText("License Number *"), { target: { value: "LIC-12345" } })
    fireEvent.change(screen.getByLabelText("Subject ID *"), { target: { value: "1234567890" } })
    fireEvent.change(screen.getByLabelText("Issuing Authority *"), { target: { value: "Medical Board" } })

    const issueButton = screen.getByRole("button", { name: "Issue Credential" })
    fireEvent.click(issueButton)

    // Should handle JSON parsing error gracefully
    await waitFor(() => {
      expect(screen.getByText("Issue Failed")).toBeInTheDocument()
    })
  })

  it("only shows active credentials in revoke dropdown", async () => {
    render(<IssuerPage />)

    const revokeTab = screen.getByText("Revoke Credential")
    fireEvent.click(revokeTab)

    const credentialSelect = screen.getByRole("combobox")
    fireEvent.click(credentialSelect)

    await waitFor(() => {
      // Should show active credentials
      expect(screen.getByText("CRED-12345 - Dr. Sarah Johnson (Medical License)")).toBeInTheDocument()
      expect(screen.getByText("CRED-67890 - Dr. Michael Chen (Board Certification)")).toBeInTheDocument()

      // Should not show revoked credentials
      expect(screen.queryByText("CRED-11111 - Dr. Emily Davis (DEA Registration)")).not.toBeInTheDocument()
    })
  })

  it("resets form after successful credential issuance", async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ credentialId: "CRED-12345", status: "issued" }),
    })

    render(<IssuerPage />)

    // Fill form
    const credentialTypeSelect = screen.getByRole("combobox")
    fireEvent.click(credentialTypeSelect)

    await waitFor(() => {
      const medicalLicenseOption = screen.getByText("Medical License")
      fireEvent.click(medicalLicenseOption)
    })

    const licenseNumberInput = screen.getByLabelText("License Number *")
    const subjectIdInput = screen.getByLabelText("Subject ID *")
    const issuingAuthorityInput = screen.getByLabelText("Issuing Authority *")

    fireEvent.change(licenseNumberInput, { target: { value: "LIC-12345" } })
    fireEvent.change(subjectIdInput, { target: { value: "1234567890" } })
    fireEvent.change(issuingAuthorityInput, { target: { value: "Medical Board" } })

    const issueButton = screen.getByRole("button", { name: "Issue Credential" })
    fireEvent.click(issueButton)

    await waitFor(() => {
      expect(screen.getByText("Credential Issued")).toBeInTheDocument()
    })

    // Check form is reset
    expect(licenseNumberInput).toHaveValue("")
    expect(subjectIdInput).toHaveValue("")
    expect(issuingAuthorityInput).toHaveValue("")
  })

  it("has proper accessibility attributes", () => {
    render(<IssuerPage />)

    expect(screen.getByLabelText("Credential Type *")).toHaveAttribute("required")
    expect(screen.getByLabelText("License Number *")).toHaveAttribute("required")
    expect(screen.getByLabelText("Subject ID *")).toHaveAttribute("required")
    expect(screen.getByLabelText("Issuing Authority *")).toHaveAttribute("required")
  })

  it("handles concurrent operations correctly", async () => {
    ;(global.fetch as jest.Mock).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ ok: true, json: () => ({}) }), 100)),
    )

    render(<IssuerPage />)

    // Fill and submit form
    const credentialTypeSelect = screen.getByRole("combobox")
    fireEvent.click(credentialTypeSelect)

    await waitFor(() => {
      const medicalLicenseOption = screen.getByText("Medical License")
      fireEvent.click(medicalLicenseOption)
    })

    fireEvent.change(screen.getByLabelText("License Number *"), { target: { value: "LIC-12345" } })
    fireEvent.change(screen.getByLabelText("Subject ID *"), { target: { value: "1234567890" } })
    fireEvent.change(screen.getByLabelText("Issuing Authority *"), { target: { value: "Medical Board" } })

    const issueButton = screen.getByRole("button", { name: "Issue Credential" })

    // Click multiple times to test concurrent handling
    fireEvent.click(issueButton)
    fireEvent.click(issueButton)

    expect(screen.getByText("Issuing Credential...")).toBeInTheDocument()
    expect(issueButton).toBeDisabled()
  })
})
