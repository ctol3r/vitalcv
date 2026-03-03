'use client';

import { cardReveal, staggerContainer } from '@/animations/motionVariants';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { BadgeLevel, BadgeStatus } from './BadgeStatus';

export interface TimelineEvent {
  id: string;
  date: string;
  title: string;
  description?: string;
  status: BadgeLevel;
  statusLabel: string;
}

interface AnimatedTimelineProps {
  events: TimelineEvent[];
  className?: string;
}

export function AnimatedTimeline({ events, className }: AnimatedTimelineProps) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-50px' }}
      className={cn('relative max-w-2xl', className)}
    >
      {/* Vertical subtle line */}
      <div className="absolute left-[27px] top-4 bottom-4 w-px bg-[var(--border)]" />

      {events.map((event, index) => (
        <motion.div
          key={event.id}
          variants={cardReveal}
          className="relative flex items-start gap-6 mb-8 last:mb-0"
        >
          {/* Node */}
          <div className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-full glass glass-border bg-[var(--background)]">
            <div className="h-3 w-3 rounded-full bg-[var(--primary)]" />
          </div>

          {/* Content */}
          <div className="flex flex-col pt-3 pb-4">
            <div className="flex items-center gap-3 mb-1">
              <span className="text-sm font-medium text-[var(--muted-foreground)]">
                {event.date}
              </span>
              <BadgeStatus level={event.status} label={event.statusLabel} />
            </div>
            <h4 className="text-lg font-semibold tracking-tight text-[var(--foreground)]">
              {event.title}
            </h4>
            {event.description && (
              <p className="mt-1 text-sm text-[var(--muted-foreground)] leading-relaxed">
                {event.description}
              </p>
            )}
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
