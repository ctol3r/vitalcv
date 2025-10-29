'use client';

/**
 * Empty State Component
 *
 * Illustrated empty states for various scenarios (no credentials, no results, etc.)
 */

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AlertCircle, FileQuestion, FilterX, Inbox, Search, Wallet } from 'lucide-react';

type EmptyStateType =
  | 'no-credentials'
  | 'no-search-results'
  | 'no-verifications'
  | 'no-issued'
  | 'error'
  | 'loading';

interface EmptyStateProps {
  type: EmptyStateType;
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

const emptyStateConfig: Record<
  EmptyStateType,
  {
    icon: React.ReactNode;
    defaultTitle: string;
    defaultDescription: string;
  }
> = {
  'no-credentials': {
    icon: <Wallet className="h-16 w-16 text-muted-foreground" />,
    defaultTitle: 'No Credentials Yet',
    defaultDescription: 'Complete the claim wizard to receive your first verifiable credential.',
  },
  'no-search-results': {
    icon: <Search className="h-16 w-16 text-muted-foreground" />,
    defaultTitle: 'No Results Found',
    defaultDescription: 'Try adjusting your search or filters.',
  },
  'no-verifications': {
    icon: <FilterX className="h-16 w-16 text-muted-foreground" />,
    defaultTitle: 'No Verifications Yet',
    defaultDescription: 'Verification attempts will appear here.',
  },
  'no-issued': {
    icon: <Inbox className="h-16 w-16 text-muted-foreground" />,
    defaultTitle: 'No Credentials Issued',
    defaultDescription: 'Start issuing credentials to see them here.',
  },
  error: {
    icon: <AlertCircle className="h-16 w-16 text-destructive" />,
    defaultTitle: 'Something Went Wrong',
    defaultDescription: 'We encountered an error. Please try again.',
  },
  loading: {
    icon: <FileQuestion className="h-16 w-16 text-muted-foreground" />,
    defaultTitle: 'Loading...',
    defaultDescription: 'Please wait while we fetch your data.',
  },
};

export function EmptyState({ type, title, description, action, className }: EmptyStateProps) {
  const config = emptyStateConfig[type];

  return (
    <div
      className={cn('flex flex-col items-center justify-center py-12 px-4 text-center', className)}
    >
      <div className="mb-4">{config.icon}</div>

      <h3 className="text-lg font-semibold mb-2">{title || config.defaultTitle}</h3>

      <p className="text-sm text-muted-foreground max-w-sm mb-4">
        {description || config.defaultDescription}
      </p>

      {action && <Button onClick={action.onClick}>{action.label}</Button>}
    </div>
  );
}

// Specific empty state components for common scenarios

export function EmptyCredentials({
  onCreateCredential,
  className,
}: {
  onCreateCredential?: () => void;
  className?: string;
}) {
  return (
    <EmptyState
      type="no-credentials"
      action={
        onCreateCredential
          ? {
              label: 'Claim Your NPI',
              onClick: onCreateCredential,
            }
          : undefined
      }
      className={className}
    />
  );
}

export function EmptySearchResults({
  onClearSearch,
  searchQuery,
  className,
}: {
  onClearSearch?: () => void;
  searchQuery?: string;
  className?: string;
}) {
  return (
    <EmptyState
      type="no-search-results"
      title={`No results for "${searchQuery}"`}
      description="Try a different search term or clear your filters."
      action={
        onClearSearch
          ? {
              label: 'Clear Search',
              onClick: onClearSearch,
            }
          : undefined
      }
      className={className}
    />
  );
}
