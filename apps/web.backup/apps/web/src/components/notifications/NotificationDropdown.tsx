'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getJSON, postJSON } from '@/components/api/http';

export interface Notification {
  id: string;
  type: 'privilege' | 'job' | 'payer' | 'psv';
  message: string;
  timestamp: string;
  read: boolean;
  link?: string;
}

interface NotificationDropdownProps {
  onClose?: () => void;
  onNotificationRead?: () => void;
}

export function NotificationDropdown({
  onClose,
  onNotificationRead,
}: NotificationDropdownProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        setLoading(true);
        const data = await getJSON<Notification[]>('/api/me/notifications?limit=10');
        setNotifications(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to fetch notifications:', error);
        setNotifications([]);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, []);

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      try {
        await postJSON(`/api/me/notifications/${notification.id}/read`, {});
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
        );
        onNotificationRead?.();
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
      }
    }

    if (notification.link) {
      // Small delay to allow the read request to complete
      setTimeout(() => {
        window.location.href = notification.link!;
      }, 100);
    }
  };

  const getNotificationTypeLabel = (type: Notification['type']) => {
    switch (type) {
      case 'privilege':
        return 'Privilege';
      case 'job':
        return 'Job';
      case 'payer':
        return 'Payer';
      case 'psv':
        return 'PSV';
      default:
        return 'Notification';
    }
  };

  return (
    <div className="absolute right-0 top-full mt-2 w-80 z-50">
      <Card className="shadow-lg">
        <CardContent className="p-0">
          <div className="p-3 border-b">
            <h3 className="font-semibold text-sm">Notifications</h3>
          </div>
          <ScrollArea className="h-[400px]">
            {loading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Loading...
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No notifications
              </div>
            ) : (
              <div className="divide-y">
                {notifications.map((notification) => (
                  <button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className="w-full text-left p-3 hover:bg-accent transition-colors focus:outline-none focus:bg-accent"
                    aria-label={`${getNotificationTypeLabel(notification.type)}: ${notification.message}`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-muted-foreground">
                            {getNotificationTypeLabel(notification.type)}
                          </span>
                          {!notification.read && (
                            <span className="h-2 w-2 rounded-full bg-primary" aria-label="Unread" />
                          )}
                        </div>
                        <p className="text-sm text-foreground line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(notification.timestamp), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
          {notifications.length > 0 && (
            <div className="p-3 border-t">
              <Link
                href="/demo/notifications"
                onClick={onClose}
                className="text-sm text-primary hover:underline"
              >
                View all notifications
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

