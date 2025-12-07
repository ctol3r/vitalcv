/**
 * MobileLoadingSkeletons UI Component
 * Task: B244C-MOF-029
 *
 * Reusable skeleton screens for loading states
 * List items, cards, forms
 * Adapts to dark mode and high-contrast mode
 * Smooth transitions
 * Used across mobile pages
 */

'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

export function SkeletonText({ className }: SkeletonProps) {
  return <Skeleton className={cn('h-4 w-full', className)} />;
}

export function SkeletonTitle({ className }: SkeletonProps) {
  return <Skeleton className={cn('h-6 w-3/4', className)} />;
}

export function SkeletonAvatar({ className }: SkeletonProps) {
  return <Skeleton className={cn('h-10 w-10 rounded-full', className)} />;
}

export function SkeletonButton({ className }: SkeletonProps) {
  return <Skeleton className={cn('h-9 w-24', className)} />;
}

export function SkeletonCard({ className }: SkeletonProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <SkeletonTitle />
        <SkeletonText className="w-1/2" />
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <SkeletonText />
          <SkeletonText />
          <SkeletonText className="w-5/6" />
        </div>
      </CardContent>
    </Card>
  );
}

export function SkeletonListItem({ className }: SkeletonProps) {
  return (
    <div className={cn('flex items-center gap-4 p-4', className)}>
      <SkeletonAvatar />
      <div className="flex-1 space-y-2">
        <SkeletonTitle className="h-5" />
        <SkeletonText className="w-2/3" />
      </div>
    </div>
  );
}

export function SkeletonForm({ className }: SkeletonProps) {
  return (
    <div className={cn('space-y-6', className)}>
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-24 w-full" />
      </div>
      <SkeletonButton className="w-full" />
    </div>
  );
}

export function SkeletonTable({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {/* Header */}
      <div className="flex gap-4 pb-2 border-b">
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/4" />
        <Skeleton className="h-4 w-1/4" />
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 py-2">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-4 w-1/4" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonGrid({ items = 6, className }: { items?: number; className?: string }) {
  return (
    <div className={cn('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4', className)}>
      {Array.from({ length: items }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonList({ items = 5, className }: { items?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: items }).map((_, i) => (
        <SkeletonListItem key={i} />
      ))}
    </div>
  );
}

// Pre-configured skeleton screens for common page types
export function SkeletonPage({ className }: SkeletonProps) {
  return (
    <div className={cn('space-y-6 p-4', className)}>
      <SkeletonTitle className="h-8" />
      <SkeletonGrid items={6} />
    </div>
  );
}

export function SkeletonProfile({ className }: SkeletonProps) {
  return (
    <div className={cn('space-y-6 p-4', className)}>
      <div className="flex items-center gap-4">
        <SkeletonAvatar className="h-20 w-20" />
        <div className="flex-1 space-y-2">
          <SkeletonTitle />
          <SkeletonText className="w-1/2" />
        </div>
      </div>
      <SkeletonForm />
    </div>
  );
}

export function SkeletonDashboard({ className }: SkeletonProps) {
  return (
    <div className={cn('space-y-6 p-4', className)}>
      <SkeletonTitle className="h-8" />
      <div className="grid grid-cols-2 gap-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <SkeletonList items={5} />
    </div>
  );
}

