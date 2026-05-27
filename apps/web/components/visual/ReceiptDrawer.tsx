'use client';

import * as React from 'react';
import { Button } from './primitives';
import { Receipt, type ReceiptLine } from './Receipt';

/**
 * Slide-in Receipt Drawer (chat22 fix #10).
 *
 * Separate from the inline receipt block on /passport. The inline receipt
 * gives a quick summary; this drawer is the full inspect surface with the
 * complete receipt + signature + replay handle.
 *
 * Uses portal-free fixed positioning + a backdrop. Closes on Escape, on
 * backdrop click, and on the close button.
 */
export type ReceiptDrawerProps = {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  lines: ReceiptLine[];
  signature?: React.ReactNode;
  /** Optional secondary content below the receipt (replay link, raw JSON, etc.). */
  children?: React.ReactNode;
};

export function ReceiptDrawer({
  open,
  onClose,
  title = 'Read receipt · D57',
  lines,
  signature,
  children,
}: ReceiptDrawerProps) {
  React.useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      <div
        className="vs-drawer-backdrop"
        data-open={open}
        onClick={onClose}
        aria-hidden={!open}
      />
      <aside
        className="vs-drawer"
        data-open={open}
        role="dialog"
        aria-modal="true"
        aria-label="Read receipt"
        aria-hidden={!open}
      >
        <div className="vs-drawer-hd">
          <span className="vs-ttl">{title}</span>
          <Button variant="ghost" size="md" onClick={onClose} aria-label="Close receipt drawer">
            Close ✕
          </Button>
        </div>
        <div className="vs-drawer-bd">
          <Receipt lines={lines} signature={signature} />
          {children}
        </div>
        <div className="vs-drawer-ft">
          <span className="vs-muted">Receipt is signed (ed25519) and replayable.</span>
        </div>
      </aside>
    </>
  );
}
