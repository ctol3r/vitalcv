import { AnalyticsCard } from '@/components/dashboard/AnalyticsCard';
import type { Meta, StoryObj } from '@storybook/react';

const meta: Meta<typeof AnalyticsCard> = {
  title: 'Components/AnalyticsCard',
  component: AnalyticsCard,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Dashboard analytics card showing credential activity statistics and trends.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Default analytics card
export const Default: Story = {
  args: {},
};

// With mock data (this would normally come from the event cache)
export const WithMockData: Story = {
  render: () => {
    // Mock the event cache functions for Storybook
    const originalGetAllEvents = require('@/lib/event-cache').getAllEvents;
    const originalGetRecentEvents = require('@/lib/event-cache').getRecentEvents;

    // Mock implementation
    require('@/lib/event-cache').getAllEvents = () => [
      { type: 'issued', timestamp: '2024-01-15T10:00:00Z', credentialId: 'CRED-001' },
      { type: 'issued', timestamp: '2024-01-16T10:00:00Z', credentialId: 'CRED-002' },
      { type: 'verified', timestamp: '2024-01-16T11:00:00Z', credentialId: 'CRED-001' },
      { type: 'verified', timestamp: '2024-01-17T10:00:00Z', credentialId: 'CRED-002' },
      { type: 'verified', timestamp: '2024-01-17T11:00:00Z', credentialId: 'CRED-003' },
      { type: 'revoked', timestamp: '2024-01-18T10:00:00Z', credentialId: 'CRED-001' },
    ];

    require('@/lib/event-cache').getRecentEvents = () => [
      {
        type: 'issued',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        credentialId: 'CRED-004',
      },
      {
        type: 'verified',
        timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
        credentialId: 'CRED-004',
      },
      {
        type: 'verified',
        timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        credentialId: 'CRED-005',
      },
    ];

    return <AnalyticsCard />;
  },
};

// Empty state
export const EmptyState: Story = {
  render: () => {
    // Mock empty data
    const originalGetAllEvents = require('@/lib/event-cache').getAllEvents;
    const originalGetRecentEvents = require('@/lib/event-cache').getRecentEvents;

    require('@/lib/event-cache').getAllEvents = () => [];
    require('@/lib/event-cache').getRecentEvents = () => [];

    return <AnalyticsCard />;
  },
};

// High activity state
export const HighActivity: Story = {
  render: () => {
    // Mock high activity data
    const originalGetAllEvents = require('@/lib/event-cache').getAllEvents;
    const originalGetRecentEvents = require('@/lib/event-cache').getRecentEvents;

    const allEvents = Array.from({ length: 50 }, (_, i) => ({
      type: ['issued', 'verified', 'revoked'][i % 3] as 'issued' | 'verified' | 'revoked',
      timestamp: new Date(Date.now() - i * 60 * 60 * 1000).toISOString(),
      credentialId: `CRED-${String(i).padStart(3, '0')}`,
    }));

    const recentEvents = allEvents.slice(0, 15);

    require('@/lib/event-cache').getAllEvents = () => allEvents;
    require('@/lib/event-cache').getRecentEvents = () => recentEvents;

    return <AnalyticsCard />;
  },
};

// In dashboard context
export const InDashboard: Story = {
  render: () => (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg border shadow">
          <h3 className="text-lg font-semibold mb-4">NPI Information</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">NPI:</span>
              <span className="font-mono">1234567890</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Status:</span>
              <span className="text-green-600">Active</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border shadow">
          <h3 className="text-lg font-semibold mb-4">Licenses</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">CA Medical:</span>
              <span className="text-green-600">Active</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">DEA:</span>
              <span className="text-green-600">Active</span>
            </div>
          </div>
        </div>

        <AnalyticsCard />
      </div>
    </div>
  ),
  parameters: {
    layout: 'padded',
  },
};
