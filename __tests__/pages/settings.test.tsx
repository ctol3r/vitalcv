import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { useTheme } from "next-themes"
import SettingsPage from "@/app/settings/page"
import { toast } from "@/hooks/use-toast"
import jest from "jest" // Import jest to fix the undeclared variable error

// Mock next-themes
jest.mock("next-themes", () => ({
  useTheme: jest.fn(),
}))

// Mock toast
jest.mock("@/hooks/use-toast", () => ({
  toast: jest.fn(),
}))

const mockUseTheme = useTheme as jest.MockedFunction<typeof useTheme>
const mockToast = toast as jest.MockedFunction<typeof toast>

describe("SettingsPage", () => {
  const mockSetTheme = jest.fn()

  beforeEach(() => {
    mockUseTheme.mockReturnValue({
      theme: "light",
      setTheme: mockSetTheme,
      themes: ["light", "dark", "hims", "palantir", "neon", "glass"],
      systemTheme: "light",
      resolvedTheme: "light",
    })
    jest.clearAllMocks()
  })

  describe("Account Tab", () => {
    it("renders account information correctly", () => {
      render(<SettingsPage />)

      expect(screen.getByDisplayValue("dr.smith@vitalcv.com")).toBeInTheDocument()
      expect(screen.getByDisplayValue("dr.smith@vitalcv.com")).toBeDisabled()
    })

    it("handles password change form submission", async () => {
      render(<SettingsPage />)

      // Fill out password form
      fireEvent.change(screen.getByLabelText(/current password/i), {
        target: { value: "oldpassword" },
      })
      fireEvent.change(screen.getByLabelText(/new password/i), {
        target: { value: "newpassword123" },
      })
      fireEvent.change(screen.getByLabelText(/confirm new password/i), {
        target: { value: "newpassword123" },
      })

      // Submit form
      fireEvent.click(screen.getByRole("button", { name: /change password/i }))

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "Success",
          description: "Password changed successfully",
        })
      })
    })

    it("validates password confirmation", async () => {
      render(<SettingsPage />)

      fireEvent.change(screen.getByLabelText(/current password/i), {
        target: { value: "oldpassword" },
      })
      fireEvent.change(screen.getByLabelText(/new password/i), {
        target: { value: "newpassword123" },
      })
      fireEvent.change(screen.getByLabelText(/confirm new password/i), {
        target: { value: "differentpassword" },
      })

      fireEvent.click(screen.getByRole("button", { name: /change password/i }))

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "Error",
          description: "New passwords do not match",
          variant: "destructive",
        })
      })
    })

    it("validates password length", async () => {
      render(<SettingsPage />)

      fireEvent.change(screen.getByLabelText(/current password/i), {
        target: { value: "oldpassword" },
      })
      fireEvent.change(screen.getByLabelText(/new password/i), {
        target: { value: "short" },
      })
      fireEvent.change(screen.getByLabelText(/confirm new password/i), {
        target: { value: "short" },
      })

      fireEvent.click(screen.getByRole("button", { name: /change password/i }))

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "Error",
          description: "Password must be at least 8 characters long",
          variant: "destructive",
        })
      })
    })

    it("toggles password visibility", () => {
      render(<SettingsPage />)

      const passwordInput = screen.getByLabelText(/current password/i)
      const toggleButton = screen.getByRole("button", { name: "" }) // Eye icon button

      expect(passwordInput).toHaveAttribute("type", "password")

      fireEvent.click(toggleButton)
      expect(passwordInput).toHaveAttribute("type", "text")

      fireEvent.click(toggleButton)
      expect(passwordInput).toHaveAttribute("type", "password")
    })
  })

  describe("Security Tab", () => {
    it("renders security settings", () => {
      render(<SettingsPage />)

      fireEvent.click(screen.getByRole("tab", { name: /security/i }))

      expect(screen.getByText(/two-factor authentication/i)).toBeInTheDocument()
      expect(screen.getByText(/active sessions/i)).toBeInTheDocument()
    })

    it("toggles 2FA setting", () => {
      render(<SettingsPage />)

      fireEvent.click(screen.getByRole("tab", { name: /security/i }))

      const twoFactorSwitch = screen.getByRole("switch", { name: /enable 2fa/i })
      expect(twoFactorSwitch).not.toBeChecked()

      fireEvent.click(twoFactorSwitch)
      expect(twoFactorSwitch).toBeChecked()
    })

    it("displays active sessions", () => {
      render(<SettingsPage />)

      fireEvent.click(screen.getByRole("tab", { name: /security/i }))

      expect(screen.getByText("MacBook Pro")).toBeInTheDocument()
      expect(screen.getByText("iPhone 15 Pro")).toBeInTheDocument()
      expect(screen.getByText("Chrome on Windows")).toBeInTheDocument()
      expect(screen.getByText("Current")).toBeInTheDocument()
    })

    it("handles session revocation", async () => {
      render(<SettingsPage />)

      fireEvent.click(screen.getByRole("tab", { name: /security/i }))

      const revokeButtons = screen.getAllByText("Revoke")
      fireEvent.click(revokeButtons[0])

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: "Session Revoked",
          description: "The selected session has been terminated",
        })
      })
    })
  })

  describe("Appearance Tab", () => {
    it("renders theme selection", () => {
      render(<SettingsPage />)

      fireEvent.click(screen.getByRole("tab", { name: /appearance/i }))

      expect(screen.getByText(/theme selection/i)).toBeInTheDocument()
      expect(screen.getByText(/theme preview/i)).toBeInTheDocument()
    })

    it("changes theme and shows toast", async () => {
      render(<SettingsPage />)

      fireEvent.click(screen.getByRole("tab", { name: /appearance/i }))

      // Open theme selector
      fireEvent.click(screen.getByRole("combobox"))

      // Select dark theme
      fireEvent.click(screen.getByText("Dark"))

      await waitFor(() => {
        expect(mockSetTheme).toHaveBeenCalledWith("dark")
        expect(mockToast).toHaveBeenCalledWith({
          title: "Theme Updated",
          description: "Switched to Dark theme",
        })
      })
    })

    it("displays theme preview cards", () => {
      render(<SettingsPage />)

      fireEvent.click(screen.getByRole("tab", { name: /appearance/i }))

      expect(screen.getByText("Sample Card")).toBeInTheDocument()
      expect(screen.getByText("Muted Card")).toBeInTheDocument()
      expect(screen.getByText("Primary")).toBeInTheDocument()
      expect(screen.getByText("Secondary")).toBeInTheDocument()
    })

    it("shows current theme information", () => {
      render(<SettingsPage />)

      fireEvent.click(screen.getByRole("tab", { name: /appearance/i }))

      expect(screen.getByText(/current theme:/i)).toBeInTheDocument()
      expect(screen.getByText(/light/i)).toBeInTheDocument()
    })
  })

  describe("Tab Navigation", () => {
    it("switches between tabs correctly", () => {
      render(<SettingsPage />)

      // Default to account tab
      expect(screen.getByDisplayValue("dr.smith@vitalcv.com")).toBeInTheDocument()

      // Switch to security tab
      fireEvent.click(screen.getByRole("tab", { name: /security/i }))
      expect(screen.getByText(/two-factor authentication/i)).toBeInTheDocument()

      // Switch to appearance tab
      fireEvent.click(screen.getByRole("tab", { name: /appearance/i }))
      expect(screen.getByText(/theme selection/i)).toBeInTheDocument()

      // Switch back to account tab
      fireEvent.click(screen.getByRole("tab", { name: /account/i }))
      expect(screen.getByDisplayValue("dr.smith@vitalcv.com")).toBeInTheDocument()
    })
  })

  describe("Accessibility", () => {
    it("has proper ARIA labels and roles", () => {
      render(<SettingsPage />)

      expect(screen.getByRole("tablist")).toBeInTheDocument()
      expect(screen.getAllByRole("tab")).toHaveLength(3)
      expect(screen.getByRole("tabpanel")).toBeInTheDocument()
    })

    it("supports keyboard navigation", () => {
      render(<SettingsPage />)

      const accountTab = screen.getByRole("tab", { name: /account/i })
      const securityTab = screen.getByRole("tab", { name: /security/i })

      accountTab.focus()
      expect(document.activeElement).toBe(accountTab)

      fireEvent.keyDown(accountTab, { key: "ArrowRight" })
      expect(document.activeElement).toBe(securityTab)
    })
  })
})
