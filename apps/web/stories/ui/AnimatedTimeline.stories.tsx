import { AnimatedTimeline } from '@/components/ui/AnimatedTimeline';
import type { Meta, StoryObj } from '@storybook/react';

const meta: Meta<typeof AnimatedTimeline> = {
  title: 'Antigravity/AnimatedTimeline',
  component: AnimatedTimeline,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof AnimatedTimeline>;

export const VerificationHistory: Story = {
  args: {
    events: [
      {
        id: '1',
        date: 'Today',
        title: 'Medical License Verified',
        description: 'State board credential confirmed via direct digital issuance connection.',
        status: 'L3',
        statusLabel: 'Verified (L3)',
      },
      {
        id: '2',
        date: 'Oct 12, 2026',
        title: 'Identity Proofing Completed',
        description: 'Completed IAL2 identity verification matching presented government ID to live biometric reading.',
        status: 'L2',
        statusLabel: 'Identity Confirmed (L2)',
      },
      {
        id: '3',
        date: 'Oct 10, 2026',
        title: 'Profile Created',
        description: 'User initiated basic profile creation, self-attesting to historical data before formal verification.',
        status: 'L0',
        statusLabel: 'Self-Attested (L0)',
      },
    ],
  },
};
