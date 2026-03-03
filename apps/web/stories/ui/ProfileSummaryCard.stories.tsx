import { ProfileSummaryCard } from '@/components/ui/ProfileSummaryCard';
import type { Meta, StoryObj } from '@storybook/react';

const meta: Meta<typeof ProfileSummaryCard> = {
  title: 'Antigravity/ProfileSummaryCard',
  component: ProfileSummaryCard,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ProfileSummaryCard>;

export const Default: Story = {
  args: {
    name: 'Dr. Jane Smith',
    role: 'Board Certified Cardiologist',
    statusLevel: 'L3',
    statusLabel: 'High Assurance',
    imageUrl: 'https://i.pravatar.cc/150?u=jane',
  },
  decorators: [
    (Story) => (
      <div className="w-[600px] p-8 -m-8 bg-[var(--background)] relative z-0 flex items-center justify-center">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-[var(--trust-green)] blur-3xl opacity-20 -z-10" />
        <Story />
      </div>
    ),
  ],
};
