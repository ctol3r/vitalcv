/**
 * Role-Based Navigation Component
 * Displays navigation routes specific to the current role
 */

'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { roleUIEngine, RoleType } from '@/lib/roles';
import { cn } from '@/lib/utils';

interface RoleNavigationProps {
  roleType: RoleType | null;
  className?: string;
}

/**
 * RoleNavigation Component
 * Renders navigation based on current role
 */
export function RoleNavigation({ roleType, className }: RoleNavigationProps) {
  const pathname = usePathname();

  const routes = useMemo(() => {
    if (!roleType) return [];
    return roleUIEngine.getNavigationRoutes(roleType);
  }, [roleType]);

  if (!roleType || routes.length === 0) {
    return null;
  }

  const theme = roleUIEngine.getRoleTheme(roleType);

  return (
    <nav
      className={cn('flex items-center gap-1', className)}
      style={{ '--role-primary': theme.colors.primary } as React.CSSProperties}
    >
      {routes.map((route) => {
        const isActive = pathname === route.path || pathname?.startsWith(route.path + '/');

        return (
          <Link
            key={route.path}
            href={route.path}
            className={cn(
              'px-4 py-2 rounded-md text-sm font-medium transition-colors',
              'hover:bg-accent',
              isActive
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground'
            )}
            style={
              isActive
                ? {
                    backgroundColor: `${theme.colors.primary}15`,
                    color: theme.colors.primary,
                  }
                : undefined
            }
          >
            {route.label}
            {route.badge && (
              <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-primary text-primary-foreground">
                {route.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

