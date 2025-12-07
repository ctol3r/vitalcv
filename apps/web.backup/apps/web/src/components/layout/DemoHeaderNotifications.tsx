'use client';

import { Bell } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { NotificationDropdown } from '../notifications/NotificationDropdown';
import { getJSON } from '@/components/api/http';

interface NotificationCount {
  count: number;
}

export function DemoHeaderNotifications() {
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        setLoading(true);
        const data = await getJSON<NotificationCount[]>('/api/me/notifications?onlyUnread=true');
        // If API returns array, count length; if it returns object with count, use that
        const count = Array.isArray(data) ? data.length : (data as any)?.count || 0;
        setUnreadCount(count);
      } catch (error) {
        console.error('Failed to fetch unread notifications:', error);
        setUnreadCount(0);
      } finally {
        setLoading(false);
      }
    };

    fetchUnreadCount();
    // Poll for updates every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
        aria-expanded={isOpen}
        className="relative"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {!loading && unreadCount > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center px-1 text-xs"
            aria-label={`${unreadCount} unread notifications`}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
        <span className="sr-only">Notifications</span>
      </Button>
      {isOpen && (
        <NotificationDropdown
          onClose={() => setIsOpen(false)}
          onNotificationRead={() => {
            // Refresh count when a notification is marked as read
            setUnreadCount((prev) => Math.max(0, prev - 1));
          }}
        />
      )}
    </div>
  );
}

