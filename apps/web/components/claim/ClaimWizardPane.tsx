'use client';

import { PropsWithChildren } from 'react';

export default function ClaimWizardPane({
  open,
  onClose,
  children,
}: PropsWithChildren<{ open: boolean; onClose: () => void }>) {
  return (
    <div className={`fixed inset-0 z-40 ${open ? '' : 'pointer-events-none'}`}>
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />
      <div
        className={`absolute right-0 top-0 h-full w-full sm:w-[480px] bg-white shadow-xl transition-transform ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-full overflow-auto">{children}</div>
      </div>
    </div>
  );
}
