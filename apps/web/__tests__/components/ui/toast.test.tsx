'use client';

import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from '@/components/ui/toast';
import { jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';

function renderWithToastProvider(ui: React.ReactElement) {
  return render(
    <ToastProvider>
      {ui}
      <ToastViewport />
    </ToastProvider>,
  );
}

describe('Toast Components', () => {
  describe('Toast', () => {
    it('renders with default variant', () => {
      renderWithToastProvider(
        <Toast data-testid="toast">
          <ToastTitle>Test Title</ToastTitle>
        </Toast>,
      );

      const toast = screen.getByTestId('toast');
      expect(toast).toBeInTheDocument();
      expect(screen.getByText('Test Title')).toBeInTheDocument();
    });

    it('renders with success variant', () => {
      renderWithToastProvider(
        <Toast variant="success" data-testid="toast">
          <ToastTitle>Success</ToastTitle>
        </Toast>,
      );

      const toast = screen.getByTestId('toast');
      expect(toast).toHaveClass('border-green-200', 'bg-green-50', 'text-green-800');
    });

    it('renders with destructive variant', () => {
      renderWithToastProvider(
        <Toast variant="destructive" data-testid="toast">
          <ToastTitle>Error</ToastTitle>
        </Toast>,
      );

      const toast = screen.getByTestId('toast');
      expect(toast).toHaveClass('destructive');
    });
  });

  describe('ToastTitle', () => {
    it('renders title correctly', () => {
      render(<ToastTitle>Test Title</ToastTitle>);

      expect(screen.getByText('Test Title')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<ToastTitle className="custom-class">Title</ToastTitle>);

      const title = screen.getByText('Title');
      expect(title).toHaveClass('custom-class');
    });
  });

  describe('ToastDescription', () => {
    it('renders description correctly', () => {
      render(<ToastDescription>Test description</ToastDescription>);

      expect(screen.getByText('Test description')).toBeInTheDocument();
    });

    it('has correct styling classes', () => {
      render(<ToastDescription>Description</ToastDescription>);

      const description = screen.getByText('Description');
      expect(description).toHaveClass('text-xs', 'opacity-90');
    });
  });

  describe('ToastClose', () => {
    it('renders close button', () => {
      render(<ToastClose />);

      const closeButton = screen.getByRole('button');
      expect(closeButton).toBeInTheDocument();
    });

    it('handles click events', () => {
      const handleClick = jest.fn();
      render(<ToastClose onClick={handleClick} />);

      const closeButton = screen.getByRole('button');
      fireEvent.click(closeButton);

      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Complete Toast', () => {
    it('renders complete toast with all components', () => {
      renderWithToastProvider(
        <Toast>
          <div className="grid gap-1">
            <ToastTitle>Success</ToastTitle>
            <ToastDescription>Operation completed successfully</ToastDescription>
          </div>
          <ToastClose />
        </Toast>,
      );

      expect(screen.getByText('Success')).toBeInTheDocument();
      expect(screen.getByText('Operation completed successfully')).toBeInTheDocument();
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });
});
