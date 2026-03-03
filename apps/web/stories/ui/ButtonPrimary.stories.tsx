import { ButtonPrimary } from '@/components/ui/ButtonPrimary';
import type { Meta, StoryObj } from '@storybook/react';
import { ShieldCheck } from 'lucide-react';

const meta: Meta<typeof ButtonPrimary> = {
  title: 'Antigravity/ButtonPrimary',
  component: ButtonPrimary,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ButtonPrimary>;

export const Default: Story = {
  args: {
    children: 'Start Verification',
  },
};

export const WithIcon: Story = {
  args: {
    children: 'Approve Node',
    icon: <ShieldCheck className="w-5 h-5 ml-1" />,
  },
};
