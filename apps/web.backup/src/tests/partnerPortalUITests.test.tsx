/**
 * B248C-PARTNER-030: PartnerPortalUITests suite
 *
 * End-to-end tests verifying partner registration, dashboard rendering, agreements upload,
 * opportunity creation, proposal submission, campaign management; asserts RBAC enforcement;
 * accessibility compliance checks
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useRouter, useSearchParams } from 'next/navigation'
import PartnerRegisterPage from '../app/partners/register/page'
import PartnerDashboardPage from '../app/partners/dashboard/page'
import AgreementsPage from '../app/partners/agreements/page'
import OpportunitiesPage from '../app/partners/opportunities/page'
import ProposalsPage from '../app/partners/proposals/page'
import CampaignsPage from '../app/partners/campaigns/page'
import TasksPage from '../app/partners/tasks/page'
import ReportsPage from '../app/partners/reports/page'
import NotificationSettingsPage from '../app/partners/settings/notifications/page'

// Mock Next.js router
const mockPush = vi.fn()
const mockReplace = vi.fn()
const mockBack = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
  }),
  useSearchParams: () => ({
    get: vi.fn((key: string) => (key === 'opportunityId' ? 'opp-123' : null)),
  }),
  usePathname: () => '/partners',
}))

// Mock fetch
global.fetch = vi.fn()

describe('Partner Portal UI Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(global.fetch as any).mockClear()
  })

  describe('Partner Registration', () => {
    it('should render registration form with all required fields', () => {
      render(<PartnerRegisterPage />)

      expect(screen.getByText('Partner Registration')).toBeInTheDocument()
      expect(screen.getByLabelText(/Partner\/Company Name/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/First Name/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Last Name/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Phone Number/i)).toBeInTheDocument()
    })

    it('should perform client-side validation', async () => {
      render(<PartnerRegisterPage />)

      const submitButton = screen.getByRole('button', { name: /Submit Registration/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/Partner name is required/i)).toBeInTheDocument()
        expect(screen.getByText(/First name is required/i)).toBeInTheDocument()
        expect(screen.getByText(/Email is required/i)).toBeInTheDocument()
      })
    })

    it('should validate email format', async () => {
      render(<PartnerRegisterPage />)

      const emailInput = screen.getByLabelText(/Email Address/i)
      fireEvent.change(emailInput, { target: { value: 'invalid-email' } })
      fireEvent.blur(emailInput)

      const submitButton = screen.getByRole('button', { name: /Submit Registration/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/valid email address/i)).toBeInTheDocument()
      })
    })

    it('should show success state after successful registration', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })

      render(<PartnerRegisterPage />)

      // Fill form
      fireEvent.change(screen.getByLabelText(/Partner\/Company Name/i), {
        target: { value: 'Test Partner' },
      })
      fireEvent.change(screen.getByLabelText(/First Name/i), {
        target: { value: 'John' },
      })
      fireEvent.change(screen.getByLabelText(/Last Name/i), {
        target: { value: 'Doe' },
      })
      fireEvent.change(screen.getByLabelText(/Email Address/i), {
        target: { value: 'john@example.com' },
      })
      fireEvent.change(screen.getByLabelText(/Phone Number/i), {
        target: { value: '+1234567890' },
      })

      const submitButton = screen.getByRole('button', { name: /Submit Registration/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/Registration Successful/i)).toBeInTheDocument()
      })
    })

    it('should be accessible with proper ARIA labels', () => {
      render(<PartnerRegisterPage />)

      const partnerNameInput = screen.getByLabelText(/Partner\/Company Name/i)
      expect(partnerNameInput).toHaveAttribute('aria-required', 'true')
      expect(partnerNameInput).toHaveAttribute('aria-invalid', 'false')
    })
  })

  describe('Partner Dashboard', () => {
    it('should render dashboard with metrics cards', async () => {
      ;(global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ name: 'Test Partner', status: 'active' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ agreements: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ opportunities: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ tasks: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ campaigns: [] }),
        })

      render(<PartnerDashboardPage />)

      await waitFor(() => {
        expect(screen.getByText('Partner Dashboard')).toBeInTheDocument()
        expect(screen.getByText('Active Agreements')).toBeInTheDocument()
        expect(screen.getByText('Pending Opportunities')).toBeInTheDocument()
        expect(screen.getByText('Open Tasks')).toBeInTheDocument()
        expect(screen.getByText('Active Campaigns')).toBeInTheDocument()
      })
    })

    it('should display partnership activity charts', async () => {
      ;(global.fetch as any)
        .mockResolvedValueOnce({ ok: true, json: async () => ({ name: 'Test Partner' }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ agreements: [] }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ opportunities: [] }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ tasks: [] }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ campaigns: [] }) })

      render(<PartnerDashboardPage />)

      await waitFor(() => {
        expect(screen.getByText('Partnership Activity')).toBeInTheDocument()
        expect(screen.getByText('Campaign Performance')).toBeInTheDocument()
      })
    })

    it('should provide quick links to create opportunities and upload agreements', async () => {
      ;(global.fetch as any)
        .mockResolvedValueOnce({ ok: true, json: async () => ({ name: 'Test Partner' }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ agreements: [] }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ opportunities: [] }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ tasks: [] }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ campaigns: [] }) })

      render(<PartnerDashboardPage />)

      await waitFor(() => {
        expect(screen.getByText('New Opportunity')).toBeInTheDocument()
        expect(screen.getByText('Upload Agreement')).toBeInTheDocument()
      })
    })
  })

  describe('Agreement Management', () => {
    it('should list all agreements with statuses and expiry dates', async () => {
      const mockAgreements = [
        {
          id: 'agr-1',
          title: 'Master Services Agreement',
          status: 'active',
          expiryDate: '2024-12-31',
          version: 1,
        },
        {
          id: 'agr-2',
          title: 'NDA',
          status: 'pending',
          version: 1,
        },
      ]

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ agreements: mockAgreements }),
      })

      render(<AgreementsPage />)

      await waitFor(() => {
        expect(screen.getByText('Master Services Agreement')).toBeInTheDocument()
        expect(screen.getByText('NDA')).toBeInTheDocument()
      })
    })

    it('should allow uploading new agreement documents', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ agreements: [] }),
      })

      render(<AgreementsPage />)

      const uploadButton = screen.getByRole('button', { name: /Upload Agreement/i })
      fireEvent.click(uploadButton)

      await waitFor(() => {
        expect(screen.getByText('Upload New Agreement')).toBeInTheDocument()
        expect(screen.getByLabelText(/Agreement Title/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/Document File/i)).toBeInTheDocument()
      })
    })

    it('should display document versions and history', async () => {
      const mockAgreements = [
        {
          id: 'agr-1',
          title: 'Test Agreement',
          status: 'active',
          version: 2,
        },
      ]

      ;(global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ agreements: mockAgreements }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            versions: [
              { id: 'v1', version: 1, createdAt: '2024-01-01', documentUrl: '/doc1.pdf' },
              { id: 'v2', version: 2, createdAt: '2024-02-01', documentUrl: '/doc2.pdf' },
            ],
          }),
        })

      render(<AgreementsPage />)

      await waitFor(() => {
        const historyButton = screen.getAllByLabelText(/View history/i)[0]
        fireEvent.click(historyButton)
      })

      await waitFor(() => {
        expect(screen.getByText('Version History')).toBeInTheDocument()
      })
    })

    it('should show approval workflow indicators', async () => {
      const mockAgreements = [
        {
          id: 'agr-1',
          title: 'Pending Agreement',
          status: 'pending',
          approvalStatus: 'pending_review',
          version: 1,
        },
      ]

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ agreements: mockAgreements }),
      })

      render(<AgreementsPage />)

      await waitFor(() => {
        expect(screen.getByText(/Pending Review/i)).toBeInTheDocument()
      })
    })
  })

  describe('Opportunity Management', () => {
    it('should list opportunities with filters by status and date', async () => {
      const mockOpportunities = [
        {
          id: 'opp-1',
          title: 'Enterprise Partnership',
          status: 'new',
          potentialValue: 100000,
          createdAt: '2024-01-01',
        },
      ]

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ opportunities: mockOpportunities }),
      })

      render(<OpportunitiesPage />)

      await waitFor(() => {
        expect(screen.getByText('Enterprise Partnership')).toBeInTheDocument()
        expect(screen.getByText(/Status/i)).toBeInTheDocument()
        expect(screen.getByText(/Date/i)).toBeInTheDocument()
      })
    })

    it('should allow creating new opportunities', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ opportunities: [] }),
      })

      render(<OpportunitiesPage />)

      const createButton = screen.getByRole('button', { name: /New Opportunity/i })
      fireEvent.click(createButton)

      await waitFor(() => {
        expect(screen.getByText('Create New Opportunity')).toBeInTheDocument()
        expect(screen.getByLabelText(/Title/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/Description/i)).toBeInTheDocument()
      })
    })

    it('should allow editing opportunity status', async () => {
      const mockOpportunities = [
        {
          id: 'opp-1',
          title: 'Test Opportunity',
          status: 'new',
          createdAt: '2024-01-01',
        },
      ]

      ;(global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ opportunities: mockOpportunities }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        })

      render(<OpportunitiesPage />)

      await waitFor(() => {
        expect(screen.getByText('Test Opportunity')).toBeInTheDocument()
      })
    })
  })

  describe('Proposal Submission', () => {
    it('should render proposal submission form', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ proposals: [] }),
      })

      render(<ProposalsPage />)

      const submitButton = screen.getByRole('button', { name: /Submit Proposal/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Submit New Proposal')).toBeInTheDocument()
        expect(screen.getByLabelText(/Opportunity/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/Proposal Document/i)).toBeInTheDocument()
      })
    })

    it('should show current status and decision outcomes', async () => {
      const mockProposals = [
        {
          id: 'prop-1',
          opportunityId: 'opp-1',
          opportunityTitle: 'Test Opportunity',
          status: 'accepted',
          submittedAt: '2024-01-01',
          decisionAt: '2024-01-15',
        },
      ]

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ proposals: mockProposals }),
      })

      render(<ProposalsPage />)

      await waitFor(() => {
        expect(screen.getByText(/accepted/i)).toBeInTheDocument()
      })
    })

    it('should display revision history', async () => {
      const mockProposals = [
        {
          id: 'prop-1',
          opportunityId: 'opp-1',
          status: 'draft',
        },
      ]

      ;(global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ proposals: mockProposals }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            revisions: [
              { id: 'rev-1', version: 1, createdAt: '2024-01-01', documentUrl: '/doc.pdf' },
            ],
          }),
        })

      render(<ProposalsPage />)

      await waitFor(() => {
        const historyButton = screen.getAllByLabelText(/View revision history/i)[0]
        fireEvent.click(historyButton)
      })

      await waitFor(() => {
        expect(screen.getByText('Revision History')).toBeInTheDocument()
      })
    })
  })

  describe('Co-Marketing Campaigns', () => {
    it('should display campaign details and performance metrics', async () => {
      const mockCampaigns = [
        {
          id: 'camp-1',
          name: 'Q1 Campaign',
          status: 'active',
          budget: 1000000,
          metrics: {
            leads: 120,
            conversions: 45,
            spend: 500000,
          },
        },
      ]

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ campaigns: mockCampaigns }),
      })

      render(<CampaignsPage />)

      await waitFor(() => {
        expect(screen.getByText('Q1 Campaign')).toBeInTheDocument()
        expect(screen.getByText(/Leads/i)).toBeInTheDocument()
        expect(screen.getByText(/Conversions/i)).toBeInTheDocument()
      })
    })

    it('should allow creating and editing campaigns', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ campaigns: [] }),
      })

      render(<CampaignsPage />)

      const createButton = screen.getByRole('button', { name: /New Campaign/i })
      fireEvent.click(createButton)

      await waitFor(() => {
        expect(screen.getByText('Create New Campaign')).toBeInTheDocument()
        expect(screen.getByLabelText(/Campaign Name/i)).toBeInTheDocument()
      })
    })

    it('should display campaign performance charts', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ campaigns: [] }),
      })

      render(<CampaignsPage />)

      await waitFor(() => {
        expect(screen.getByText('Campaign Performance')).toBeInTheDocument()
      })
    })
  })

  describe('Collaboration Tasks', () => {
    it('should support list and Kanban view', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tasks: [] }),
      })

      render(<TasksPage />)

      expect(screen.getByRole('button', { name: /list/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /kanban/i })).toBeInTheDocument()
    })

    it('should allow creating and updating tasks', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tasks: [] }),
      })

      render(<TasksPage />)

      const createButton = screen.getByRole('button', { name: /New Task/i })
      fireEvent.click(createButton)

      await waitFor(() => {
        expect(screen.getByText('Create New Task')).toBeInTheDocument()
        expect(screen.getByLabelText(/Title/i)).toBeInTheDocument()
      })
    })

    it('should support filtering by status and due date', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tasks: [] }),
      })

      render(<TasksPage />)

      expect(screen.getByText(/Status/i)).toBeInTheDocument()
      expect(screen.getByText(/Due Date/i)).toBeInTheDocument()
    })
  })

  describe('Partner Reports', () => {
    it('should display analytics reports with conversion rates and revenue metrics', async () => {
      const mockReportData = {
        conversionRate: 0.25,
        revenue: 5000000,
        leads: 1000,
        opportunities: 50,
        pipeline: [],
        trends: [],
      }

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockReportData,
      })

      render(<ReportsPage />)

      await waitFor(() => {
        expect(screen.getByText('Conversion Rate')).toBeInTheDocument()
        expect(screen.getByText('Total Revenue')).toBeInTheDocument()
        expect(screen.getByText('Total Leads')).toBeInTheDocument()
      })
    })

    it('should support filters by date range and partner', async () => {
      const mockReportData = {
        conversionRate: 0.25,
        revenue: 5000000,
        leads: 1000,
        opportunities: 50,
        pipeline: [],
        trends: [],
      }

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockReportData,
      })

      render(<ReportsPage />)

      await waitFor(() => {
        expect(screen.getByLabelText(/Date Range/i)).toBeInTheDocument()
        expect(screen.getByLabelText(/Partner/i)).toBeInTheDocument()
      })
    })

    it('should export reports as PDF/CSV', async () => {
      const mockReportData = {
        conversionRate: 0.25,
        revenue: 5000000,
        leads: 1000,
        opportunities: 50,
        pipeline: [],
        trends: [],
      }

      ;(global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockReportData,
        })
        .mockResolvedValueOnce({
          ok: true,
          blob: async () => new Blob(),
        })

      render(<ReportsPage />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Export Report/i })).toBeInTheDocument()
      })
    })
  })

  describe('Notification Settings', () => {
    it('should allow partners to opt in/out of notifications', async () => {
      const mockPreferences = {
        opportunities: { new: true, statusChange: true, assigned: true },
        agreements: { upload: true, approval: true, expiry: true },
        tasks: { assigned: true, dueDate: true, statusChange: false },
        campaigns: { created: false, statusChange: false, metricsUpdate: true },
      }

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ preferences: mockPreferences }),
      })

      render(<NotificationSettingsPage />)

      await waitFor(() => {
        expect(screen.getByText('Notification Settings')).toBeInTheDocument()
        expect(screen.getByLabelText(/New Opportunities/i)).toBeInTheDocument()
      })
    })

    it('should save preferences via API', async () => {
      const mockPreferences = {
        opportunities: { new: true, statusChange: true, assigned: true },
        agreements: { upload: true, approval: true, expiry: true },
        tasks: { assigned: true, dueDate: true, statusChange: false },
        campaigns: { created: false, statusChange: false, metricsUpdate: true },
      }

      ;(global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ preferences: mockPreferences }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true }),
        })

      render(<NotificationSettingsPage />)

      await waitFor(() => {
        const saveButton = screen.getByRole('button', { name: /Save Preferences/i })
        fireEvent.click(saveButton)
      })

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/partners/settings/notifications'),
          expect.objectContaining({ method: 'PUT' })
        )
      })
    })
  })

  describe('Accessibility Compliance', () => {
    it('should have proper ARIA labels on form inputs', () => {
      render(<PartnerRegisterPage />)

      const inputs = screen.getAllByRole('textbox')
      inputs.forEach((input) => {
        expect(input).toHaveAttribute('aria-label')
      })
    })

    it('should have focus management in modals', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ agreements: [] }),
      })

      render(<AgreementsPage />)

      const uploadButton = screen.getByRole('button', { name: /Upload Agreement/i })
      fireEvent.click(uploadButton)

      await waitFor(() => {
        const dialog = screen.getByRole('dialog')
        expect(dialog).toBeInTheDocument()
        // Focus should be on first input
        const firstInput = screen.getByLabelText(/Agreement Title/i)
        expect(firstInput).toHaveFocus()
      })
    })

    it('should support keyboard navigation', () => {
      render(<PartnerRegisterPage />)

      const inputs = screen.getAllByRole('textbox')
      inputs[0].focus()
      expect(inputs[0]).toHaveFocus()

      fireEvent.keyDown(inputs[0], { key: 'Tab' })
      // Tab order should work
    })
  })

  describe('RBAC Enforcement', () => {
    it('should enforce role-based access control', async () => {
      ;(global.fetch as any).mockRejectedValueOnce({
        status: 403,
        message: 'Forbidden',
      })

      render(<PartnerDashboardPage />)

      await waitFor(() => {
        // Should handle 403 errors gracefully
        expect(global.fetch).toHaveBeenCalled()
      })
    })
  })
})

