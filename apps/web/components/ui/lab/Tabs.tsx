'use client';

/**
 * Tabs — Wave 129: Uiverse Pattern Adoption
 *
 * Accessible tab component with animated indicator.
 * Normalized to VitalCV tokens.
 */

import { useState, useRef, useEffect, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface TabItem {
  id: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
}

interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  variant?: 'default' | 'pills' | 'underline';
  size?: 'sm' | 'md';
  className?: string;
}

export function Tabs({
  tabs,
  activeTab,
  onChange,
  variant = 'default',
  size = 'md',
  className,
}: TabsProps) {
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  useEffect(() => {
    const el = tabRefs.current.get(activeTab);
    if (el) {
      setIndicatorStyle({ left: el.offsetLeft, width: el.offsetWidth });
    }
  }, [activeTab]);

  const sizeClasses = size === 'sm' ? 'text-[10px] px-2.5 py-1' : 'text-xs px-3 py-1.5';

  return (
    <div
      className={cn('relative flex items-center gap-0.5', className)}
      role="tablist"
    >
      {variant !== 'underline' && (
        <motion.div
          className={cn(
            'absolute z-0 rounded-lg',
            variant === 'pills'
              ? 'bg-emerald-500/15 border border-emerald-500/30'
              : 'bg-white/[0.06]'
          )}
          style={{ height: '100%' }}
          animate={{ left: indicatorStyle.left, width: indicatorStyle.width }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      )}

      {variant === 'underline' && (
        <motion.div
          className="absolute bottom-0 h-0.5 bg-emerald-400 rounded-full z-10"
          animate={{ left: indicatorStyle.left, width: indicatorStyle.width }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      )}

      {tabs.map((tab) => (
        <button
          key={tab.id}
          ref={(el) => { if (el) tabRefs.current.set(tab.id, el); }}
          role="tab"
          aria-selected={activeTab === tab.id}
          aria-disabled={tab.disabled}
          disabled={tab.disabled}
          onClick={() => !tab.disabled && onChange(tab.id)}
          className={cn(
            'relative z-10 flex items-center gap-1.5 transition-colors rounded-lg',
            sizeClasses,
            activeTab === tab.id
              ? variant === 'pills' ? 'text-emerald-300' : 'text-zinc-200'
              : 'text-zinc-500 hover:text-zinc-300',
            tab.disabled && 'opacity-30 cursor-not-allowed'
          )}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
}

interface TabPanelProps {
  id: string;
  activeTab: string;
  children: ReactNode;
  className?: string;
}

export function TabPanel({ id, activeTab, children, className }: TabPanelProps) {
  if (id !== activeTab) return null;
  return (
    <div role="tabpanel" aria-labelledby={id} className={className}>
      {children}
    </div>
  );
}
