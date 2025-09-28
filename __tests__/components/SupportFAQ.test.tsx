import { render, screen, fireEvent } from "@testing-library/react"
import { SupportFAQ } from "@/components/SupportFAQ"

describe("SupportFAQ", () => {
  it("renders FAQ questions", () => {
    render(<SupportFAQ />)

    expect(screen.getByText("How do I verify a credential?")).toBeInTheDocument()
    expect(screen.getByText("What types of credentials can be verified?")).toBeInTheDocument()
    expect(screen.getByText("How secure is the verification process?")).toBeInTheDocument()
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
})
