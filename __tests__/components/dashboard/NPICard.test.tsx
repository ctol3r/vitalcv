import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { NPICard } from "@/components/dashboard/NPICard"
import { useToast } from "@/hooks/use-toast"
import jest from "jest" // Declaring jest variable

jest.mock("@/hooks/use-toast")
const mockToast = jest.fn()
;(useToast as jest.Mock).mockReturnValue({ toast: mockToast })

describe("NPICard", () => {
  const mockProps = {
    npi: "1234567890",
    name: "Dr. Sarah Johnson",
    credentials: "MD",
    status: "Active",
    lastSynced: "2024-01-15T10:30:00Z",
    verified: true,
    onSync: jest.fn().mockResolvedValue(undefined),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders NPI information correctly", () => {
    render(<NPICard {...mockProps} />)

    expect(screen.getByText("NPI Information")).toBeInTheDocument()
    expect(screen.getByText("National Provider Identifier")).toBeInTheDocument()
    expect(screen.getByText("1234567890")).toBeInTheDocument()
    expect(screen.getByText("Dr. Sarah Johnson")).toBeInTheDocument()
    expect(screen.getByText("MD")).toBeInTheDocument()
    expect(screen.getByText("Active")).toBeInTheDocument()
    expect(screen.getByText("Verified via NPPES")).toBeInTheDocument()
  })

  it("shows unverified status when not verified", () => {
    render(<NPICard {...mockProps} verified={false} />)
    expect(screen.getByText("Unverified")).toBeInTheDocument()
  })

  it("handles sync functionality", async () => {
    render(<NPICard {...mockProps} />)

    const syncButton = screen.getByText("Sync Now")
    fireEvent.click(syncButton)

    expect(screen.getByText("Syncing...")).toBeInTheDocument()
    expect(mockProps.onSync).toHaveBeenCalled()

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: "Sync Complete",
        description: "NPI data has been updated successfully",
      })
    })
  })

  it("handles sync errors", async () => {
    const failingOnSync = jest.fn().mockRejectedValue(new Error("Sync failed"))
    render(<NPICard {...mockProps} onSync={failingOnSync} />)

    const syncButton = screen.getByText("Sync Now")
    fireEvent.click(syncButton)

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: "Sync Failed",
        description: "Unable to sync NPI data. Please try again.",
        variant: "destructive",
      })
    })
  })

  it("formats last synced time correctly", () => {
    render(<NPICard {...mockProps} lastSynced={undefined} />)
    expect(screen.getByText("Last synced: Never")).toBeInTheDocument()
  })

  it("disables sync button while syncing", async () => {
    render(<NPICard {...mockProps} />)

    const syncButton = screen.getByText("Sync Now")
    fireEvent.click(syncButton)

    expect(syncButton).toBeDisabled()
    expect(screen.getByText("Syncing...")).toBeInTheDocument()
  })

  it("has proper accessibility attributes", () => {
    render(<NPICard {...mockProps} />)

    const syncButton = screen.getByRole("button", { name: /sync now/i })
    expect(syncButton).toBeInTheDocument()
    expect(syncButton).toHaveAttribute("type", "button")
  })

  it("handles long names gracefully with truncation", () => {
    const longNameProps = {
      ...mockProps,
      name: "Dr. Very Long Name That Should Be Truncated Properly",
    }
    render(<NPICard {...longNameProps} />)

    expect(screen.getByText("Dr. Very Long Name That Should Be Truncated Properly")).toBeInTheDocument()
  })

  it("formats recent sync times correctly", () => {
    const recentTime = new Date(Date.now() - 30 * 60 * 1000).toISOString() // 30 minutes ago
    render(<NPICard {...mockProps} lastSynced={recentTime} />)

    expect(screen.getByText("Last synced: Just now")).toBeInTheDocument()
  })
})
