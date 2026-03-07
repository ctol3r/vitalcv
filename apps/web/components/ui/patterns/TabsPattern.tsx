'use client';

import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

export interface TabsPatternProps {
  tabs: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
  layoutId?: string;
}

export function TabsPattern({ tabs, activeId, onChange, className, layoutId = 'activeTabBackground' }: TabsPatternProps) {
  return (
    <div
      className={cn(
        'relative flex items-center gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800/50',
        className
      )}
    >
      {tabs.map((tab) => {
        const isActive = activeId === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              'relative flex h-8 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500',
              isActive
                ? 'text-zinc-900 dark:text-zinc-100'
                : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
            )}
          >
            {isActive && (
              <motion.div
                layoutId={layoutId}
                className="absolute inset-0 z-0 rounded-lg bg-white shadow-sm dark:bg-zinc-700"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              {tab.icon && (
                <span className={cn('h-4 w-4', isActive ? 'opacity-100' : 'opacity-60')}>
                  {tab.icon}
                </span>
              )}
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
