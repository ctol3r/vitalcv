'use client';

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ActivitySquare, Compass, LayoutDashboard, Network, Shield } from 'lucide-react';

type CommandAction = {
  id: string;
  label: string;
  hint: string;
  run: () => void;
};

export function CommandMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const commands = useMemo<CommandAction[]>(
    () => [
      {
        id: 'open-pulse',
        label: 'Open Pulse',
        hint: 'View recent system signals',
        run: () => router.push('/dashboard#pulse'),
      },
      {
        id: 'dashboard',
        label: 'Go to dashboard',
        hint: 'Home workspace',
        run: () => router.push('/dashboard'),
      },
      {
        id: 'profile',
        label: 'Open profile',
        hint: 'Review clinician profile',
        run: () => router.push('/profile'),
      },
      {
        id: 'graph',
        label: 'Open trust graph',
        hint: 'Navigate credential relationships',
        run: () => router.push('/graph'),
      },
    ],
    [router],
  );

  const quickLinks = useMemo<CommandAction[]>(
    () => [
      {
        id: 'start',
        label: 'Start verification',
        hint: 'Kick off a credential workflow',
        run: () => router.push('/start'),
      },
    ],
    [router],
  );

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, []);

  const runCommand = (command: CommandAction) => {
    setOpen(false);
    command.run();
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Command menu">
      <CommandInput placeholder="Search actions" />
      <CommandList>
        <CommandEmpty>No actions found.</CommandEmpty>
        <CommandGroup heading="Navigation">
          {commands.map((command) => (
            <CommandItem
              key={command.id}
              value={command.label}
              keywords={[command.hint]}
              onSelect={() => runCommand(command)}
            >
              {command.id === 'dashboard' && <LayoutDashboard className="mr-2 h-4 w-4" />}
              {command.id === 'open-pulse' && <ActivitySquare className="mr-2 h-4 w-4" />}
              {command.id === 'profile' && <Shield className="mr-2 h-4 w-4" />}
              {command.id === 'graph' && <Network className="mr-2 h-4 w-4" />}
              <div className="flex flex-col">
                <span>{command.label}</span>
                <span className="text-xs text-muted-foreground">{command.hint}</span>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Quick links">
          {quickLinks.map((link) => (
            <CommandItem
              key={link.id}
              value={link.label}
              keywords={[link.hint]}
              onSelect={() => runCommand(link)}
            >
              <Compass className="mr-2 h-4 w-4" />
              <div className="flex flex-col">
                <span>{link.label}</span>
                <span className="text-xs text-muted-foreground">{link.hint}</span>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
