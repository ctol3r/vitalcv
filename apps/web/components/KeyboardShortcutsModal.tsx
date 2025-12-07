'use client';

/**
 * Keyboard Shortcuts Cheat Sheet
 *
 * Opens with '?' key
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Keyboard } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Shortcut {
  keys: string[];
  description: string;
  category: string;
}

const shortcuts: Shortcut[] = [
  // Navigation
  { keys: ['G', 'D'], description: 'Go to Dashboard', category: 'Navigation' },
  { keys: ['G', 'V'], description: 'Go to Verify', category: 'Navigation' },
  { keys: ['G', 'W'], description: 'Go to Wallet', category: 'Navigation' },
  { keys: ['G', 'I'], description: 'Go to Issuer', category: 'Navigation' },
  { keys: ['G', 'A'], description: 'Go to Analytics', category: 'Navigation' },

  // Actions
  { keys: ['N'], description: 'New Credential', category: 'Actions' },
  { keys: ['S'], description: 'Search', category: 'Actions' },
  { keys: ['/'], description: 'Focus Search', category: 'Actions' },
  { keys: ['R'], description: 'Refresh/Reload', category: 'Actions' },
  { keys: ['Ctrl', 'K'], description: 'Command Palette', category: 'Actions' },

  // UI Controls
  { keys: ['?'], description: 'Show Keyboard Shortcuts', category: 'UI Controls' },
  { keys: ['Esc'], description: 'Close Modal/Drawer', category: 'UI Controls' },
  { keys: ['T'], description: 'Toggle Theme', category: 'UI Controls' },
  { keys: ['['], description: 'Collapse Sidebar', category: 'UI Controls' },
  { keys: [']'], description: 'Expand Sidebar', category: 'UI Controls' },

  // Developer
  { keys: ['Ctrl', 'Shift', 'D'], description: 'Toggle Dev Toolbar', category: 'Developer' },
  { keys: ['Ctrl', 'Shift', 'L'], description: 'Clear Local Storage', category: 'Developer' },
  { keys: ['Ctrl', 'Shift', 'I'], description: 'Impersonate User', category: 'Developer' },
];

export function KeyboardShortcutsModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    // Detect Mac
    setIsMac(navigator.platform.toUpperCase().indexOf('MAC') >= 0);

    // Listen for '?' key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        // Don't open if typing in an input
        const target = e.target as HTMLElement;
        if (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable
        ) {
          return;
        }

        e.preventDefault();
        setIsOpen(true);
      }

      // Esc to close
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const formatKey = (key: string): string => {
    if (key === 'Ctrl' && isMac) return 'Cmd';
    if (key === 'Alt' && isMac) return 'Opt';
    return key;
  };

  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, Shortcut[]>);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            <DialogTitle>Keyboard Shortcuts</DialogTitle>
          </div>
          <DialogDescription>Quick access to features and actions</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
            <div key={category} className="space-y-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">{category}</h3>
              <div className="space-y-2">
                {categoryShortcuts.map((shortcut, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <span className="text-sm">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, keyIdx) => (
                        <span key={keyIdx} className="flex items-center gap-1">
                          <Badge variant="outline" className="font-mono text-xs px-2 py-0.5">
                            {formatKey(key)}
                          </Badge>
                          {keyIdx < shortcut.keys.length - 1 && (
                            <span className="text-xs text-muted-foreground">+</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {Object.keys(groupedShortcuts).indexOf(category) <
                Object.keys(groupedShortcuts).length - 1 && <Separator className="mt-4" />}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Keyboard className="h-3 w-3" />
            Press{' '}
            <Badge variant="outline" className="text-xs">
              ?
            </Badge>{' '}
            anytime to open
          </div>
          <Button size="sm" onClick={() => setIsOpen(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
