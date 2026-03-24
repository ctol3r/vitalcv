'use client';

import { cn } from '@/lib/utils';
import { useMotion } from '@/ui/hooks/useMotion';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import React, { useEffect, useRef } from 'react';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  width?: 'sm' | 'detail' | 'md' | 'lg' | 'xl' | 'full';
  children: React.ReactNode;
  actions?: React.ReactNode;
  overlay?: boolean;
}

const WIDTHS = {
  sm: 'w-[400px]',
  detail: 'w-[460px]',
  md: 'w-[560px]',
  lg: 'w-[720px]',
  xl: 'w-[960px]',
  full: 'w-screen',
};

export function Drawer({ open, onClose, title, width = 'md', children, actions, overlay = true }: DrawerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { transition, variant } = useMotion();

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    ref.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  return (
    <AnimatePresence initial={false}>
      {open ? (
        <>
          {overlay ? (
            <motion.div
              aria-hidden
              className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm"
              initial="initial"
              animate="enter"
              exit="exit"
              onClick={onClose}
              variants={variant('backdrop')}
            />
          ) : null}

          <motion.div
            role="dialog"
            aria-modal
            aria-label={typeof title === 'string' ? title : 'Drawer'}
            ref={ref}
            className={cn(
              'fixed right-0 top-0 z-50 flex h-full flex-col border-l shadow-[0_0_60px_rgba(0,0,0,0.8)]',
              WIDTHS[width],
            )}
            initial="initial"
            animate="enter"
            exit="exit"
            variants={variant('drawer')}
            style={{
              background: 'var(--vital-ops-panel)',
              borderColor: 'var(--vital-ops-border-subtle)',
            }}
          >
            <div
              className="flex shrink-0 items-center justify-between border-b px-6 py-4 backdrop-blur-md"
              style={{
                background: 'var(--vital-ops-panel)',
                borderColor: 'var(--vital-ops-border-subtle)',
              }}
            >
              <div
                className="flex items-center gap-2 text-sm font-semibold tracking-tight"
                style={{ color: 'var(--vital-ops-text-primary)' }}
              >
                {title}
              </div>
              <div className="flex items-center gap-3">
                {actions}
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="rounded-md p-1.5 transition-colors hover:bg-white/10 hover:text-white"
                  style={{
                    color: 'var(--vital-ops-text-muted)',
                    transitionDuration: 'var(--ui-motion-duration-fast)',
                    transitionTimingFunction: 'var(--ui-motion-ease-out)',
                  }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <motion.div
              className="flex-1 overflow-y-auto overscroll-contain p-0"
              style={{ background: 'var(--vital-ops-background)' }}
              transition={transition('panel')}
            >
              {children}
            </motion.div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}

export function useDrawer() {
  const [open, setOpen] = React.useState(false);
  return { open, onOpen: () => setOpen(true), onClose: () => setOpen(false) };
}
