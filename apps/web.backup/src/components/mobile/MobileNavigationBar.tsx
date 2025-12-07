/**
 * MobileNavigationBar UI Component
 * Task: B244C-MOF-023
 *
 * Bottom navigation bar with icons and labels for primary sections
 * Supports gesture navigation, highlights active tab
 * Accessible and responsive
 */

'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Home, CheckSquare, MessageSquare, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  ariaLabel: string;
}

const navItems: NavItem[] = [
  {
    id: 'home',
    label: 'Home',
    icon: Home,
    href: '/',
    ariaLabel: 'Navigate to home',
  },
  {
    id: 'tasks',
    label: 'Tasks',
    icon: CheckSquare,
    href: '/tasks',
    ariaLabel: 'Navigate to tasks',
  },
  {
    id: 'messages',
    label: 'Messages',
    icon: MessageSquare,
    href: '/messages',
    ariaLabel: 'Navigate to messages',
  },
  {
    id: 'profile',
    label: 'Profile',
    icon: User,
    href: '/profile',
    ariaLabel: 'Navigate to profile',
  },
];

export function MobileNavigationBar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleNavigation = (href: string) => {
    router.push(href);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background shadow-lg md:hidden"
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="grid grid-cols-4 h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <button
              key={item.id}
              onClick={() => handleNavigation(item.href)}
              className={cn(
                'flex flex-col items-center justify-center gap-1 transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                isActive
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent',
              )}
              aria-label={item.ariaLabel}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

