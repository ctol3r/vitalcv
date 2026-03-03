import { BadgeStatus } from '@/components/ui/BadgeStatus';
import type { Meta, StoryObj } from '@storybook/react';

const meta: Meta<typeof BadgeStatus> = {
  title: 'Antigravity/BadgeStatus',
  component: BadgeStatus,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof BadgeStatus>;

export const L0_Unverified: Story = {
  args: {
    level: 'L0',
    label: 'Claimed (L0)',
  },
};

export const L1_Pending_Pulse: Story = {
  args: {
    level: 'L1',
    label: 'Pending (L1)',
    pulse: true,
  },
};

export const L2_Verified: Story = {
  args: {
    level: 'L2',
    label: 'Verified (L2)',
  },
};

export const L3_HighTrust: Story = {
  args: {
    level: 'L3',
    label: 'High Assurance (L3)',
  },
};
