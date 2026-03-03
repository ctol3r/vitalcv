import { GlassCard, GlassCardContent, GlassCardFooter, GlassCardHeader, GlassCardTitle } from '@/components/ui/glass-card';
import type { Meta, StoryObj } from '@storybook/react';

const meta: Meta<typeof GlassCard> = {
  title: 'Antigravity/GlassCard',
  component: GlassCard,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof GlassCard>;

export const Default: Story = {
  render: () => (
    <div className="w-[400px] p-8 -m-8 bg-[var(--background)] relative z-0">
      <div className="absolute top-10 left-10 w-32 h-32 rounded-full bg-[var(--primary)] blur-2xl opacity-20 -z-10" />
      <GlassCard interactive>
        <GlassCardHeader>
          <GlassCardTitle>Verifiable Credential</GlassCardTitle>
        </GlassCardHeader>
        <GlassCardContent>
          This represents a verifiable claim issued by a trusted authority. The Liquid Glass aesthetic provides structural depth over a complex background.
        </GlassCardContent>
        <GlassCardFooter>
          <span className="text-xs text-[var(--muted-foreground)]">Issued 2 days ago</span>
        </GlassCardFooter>
      </GlassCard>
    </div>
  ),
};

export const Elevated: Story = {
  render: () => (
    <div className="w-[400px] p-8 -m-8 bg-[var(--background)] relative z-0">
      <div className="absolute top-10 left-10 w-32 h-32 rounded-full bg-[var(--sage)] blur-2xl opacity-30 -z-10" />
      <GlassCard variant="elevated" interactive>
        <GlassCardHeader>
          <GlassCardTitle>Elevated Card</GlassCardTitle>
        </GlassCardHeader>
        <GlassCardContent>
          The elevated variant adds a stronger shadow for cards that need visual prominence, such as featured credentials or primary actions.
        </GlassCardContent>
      </GlassCard>
    </div>
  ),
};

export const HeavyWeight: Story = {
  render: () => (
    <div className="w-[400px] p-8 -m-8 bg-[var(--background)] relative z-0">
      <div className="absolute top-10 left-10 w-32 h-32 rounded-full bg-[var(--accent)] blur-2xl opacity-30 -z-10" />
      <GlassCard variant="heavy" interactive>
        <GlassCardHeader>
          <GlassCardTitle>Secure Vault</GlassCardTitle>
        </GlassCardHeader>
        <GlassCardContent>
          Heavy glass provides less transparency, used for high-security panels or foreground overlays where readability is paramount.
        </GlassCardContent>
      </GlassCard>
    </div>
  ),
};
