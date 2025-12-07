import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import VerifyPage from "@/app/verify/page"
import { jest } from "@jest/globals"

// Mock fetch
beforeEach(() => {
  global.fetch = jest.fn()
})

afterEach(() => {
  jest.resetAllMocks()
})

describe("Verify Page", () => {
  it("renders verify form", () => {
    render(<VerifyPage />)

    expect(screen.getByText("Verify Credential")).toBeInTheDocument()
    expect(screen.getByLabelText("Credential ID *")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Verify Credential" })).toBeInTheDocument()
  })

  it("renders privacy mode toggle", () => {
    render(<VerifyPage />)

    expect(screen.getByText("Privacy Mode")).toBeInTheDocument()
    expect(screen.getByText("Full disclosure - complete credential details shared")).toBeInTheDocument()
  })

  it("renders nonce and audience fields", () => {
    render(<VerifyPage />)

    expect(screen.getByLabelText("Nonce (Optional)")).toBeInTheDocument()
    expect(screen.getByLabelText("Audience (Optional)")).toBeInTheDocument()
  })

  it("disables submit button when credential ID is empty", () => {
    render(<VerifyPage />)

    const submitButton = screen.getByRole("button", { name: "Verify Credential" })
    expect(submitButton).toBeDisabled()
  })

  it("enables submit button when credential ID is provided", () => {
    render(<VerifyPage />)

    const credentialInput = screen.getByLabelText("Credential ID *")
    const submitButton = screen.getByRole("button", { name: "Verify Credential" })

    fireEvent.change(credentialInput, { target: { value: "CRED-12345" } })
    expect(submitButton).not.toBeDisabled()
  })

  it("toggles privacy mode correctly", () => {
    render(<VerifyPage />)

    const privacyToggle = screen.getByRole("switch")
    expect(screen.getByText("Full disclosure - complete credential details shared")).toBeInTheDocument()

    fireEvent.click(privacyToggle)
    expect(screen.getByText("Selective disclosure - only essential information shared")).toBeInTheDocument()
  })

  it("shows loading state during verification", async () => {
    render(<VerifyPage />)

    const credentialInput = screen.getByLabelText("Credential ID *")
    const submitButton = screen.getByRole("button", { name: "Verify Credential" })

    fireEvent.change(credentialInput, { target: { value: "CRED-12345" } })
    fireEvent.click(submitButton)

    expect(screen.getByText("Verifying...")).toBeInTheDocument()
  })

  it("makes API call with correct parameters", async () => {
    render(<VerifyPage />)

    const credentialInput = screen.getByLabelText("Credential ID *")
    const nonceInput = screen.getByLabelText("Nonce (Optional)")
    const audienceInput = screen.getByLabelText("Audience (Optional)")
    const privacyToggle = screen.getByRole("switch")
    const submitButton = screen.getByRole("button", { name: "Verify Credential" })

    fireEvent.change(credentialInput, { target: { value: "CRED-12345" } })
    fireEvent.change(nonceInput, { target: { value: "test-nonce" } })
    fireEvent.change(audienceInput, { target: { value: "test-audience" } })
    fireEvent.click(privacyToggle)
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/verifier/presentation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          credentialId: "CRED-12345",
          nonce: "test-nonce",
          audience: "test-audience",
          privacyMode: true,
        }),
      })
    })
  })

  it("displays verification result", async () => {
    render(<VerifyPage />)

    const credentialInput = screen.getByLabelText("Credential ID *")
    const submitButton = screen.getByRole("button", { name: "Verify Credential" })

    fireEvent.change(credentialInput, { target: { value: "CRED-12345" } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText("Verification Result")).toBeInTheDocument()
    })
  })

  it("handles revoked credentials", async () => {
    render(<VerifyPage />)

    const credentialInput = screen.getByLabelText("Credential ID *")
    const submitButton = screen.getByRole("button", { name: "Verify Credential" })

    fireEvent.change(credentialInput, { target: { value: "CRED-revoked-001" } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText("Credential Revoked")).toBeInTheDocument()
    })
  })

  it("handles unknown credentials", async () => {
    render(<VerifyPage />)

    const credentialInput = screen.getByLabelText("Credential ID *")
    const submitButton = screen.getByRole("button", { name: "Verify Credential" })

    fireEvent.change(credentialInput, { target: { value: "CRED-unknown-999" } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText("Credential Unknown")).toBeInTheDocument()
    })
  })

  it("handles all privacy modes correctly", async () => {
    render(<VerifyPage />)

    const credentialInput = screen.getByLabelText("Credential ID *")
    const privacySelect = screen.getByRole("combobox")
    const submitButton = screen.getByRole("button", { name: /Verify Presentation/i })

    fireEvent.change(credentialInput, { target: { value: "CRED-12345" } })

    // Test BBS+ mode
    fireEvent.click(privacySelect)
    await waitFor(() => {
      fireEvent.click(screen.getByText("BBS+ - Selective disclosure"))
    })

    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/verifier/presentation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          credentialId: "CRED-12345",
          nonce: expect.any(String),
          audience: "vitalcv.com",
          privacyMode: true,
          disclosureType: "bbs",
        }),
      })
    })

    // Test ZK mode
    fireEvent.click(privacySelect)
    await waitFor(() => {
      fireEvent.click(screen.getByText("ZK - Zero-knowledge proof"))
    })
  })

  it("displays audit reference when provided", async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "valid",
        auditRef: "AUDIT-2024-001",
        issuer: "Test Issuer",
      }),
    })

    render(<VerifyPage />)

    const credentialInput = screen.getByLabelText("Credential ID *")
    const submitButton = screen.getByRole("button", { name: /Check Status/i })

    fireEvent.change(credentialInput, { target: { value: "CRED-12345" } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText("Audit ref: AUDIT-2024-001")).toBeInTheDocument()
    })
  })

  it("has proper accessibility attributes", () => {
    render(<VerifyPage />)

    expect(screen.getByLabelText("Credential ID *")).toHaveAttribute("required")
    expect(screen.getByRole("button", { name: /Verify Presentation/i })).toHaveAttribute("disabled")
    expect(screen.getByRole("combobox")).toHaveAccessibleName("Privacy Mode")
  })

  it("handles network errors gracefully", async () => {
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error("Network error"))

    render(<VerifyPage />)

    const credentialInput = screen.getByLabelText("Credential ID *")
    const submitButton = screen.getByRole("button", { name: /Check Status/i })

    fireEvent.change(credentialInput, { target: { value: "CRED-12345" } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText(/Network error/)).toBeInTheDocument()
    })
  })
})
