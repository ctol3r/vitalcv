'use client';

import { popIn } from '@/animations/motionVariants';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { BadgeLevel, BadgeStatus } from './BadgeStatus';
import { GlassCard, GlassCardContent, GlassCardHeader, GlassCardTitle } from './glass-card';

interface ProfileSummaryCardProps {
  name: string;
  role: string;
  imageUrl?: string;
  statusLevel: BadgeLevel;
  statusLabel: string;
  className?: string;
}

export function ProfileSummaryCard({
  name,
  role,
  imageUrl,
  statusLevel,
  statusLabel,
  className,
}: ProfileSummaryCardProps) {
  return (
    <GlassCard interactive weight="heavy" className={cn('relative overflow-hidden max-w-md', className)}>
      <GlassCardHeader className="flex-col md:flex-row items-center md:items-start text-center md:text-left gap-6">
        <motion.div
          variants={popIn}
          initial="hidden"
          animate="visible"
          className="h-24 w-24 shrink-0 overflow-hidden rounded-full ring-4 ring-[var(--background)] shadow-elevated"
        >
          {imageUrl ? (
            <img src={imageUrl} alt={name} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-[var(--muted)] flex items-center justify-center text-3xl font-semibold text-[var(--muted-foreground)]">
              {name.charAt(0)}
            </div>
          )}
        </motion.div>
        <div className="flex flex-col gap-2 pt-2">
          <div>
            <GlassCardTitle className="text-2xl">{name}</GlassCardTitle>
            <p className="text-[var(--muted-foreground)] font-medium mt-1">{role}</p>
          </div>
          <div className="mt-2">
            <BadgeStatus level={statusLevel} label={statusLabel} pulse={statusLevel === 'L1'} />
          </div>
        </div>
      </GlassCardHeader>

      <GlassCardContent className="text-[var(--muted-foreground)] leading-relaxed mt-4 text-center md:text-left">
        This profile reflects the current credential status shown on this surface.
      </GlassCardContent>
    </GlassCard>
  );
}
