'use client';

import { useState } from 'react';
import { HelpCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRoleUX } from '@/contexts/RoleUXContext';

interface HelpDrawerProps {
  glossary: React.ReactNode;
}

export function HelpDrawer({ glossary }: HelpDrawerProps) {
  const [open, setOpen] = useState(false);
  const { role } = useRoleUX();

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Open role-specific help drawer"
        className="fixed bottom-4 right-4 z-40 rounded-full shadow-lg"
        onClick={() => setOpen(true)}
      >
        <HelpCircle className="h-5 w-5" />
      </Button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end justify-end bg-black/30 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <section
            className="w-full max-w-md rounded-t-2xl bg-background p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Role help</p>
                <h2 className="text-lg font-semibold">{role} glossary & FAQ</h2>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close help drawer">
                <X className="h-4 w-4" />
              </Button>
            </header>
            <div className="space-y-4 text-sm text-muted-foreground">
              <p>
                Use this drawer for shared terminology, accessibility shortcuts, and policy context tailored to your
                current role.
              </p>
              {glossary}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

