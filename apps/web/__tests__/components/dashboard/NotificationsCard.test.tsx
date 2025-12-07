import { render, screen, fireEvent } from "@testing-library/react"
import { NotificationsCard } from "@/components/dashboard/NotificationsCard"
import jest from "jest"

describe("NotificationsCard", () => {
  const mockNotifications = [
    {
      id: 1,
      type: "warning" as const,
      message: "Nevada medical license expires in 45 days",
      timestamp: "2 hours ago",
      actionRequired: true,
    },
    {
      id: 2,
      type: "update" as const,
      message: "Updated information detected in NPPES registry",
      timestamp: "1 day ago",
      actionRequired: true,
    },
    {
      id: 3,
      type: "info" as const,
      message: "Profile verification completed successfully",
      timestamp: "3 days ago",
      actionRequired: false,
    },
  ]

  const mockOnReview = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders notifications correctly", () => {
    render(<NotificationsCard notifications={mockNotifications} onReview={mockOnReview} />)

    expect(screen.getByText("Notifications")).toBeInTheDocument()
    expect(screen.getByText("Recent updates and alerts")).toBeInTheDocument()

    expect(screen.getByText("Nevada medical license expires in 45 days")).toBeInTheDocument()
    expect(screen.getByText("Updated information detected in NPPES registry")).toBeInTheDocument()
    expect(screen.getByText("Profile verification completed successfully")).toBeInTheDocument()
  })

  it("shows review buttons for notifications requiring action", () => {
    render(<NotificationsCard notifications={mockNotifications} onReview={mockOnReview} />)

    const reviewButtons = screen.getAllByText("Review")
    expect(reviewButtons).toHaveLength(2)
  })

  it("handles review button clicks", () => {
    render(<NotificationsCard notifications={mockNotifications} onReview={mockOnReview} />)

    const reviewButtons = screen.getAllByText("Review")
    fireEvent.click(reviewButtons[0])

    expect(mockOnReview).toHaveBeenCalledWith(1)
  })

  it("displays empty state when no notifications", () => {
    render(<NotificationsCard notifications={[]} onReview={mockOnReview} />)

    expect(screen.getByText("No notifications")).toBeInTheDocument()
  })

  it("displays timestamps correctly", () => {
    render(<NotificationsCard notifications={mockNotifications} onReview={mockOnReview} />)

    expect(screen.getByText("2 hours ago")).toBeInTheDocument()
    expect(screen.getByText("1 day ago")).toBeInTheDocument()
    expect(screen.getByText("3 days ago")).toBeInTheDocument()
  })

  it("formats ISO timestamps correctly", () => {
    const isoTimestamp = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() // 2 hours ago
    const notificationWithIsoTimestamp = [
      {
        id: 4,
        type: "info" as const,
        message: "Test notification with ISO timestamp",
        timestamp: isoTimestamp,
        actionRequired: false,
      },
    ]

    render(<NotificationsCard notifications={notificationWithIsoTimestamp} onReview={mockOnReview} />)
    expect(screen.getByText("2 hours ago")).toBeInTheDocument()
  })

  it("displays correct icons for different notification types", () => {
    render(<NotificationsCard notifications={mockNotifications} onReview={mockOnReview} />)

    // Check that different notification types are rendered
    expect(screen.getByText("Nevada medical license expires in 45 days")).toBeInTheDocument()
    expect(screen.getByText("Updated information detected in NPPES registry")).toBeInTheDocument()
    expect(screen.getByText("Profile verification completed successfully")).toBeInTheDocument()
  })

  it("handles notifications without onReview callback", () => {
    render(<NotificationsCard notifications={mockNotifications} />)

    const reviewButtons = screen.getAllByText("Review")
    fireEvent.click(reviewButtons[0])

    // Should not throw error when onReview is undefined
    expect(reviewButtons[0]).toBeInTheDocument()
  })

  it("handles long notification messages properly", () => {
    const longMessageNotification = [
      {
        id: 5,
        type: "warning" as const,
        message:
          "This is a very long notification message that should wrap properly and maintain good readability across different screen sizes and device types",
        timestamp: "1 hour ago",
        actionRequired: true,
      },
    ]

    render(<NotificationsCard notifications={longMessageNotification} onReview={mockOnReview} />)
    expect(screen.getByText(/This is a very long notification message/)).toBeInTheDocument()
  })
})
