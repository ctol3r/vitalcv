import { render, screen } from "@testing-library/react"
import { Field, InputField, TextareaField } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

describe("Field Components", () => {
  describe("Field", () => {
    it("renders label correctly", () => {
      render(
        <Field label="Username">
          <Input />
        </Field>,
      )

      expect(screen.getByText("Username")).toBeInTheDocument()
    })

    it("shows required indicator", () => {
      render(
        <Field label="Email" required>
          <Input />
        </Field>,
      )

      expect(screen.getByText("*")).toBeInTheDocument()
    })

    it("displays error message", () => {
      render(
        <Field label="Password" error="Password is required">
          <Input />
        </Field>,
      )

      expect(screen.getByText("Password is required")).toBeInTheDocument()
    })

    it("displays description", () => {
      render(
        <Field label="Bio" description="Tell us about yourself">
          <Input />
        </Field>,
      )

      expect(screen.getByText("Tell us about yourself")).toBeInTheDocument()
    })

    it("prioritizes error over description", () => {
      render(
        <Field label="Field" description="This is a description" error="This is an error">
          <Input />
        </Field>,
      )

      expect(screen.getByText("This is an error")).toBeInTheDocument()
      expect(screen.queryByText("This is a description")).not.toBeInTheDocument()
    })

    it("applies error styling to input", () => {
      render(
        <Field label="Field" error="Error message">
          <Input data-testid="input" />
        </Field>,
      )

      const input = screen.getByTestId("input")
      expect(input).toHaveAttribute("aria-invalid", "true")
    })
  })

  describe("InputField", () => {
    it("renders input field with label", () => {
      render(<InputField label="Email" type="email" placeholder="Enter email" />)

      expect(screen.getByText("Email")).toBeInTheDocument()
      expect(screen.getByPlaceholderText("Enter email")).toBeInTheDocument()
    })

    it("handles different input types", () => {
      render(<InputField label="Password" type="password" />)

      const input = screen.getByLabelText("Password")
      expect(input).toHaveAttribute("type", "password")
    })

    it("shows error state", () => {
      render(<InputField label="Username" error="Username is taken" />)

      expect(screen.getByText("Username is taken")).toBeInTheDocument()
    })
  })

  describe("TextareaField", () => {
    it("renders textarea field with label", () => {
      render(<TextareaField label="Comments" placeholder="Enter comments" />)

      expect(screen.getByText("Comments")).toBeInTheDocument()
      expect(screen.getByPlaceholderText("Enter comments")).toBeInTheDocument()
    })

    it("shows required indicator", () => {
      render(<TextareaField label="Message" required />)

      expect(screen.getByText("*")).toBeInTheDocument()
    })

    it("displays description", () => {
      render(<TextareaField label="Bio" description="Maximum 500 characters" />)

      expect(screen.getByText("Maximum 500 characters")).toBeInTheDocument()
    })
  })
})
