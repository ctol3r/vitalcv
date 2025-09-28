import { render, screen, fireEvent } from "@testing-library/react"
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

  it("shows loading state during verification", async () => {
    render(<VerifyPage />)

    const credentialInput = screen.getByLabelText("Credential ID *")
    const submitButton = screen.getByRole("button", { name: "Verify Credential" })

    fireEvent.change(credentialInput, { target: { value: "CRED-12345" } })
    fireEvent.click(submitButton)

    expect(screen.getByText("Verifying...")).toBeInTheDocument()
  })
})
