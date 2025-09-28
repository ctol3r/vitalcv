import { render, screen, fireEvent } from "@testing-library/react"
import { SupportFAQ } from "@/components/SupportFAQ"

describe("SupportFAQ", () => {
  it("renders FAQ questions", () => {
    render(<SupportFAQ />)

    expect(screen.getByText("How do I verify a credential?")).toBeInTheDocument()
    expect(screen.getByText("What types of credentials can be verified?")).toBeInTheDocument()
    expect(screen.getByText("How secure is the verification process?")).toBeInTheDocument()
    expect(screen.getByText("What happens if a credential is revoked?")).toBeInTheDocument()
  })

  it("expands FAQ item when clicked", () => {
    render(<SupportFAQ />)

    const firstQuestion = screen.getByText("How do I verify a credential?")
    fireEvent.click(firstQuestion)

    expect(screen.getByText(/To verify a credential, navigate to the Verify page/)).toBeInTheDocument()
  })

  it("shows all FAQ items", () => {
    render(<SupportFAQ />)

    const questions = screen.getAllByRole("button")
    expect(questions).toHaveLength(4)
  })

  it("collapses FAQ item when clicked again", () => {
    render(<SupportFAQ />)

    const firstQuestion = screen.getByText("How do I verify a credential?")

    // Expand
    fireEvent.click(firstQuestion)
    expect(screen.getByText(/To verify a credential, navigate to the Verify page/)).toBeInTheDocument()

    // Collapse
    fireEvent.click(firstQuestion)
    expect(screen.queryByText(/To verify a credential, navigate to the Verify page/)).not.toBeInTheDocument()
  })

  it("shows security information in FAQ", () => {
    render(<SupportFAQ />)

    const securityQuestion = screen.getByText("How secure is the verification process?")
    fireEvent.click(securityQuestion)

    expect(screen.getByText(/VitalCV uses industry-standard cryptographic methods/)).toBeInTheDocument()
  })

  it("explains revocation process", () => {
    render(<SupportFAQ />)

    const revocationQuestion = screen.getByText("What happens if a credential is revoked?")
    fireEvent.click(revocationQuestion)

    expect(screen.getByText(/When a credential is revoked/)).toBeInTheDocument()
  })
})
