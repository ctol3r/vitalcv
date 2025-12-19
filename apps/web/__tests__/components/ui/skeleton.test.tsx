import { Skeleton, SkeletonCard, SkeletonList, SkeletonTable } from '@/components/ui/skeleton';
import { render, screen } from '@testing-library/react';

describe('Skeleton Components', () => {
  describe('Skeleton', () => {
    it('renders with default classes', () => {
      render(<Skeleton data-testid="skeleton" />);

      const skeleton = screen.getByTestId('skeleton');
      expect(skeleton).toHaveAttribute('data-slot', 'skeleton');
      expect(skeleton).toHaveClass('bg-accent', 'animate-pulse', 'rounded-md');
    });

    it('accepts custom className', () => {
      render(<Skeleton className="h-4 w-full" data-testid="skeleton" />);

      const skeleton = screen.getByTestId('skeleton');
      expect(skeleton).toHaveClass('h-4', 'w-full');
    });

    it('passes through other props', () => {
      render(<Skeleton data-testid="skeleton" role="status" />);

      const skeleton = screen.getByTestId('skeleton');
      expect(skeleton).toHaveAttribute('role', 'status');
    });
  });

  describe('SkeletonCard', () => {
    it('renders card skeleton structure', () => {
      render(<SkeletonCard />);

      const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
      expect(skeletons.length).toBe(3);
    });
  });

  describe('SkeletonList', () => {
    it('renders default number of items', () => {
      render(<SkeletonList />);

      const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
      // 3 items * (avatar + 2 lines) = 9
      expect(skeletons.length).toBe(9);
    });

    it('renders custom number of items', () => {
      render(<SkeletonList items={5} />);

      const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
      // 5 items * (avatar + 2 lines) = 15
      expect(skeletons.length).toBe(15);
    });
  });

  describe('SkeletonTable', () => {
    it('renders default table structure', () => {
      render(<SkeletonTable />);

      const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
      // 4 headers + 5 rows * 4 cols = 24
      expect(skeletons.length).toBe(24);
    });

    it('renders custom table dimensions', () => {
      render(<SkeletonTable rows={2} cols={3} />);

      const skeletons = document.querySelectorAll('[data-slot="skeleton"]');
      // 3 headers + 2 rows * 3 cols = 9
      expect(skeletons.length).toBe(9);
    });
  });
});
