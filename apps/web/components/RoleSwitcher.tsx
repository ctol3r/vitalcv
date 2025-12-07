'use client';

/**
 * Role Switcher - Segmented control for switching between user roles
 */

import { useRole } from '@/hooks/use-role';
import { UserRole } from '@/lib/npi-types';
import { User, Building2, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RoleSwitcherProps {
  availableRoles: UserRole[];
  className?: string;
}

const roleConfig = {
  holder: {
    label: 'Holder',
    icon: User,
    color: 'text-blue-600 dark:text-blue-400',
  },
  issuer: {
    label: 'Issuer',
    icon: Building2,
    color: 'text-purple-600 dark:text-purple-400',
  },
  verifier: {
    label: 'Verifier',
    icon: Shield,
    color: 'text-green-600 dark:text-green-400',
  },
};

export function RoleSwitcher({ availableRoles, className }: RoleSwitcherProps) {
  const { selectedRole, switchRole, hasMultipleRoles, isHydrated } = useRole(availableRoles);

  // Don't render if user only has one role or not yet hydrated
  if (!hasMultipleRoles || !isHydrated) {
    return null;
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-lg bg-muted p-1',
        className
      )}
      role="tablist"
      aria-label="User role selector"
    >
      {availableRoles.map((role) => {
        const config = roleConfig[role];
        const Icon = config.icon;
        const isSelected = selectedRole === role;

        return (
          <button
            key={role}
            onClick={() => switchRole(role)}
            className={cn(
              'relative flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              isSelected
                ? 'bg-background shadow-sm'
                : 'hover:bg-background/50'
            )}
            role="tab"
            aria-selected={isSelected}
            aria-label={`Switch to ${config.label} role`}
          >
            <Icon className={cn('h-4 w-4', isSelected && config.color)} />
            <span className={cn(isSelected && 'font-semibold')}>
              {config.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

