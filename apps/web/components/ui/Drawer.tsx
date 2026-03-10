'use client';
import React, { useEffect, useRef } from 'react';

interface DrawerProps { open: boolean; onClose: () => void; title: string; width?: 'sm' | 'md' | 'lg' | 'full'; children: React.ReactNode; actions?: React.ReactNode }

const WIDTHS = { sm: 'w-[480px]', md: 'w-[640px]', lg: 'w-[800px]', full: 'w-screen' };

export function Drawer({ open, onClose, title, width = 'md', children, actions }: DrawerProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    ref.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} aria-hidden />}
      <div role="dialog" aria-modal aria-label={title} ref={ref}
        className={`fixed top-0 right-0 h-full ${WIDTHS[width]} z-50 flex flex-col bg-[var(--color-surface-elevated,#1a1a2e)] border-l border-[var(--color-outline,#333)] shadow-2xl transition-transform duration-200 ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-outline,#333)]">
          <h2 className="text-sm font-semibold text-white truncate">{title}</h2>
          <div className="flex items-center gap-2">
            {actions}
            <button onClick={onClose} aria-label="Close" className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors">✕</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </>
  );
}

export function useDrawer() {
  const [open, setOpen] = React.useState(false);
  return { open, onOpen: () => setOpen(true), onClose: () => setOpen(false) };
}
