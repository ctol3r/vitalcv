import { ButtonPrimary } from '@/components/ui/ButtonPrimary';
import { HeroSection } from '@/components/ui/HeroSection';
import type { Meta, StoryObj } from '@storybook/react';

const meta: Meta<typeof HeroSection> = {
  title: 'Antigravity/HeroSection',
  component: HeroSection,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof HeroSection>;

export const Landing: Story = {
  args: {
    title: (
      <>
        Trust at the Speed of Light.{' '}
        <span className="text-[var(--trust-green)]">Zero Friction.</span>
      </>
    ),
    subtitle: 'The Antigravity UI system provides a verifiable credential platform wrapped in a premium Liquid Glass experience. Issue and verify at scale instantly.',
    primaryAction: <ButtonPrimary>Start Verification</ButtonPrimary>,
    secondaryAction: <button className="font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)] px-6 py-3 transition-colors">Read Documentation</button>,
  },
};
