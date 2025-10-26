import { DashboardAnalytics } from '@/components/DashboardAnalytics';
import type { Meta, StoryObj } from '@storybook/react';

const meta: Meta<typeof DashboardAnalytics> = {
  title: 'Components/DashboardAnalytics',
  component: DashboardAnalytics,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Analytics dashboard showing credential statistics and activity trends.',
      },
    },
  },
  argTypes: {},
};

export default meta;
type Story = StoryObj<typeof meta>;

// Default analytics dashboard
export const Default: Story = {};

// Analytics dashboard with different data scenarios
export const WithData: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Analytics dashboard populated with sample data.',
      },
    },
  },
};

// Analytics dashboard in different viewport sizes
export const Responsive: Story = {
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
};

// Analytics dashboard in dark mode
export const DarkMode: Story = {
  parameters: {
    backgrounds: {
      default: 'dark',
    },
  },
};

// Analytics dashboard in light mode
export const LightMode: Story = {
  parameters: {
    backgrounds: {
      default: 'light',
    },
  },
};

// Full screen analytics dashboard
export const FullScreen: Story = {
  parameters: {
    layout: 'fullscreen',
  },
};

