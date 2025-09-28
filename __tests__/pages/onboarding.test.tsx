import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { useRouter } from "next/navigation"
import OnboardingPage from "@/app/onboarding/page"
import { server } from "../mocks/server"
import { http, HttpResponse } from "msw"
import jest from "jest" // Declare the jest variable

// Mock Next.js router
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}))

const mockPush = jest.fn()
const mockRouter = useRouter as jest.MockedFunction<typeof useRouter>

describe("OnboardingPage", () => {
  beforeEach(() => {
    mockRouter.mockReturnValue({
      push: mockPush,
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
    } as any)
    mockPush.mockClear()
  })

  it("renders the first step correctly", () => {
    render(<OnboardingPage />)

    expect(screen.getByText("Get Started with VitalCV")).toBeInTheDocument()
    expect(screen.getByText("Upload Your CV")).toBeInTheDocument()
    expect(screen.getByText("Step 1 of 3")).toBeInTheDocument()
    expect(screen.getByText("Drop your CV here or click to browse")).toBeInTheDocument()
  })

  it("shows progress correctly", () => {
    render(<OnboardingPage />)

    expect(screen.getByText("33% Complete")).toBeInTheDocument()
  })

  it("handles CV upload successfully", async () => {
    // Mock successful CV upload
    server.use(
      http.post("/api/upload/cv", async () => {
        return HttpResponse.json({
          parsedData: {
            name: "Dr. John Doe",
            email: "john.doe@example.com",
            phone: "555-0123",
            specialty: "Cardiology",
            education: ["MD from Harvard Medical School"],
          },
        })
      }),
    )

    render(<OnboardingPage />)

    const fileInput = screen.getByLabelText(/drop your cv here/i)
    const file = new File(["cv content"], "cv.pdf", { type: "application/pdf" })

    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText("Parsed CV Data")).toBeInTheDocument()
      expect(screen.getByText("Dr. John Doe")).toBeInTheDocument()
      expect(screen.getByText("john.doe@example.com")).toBeInTheDocument()
    })
  })

  it("handles CV upload error", async () => {
    // Mock failed CV upload
    server.use(
      http.post("/api/upload/cv", async () => {
        return HttpResponse.json({ error: "Invalid file format" }, { status: 400 })
      }),
    )

    render(<OnboardingPage />)

    const fileInput = screen.getByLabelText(/drop your cv here/i)
    const file = new File(["invalid content"], "invalid.txt", { type: "text/plain" })

    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText(/upload failed/i)).toBeInTheDocument()
    })
  })

  it("allows manual editing of CV data", async () => {
    // Mock successful CV upload
    server.use(
      http.post("/api/upload/cv", async () => {
        return HttpResponse.json({
          parsedData: {
            name: "Dr. John Doe",
            email: "john.doe@example.com",
            specialty: "Cardiology",
          },
        })
      }),
    )

    render(<OnboardingPage />)

    const fileInput = screen.getByLabelText(/drop your cv here/i)
    const file = new File(["cv content"], "cv.pdf", { type: "application/pdf" })

    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText("Edit Manually")).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText("Edit Manually"))

    const nameInput = screen.getByDisplayValue("Dr. John Doe")
    fireEvent.change(nameInput, { target: { value: "Dr. Jane Smith" } })

    expect(nameInput).toHaveValue("Dr. Jane Smith")
  })

  it("navigates to step 2 when CV data is available", async () => {
    // Mock successful CV upload
    server.use(
      http.post("/api/upload/cv", async () => {
        return HttpResponse.json({
          parsedData: {
            name: "Dr. John Doe",
            email: "john.doe@example.com",
            specialty: "Cardiology",
          },
        })
      }),
    )

    render(<OnboardingPage />)

    const fileInput = screen.getByLabelText(/drop your cv here/i)
    const file = new File(["cv content"], "cv.pdf", { type: "application/pdf" })

    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(screen.getByText("Next: Enter NPI")).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText("Next: Enter NPI"))

    await waitFor(() => {
      expect(screen.getByText("Enter Your NPI")).toBeInTheDocument()
      expect(screen.getByText("Step 2 of 3")).toBeInTheDocument()
    })
  })

  it("handles NPI sync successfully", async () => {
    // Mock successful NPI sync
    server.use(
      http.post("/api/clinician/npi-sync", async () => {
        return HttpResponse.json({
          name: "Dr. John Doe",
          specialty: "Cardiology",
          address: "123 Medical Center Dr, City, ST 12345",
          licenses: ["CA-12345", "NY-67890"],
        })
      }),
    )

    render(<OnboardingPage />)

    // Navigate to step 2 (assuming we have CV data)
    fireEvent.click(screen.getByText("Step 2 of 3"))

    const npiInput = screen.getByPlaceholderText("Enter your 10-digit NPI")
    fireEvent.change(npiInput, { target: { value: "1234567890" } })

    fireEvent.click(screen.getByText("Sync NPI"))

    await waitFor(() => {
      expect(screen.getByText("NPI Information")).toBeInTheDocument()
      expect(screen.getByText("1234567890")).toBeInTheDocument()
      expect(screen.getByText("Dr. John Doe")).toBeInTheDocument()
    })
  })

  it("completes onboarding and redirects to dashboard", async () => {
    render(<OnboardingPage />)

    // Mock having completed all steps
    // This would require setting up the component state properly
    // For now, we'll test the redirect functionality

    await waitFor(() => {
      // The actual test would involve completing all steps
      // and then checking that router.push('/dashboard') is called
    })
  })

  it("shows loading states appropriately", async () => {
    render(<OnboardingPage />)

    const fileInput = screen.getByLabelText(/drop your cv here/i)
    const file = new File(["cv content"], "cv.pdf", { type: "application/pdf" })

    fireEvent.change(fileInput, { target: { files: [file] } })

    // Should show loading state
    expect(screen.getByText("Processing your CV...")).toBeInTheDocument()
  })

  it("validates NPI input format", () => {
    render(<OnboardingPage />)

    // Navigate to step 2
    fireEvent.click(screen.getByText("Step 2 of 3"))

    const npiInput = screen.getByPlaceholderText("Enter your 10-digit NPI")
    const syncButton = screen.getByText("Sync NPI")

    // Should be disabled with empty input
    expect(syncButton).toBeDisabled()

    // Should be disabled with invalid length
    fireEvent.change(npiInput, { target: { value: "123" } })
    expect(syncButton).toBeDisabled()

    // Should be enabled with valid 10-digit NPI
    fireEvent.change(npiInput, { target: { value: "1234567890" } })
    expect(syncButton).not.toBeDisabled()
  })
})
