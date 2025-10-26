import { DarkModeToggle } from '@/components/DarkModeToggle';
import type { Meta, StoryObj } from '@storybook/react';

const meta: Meta<typeof DarkModeToggle> = {
  title: 'Components/DarkModeToggle',
  component: DarkModeToggle,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Dark mode toggle component with theme switching and localStorage persistence.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Default theme toggle
export const Default: Story = {
  args: {},
};

// In different contexts
export const InHeader: Story = {
  render: () => (
    <div className="flex items-center justify-between p-4 bg-white border rounded-lg">
      <div className="flex items-center space-x-2">
        <div className="w-8 h-8 bg-blue-600 rounded"></div>
        <span className="text-xl font-bold">VitalCV</span>
      </div>
      <nav className="flex items-center space-x-6">
        <a href="#" className="text-gray-600 hover:text-blue-600">
          Issuer
        </a>
        <a href="#" className="text-gray-600 hover:text-blue-600">
          Verify
        </a>
        <a href="#" className="text-gray-600 hover:text-blue-600">
          Wallet
        </a>
        <DarkModeToggle />
      </nav>
    </div>
  ),
  parameters: {
    layout: 'padded',
  },
};

// In sidebar
export const InSidebar: Story = {
  render: () => (
    <div className="w-64 bg-gray-50 border-r p-4 space-y-4">
      <div className="space-y-2">
        <h3 className="font-semibold text-gray-900">Settings</h3>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Theme</span>
          <DarkModeToggle />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Notifications</span>
          <div className="w-10 h-6 bg-blue-600 rounded-full"></div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Auto-sync</span>
          <div className="w-10 h-6 bg-gray-300 rounded-full"></div>
        </div>
      </div>
    </div>
  ),
  parameters: {
    layout: 'padded',
  },
};

// Compact version
export const Compact: Story = {
  render: () => (
    <div className="flex items-center space-x-2">
      <span className="text-sm text-gray-600">Theme:</span>
      <DarkModeToggle />
    </div>
  ),
};

// With label
export const WithLabel: Story = {
  render: () => (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">Appearance</label>
      <div className="flex items-center space-x-2">
        <DarkModeToggle />
        <span className="text-sm text-gray-500">Switch between light and dark themes</span>
      </div>
    </div>
  ),
};
