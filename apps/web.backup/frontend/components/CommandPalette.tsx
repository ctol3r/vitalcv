import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';

export interface Command {
  id: string;
  label: string;
  description?: string;
  action: () => void;
  keywords?: string[]; // For fuzzy search
}

interface CommandPaletteProps {
  commands?: Command[];
  onOpenChange?: (isOpen: boolean) => void;
}

const defaultCommands: Command[] = [
  {
    id: 'open-claim-wizard',
    label: 'Open Claim Wizard',
    description: 'Start a new claim submission',
    action: () => {
      if (typeof window !== 'undefined') {
        window.location.href = '/onboarding';
      }
    },
    keywords: ['claim', 'wizard', 'submit', 'new'],
  },
  {
    id: 'open-wallet',
    label: 'Open Wallet',
    description: 'View your verifiable credentials',
    action: () => {
      if (typeof window !== 'undefined') {
        window.location.href = '/wallet';
      }
    },
    keywords: ['wallet', 'credentials', 'vc', 'view'],
  },
  {
    id: 'copy-vc-link',
    label: 'Copy VC Link',
    description: 'Copy link to share a credential',
    action: async () => {
      // Placeholder - in production would copy actual VC link
      const link = `${window.location.origin}/wallet`;
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(link);
        alert('VC link copied to clipboard!');
      } else {
        prompt('Copy this link:', link);
      }
    },
    keywords: ['copy', 'share', 'link', 'vc'],
  },
  {
    id: 'npi-lookup',
    label: 'Run Quick NPI Lookup',
    description: 'Lookup National Provider Identifier',
    action: () => {
      const npi = prompt('Enter NPI number to lookup:');
      if (npi) {
        // Placeholder - in production would open NPI lookup modal or navigate
        window.open(`/onboarding?npi=${npi}`, '_blank');
      }
    },
    keywords: ['npi', 'lookup', 'provider', 'search'],
  },
];

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  commands = defaultCommands,
  onOpenChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();

  // Filter commands based on search query
  const filteredCommands = commands.filter((cmd) => {
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    const matchesLabel = cmd.label.toLowerCase().includes(query);
    const matchesDescription = cmd.description?.toLowerCase().includes(query);
    const matchesKeywords = cmd.keywords?.some((kw) => kw.toLowerCase().includes(query));
    
    return matchesLabel || matchesDescription || matchesKeywords;
  });

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Open palette with '/', ';;', or 'jj'
      if (
        (e.key === '/' && e.target instanceof HTMLInputElement === false && e.target instanceof HTMLTextAreaElement === false) ||
        (e.key === ';' && e.shiftKey && e.target instanceof HTMLInputElement === false && e.target instanceof HTMLTextAreaElement === false) ||
        (e.key === 'j' && e.key === 'j' && e.target instanceof HTMLInputElement === false && e.target instanceof HTMLTextAreaElement === false)
      ) {
        // For ';;' and 'jj', we need to track double presses
        if (e.key === ';' || e.key === 'j') {
          const now = Date.now();
          const lastPress = (window as any).__commandPaletteLastPress;
          if (lastPress && now - lastPress < 300) {
            e.preventDefault();
            setIsOpen(true);
            return;
          }
          (window as any).__commandPaletteLastPress = now;
        } else {
          e.preventDefault();
          setIsOpen(true);
        }
      }

      // Close palette with Escape
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        setIsOpen(false);
        setSearchQuery('');
        setSelectedIndex(0);
      }

      // Handle navigation within palette
      if (isOpen) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, filteredCommands.length - 1));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action();
            setIsOpen(false);
            setSearchQuery('');
            setSelectedIndex(0);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, filteredCommands, selectedIndex]);

  // Reset selected index when search query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  // Notify parent of open state changes
  useEffect(() => {
    if (onOpenChange) {
      onOpenChange(isOpen);
    }
  }, [isOpen, onOpenChange]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        paddingTop: '100px',
        zIndex: 10000,
      }}
      onClick={() => {
        setIsOpen(false);
        setSearchQuery('');
        setSelectedIndex(0);
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
          width: '90%',
          maxWidth: '600px',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div style={{ padding: '12px', borderBottom: '1px solid #eee' }}>
          <input
            type="text"
            placeholder="Type to search commands..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
            style={{
              width: '100%',
              padding: '10px',
              fontSize: '16px',
              border: 'none',
              outline: 'none',
            }}
          />
        </div>

        {/* Commands List */}
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {filteredCommands.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
              No commands found
            </div>
          ) : (
            filteredCommands.map((cmd, index) => (
              <div
                key={cmd.id}
                onClick={() => {
                  cmd.action();
                  setIsOpen(false);
                  setSearchQuery('');
                  setSelectedIndex(0);
                }}
                style={{
                  padding: '12px 16px',
                  cursor: 'pointer',
                  backgroundColor: index === selectedIndex ? '#e3f2fd' : 'transparent',
                  borderLeft: index === selectedIndex ? '3px solid #2196f3' : '3px solid transparent',
                }}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div style={{ fontSize: '16px', fontWeight: 500, marginBottom: '4px' }}>
                  {cmd.label}
                </div>
                {cmd.description && (
                  <div style={{ fontSize: '14px', color: '#666' }}>{cmd.description}</div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '8px 16px',
            borderTop: '1px solid #eee',
            fontSize: '12px',
            color: '#999',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span>Use ↑↓ to navigate, Enter to select, Esc to close</span>
          <span>{filteredCommands.length} command{filteredCommands.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  );
};

/**
 * Hook to register commands dynamically (for AI suggestions or plugins)
 */
export function useCommandPalette(additionalCommands?: Command[]) {
  const [commands, setCommands] = useState<Command[]>(defaultCommands);

  useEffect(() => {
    if (additionalCommands) {
      setCommands([...defaultCommands, ...additionalCommands]);
    }
  }, [additionalCommands]);

  return { commands };
}

export default CommandPalette;
