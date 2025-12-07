'use client';

import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { toast as toastFn } from '@/hooks/use-toast';

export interface ToastNotification {
  id: string;
  type: 'privilege' | 'job' | 'payer' | 'psv' | 'success' | 'info' | 'error';
  message: string;
  title?: string;
  link?: string;
}

interface ToastsProps {
  notifications?: ToastNotification[];
}

/**
 * Toast notifications component that displays transient notifications
 * with aria-live announcements for accessibility
 */
export function Toasts({ notifications = [] }: ToastsProps) {
  const { toast } = useToast();

  useEffect(() => {
    // This component is primarily for displaying toasts triggered elsewhere
    // The actual toast rendering is handled by the Toaster component in the layout
  }, []);

  return null; // Toasts are rendered by the Toaster component in layout
}

/**
 * Helper function to show toast notifications
 * Call this from other components when actions complete
 */
export function showNotificationToast(
  notification: Omit<ToastNotification, 'id'>,
  toastFn: ReturnType<typeof useToast>['toast']
) {
  const getToastVariant = (type: ToastNotification['type']) => {
    switch (type) {
      case 'success':
      case 'privilege':
      case 'job':
      case 'payer':
      case 'psv':
        return 'success';
      case 'error':
        return 'destructive';
      default:
        return 'default';
    }
  };

  const getToastTitle = (type: ToastNotification['type'], title?: string) => {
    if (title) return title;
    switch (type) {
      case 'privilege':
        return 'Privilege Update';
      case 'job':
        return 'Job Update';
      case 'payer':
        return 'Payer Update';
      case 'psv':
        return 'PSV Complete';
      case 'success':
        return 'Success';
      case 'error':
        return 'Error';
      default:
        return 'Notification';
    }
  };

  toastFn({
    title: getToastTitle(notification.type, notification.title),
    description: notification.message,
    variant: getToastVariant(notification.type),
    duration: 5000,
  });
}

/**
 * Hook to show toast when certain actions complete
 * Usage: showToastOnAction('psv', 'PSV verification completed successfully')
 */
export function useNotificationToasts() {
  const { toast } = useToast();

  const showToast = (notification: Omit<ToastNotification, 'id'>) => {
    showNotificationToast(notification, toast);
  };

  return { showToast };
}

