'use client';

/**
 * EmployerNotifications — Bell icon + dropdown for employer-facing alerts.
 *
 * Assimilated from vitalcv-ai-sandbox. Uses polling (not WebSocket) because
 * Vercel Functions are stateless and cannot hold persistent connections.
 *
 * Truth Doctrine: All fake org IDs, hardcoded clinician names, and heavy
 * decoration have been stripped. Accepts notifications via props or fetches
 * from an API endpoint with configurable polling.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  Bell,
  Clock,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// ── Types ────────────────────────────────────────────────────────

export interface EmployerNotification {
  id: string;
  type: 'NEW_PACKET' | 'STATUS_CHANGE';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  npi?: string;
}

interface EmployerNotificationsProps {
  /** Pre-loaded notifications. When provided, polling is disabled. */
  notifications?: EmployerNotification[];
  /** API endpoint to poll for notifications. Defaults to /api/employer/notifications. */
  endpoint?: string;
  /** Polling interval in ms. Defaults to 30 000 (30s). Set to 0 to disable. */
  pollInterval?: number;
  /** Called when a notification is clicked. */
  onNotificationClick?: (notification: EmployerNotification) => void;
  /** Called when "View All Activity" is clicked. */
  onViewAll?: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────

function formatTimeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ── Component ────────────────────────────────────────────────────

export function EmployerNotifications({
  notifications: externalNotifications,
  endpoint = '/api/employer/notifications',
  pollInterval = 30_000,
  onNotificationClick,
  onViewAll,
}: EmployerNotificationsProps) {
  const [internalNotifications, setInternalNotifications] = useState<
    EmployerNotification[]
  >([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const notifications = externalNotifications ?? internalNotifications;
  const unreadCount = notifications.filter((n) => !n.read).length;

  // ── Fetch & poll ────────────────────────────────────────────

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch(endpoint);
      if (!res.ok) return;
      const data = await res.json();
      setInternalNotifications(data.notifications ?? []);
    } catch {
      // Silently degrade — notification bell stays empty
    }
  }, [endpoint]);

  useEffect(() => {
    // Skip polling when notifications are provided externally
    if (externalNotifications) return;

    fetchNotifications();

    if (pollInterval <= 0) return;

    const interval = setInterval(fetchNotifications, pollInterval);
    return () => clearInterval(interval);
  }, [externalNotifications, fetchNotifications, pollInterval]);

  // ── Click-outside ───────────────────────────────────────────

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Actions ─────────────────────────────────────────────────

  const markAsRead = async (ids: string[]) => {
    try {
      setLoading(true);
      await fetch(`${endpoint}/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationIds: ids }),
      });
      setInternalNotifications((prev) =>
        prev.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)),
      );
    } catch {
      // Fail open — notification stays unread
    } finally {
      setLoading(false);
    }
  };

  const markAllAsRead = () => {
    const unreadIds = notifications
      .filter((n) => !n.read)
      .map((n) => n.id);
    if (unreadIds.length > 0) markAsRead(unreadIds);
  };

  const clearAll = async () => {
    try {
      setLoading(true);
      await fetch(endpoint, { method: 'DELETE' });
      setInternalNotifications([]);
    } catch {
      // Fail open
    } finally {
      setLoading(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full border-2 border-background bg-destructive" />
        )}
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute right-0 z-50 mt-2 flex w-80 flex-col overflow-hidden rounded-lg border border-border bg-background shadow-sm md:w-96"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border bg-muted/30 p-4">
              <h3 className="text-xs font-bold uppercase tracking-widest">
                Notifications
              </h3>
              <div className="flex items-center gap-3">
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={markAllAsRead}
                    disabled={loading}
                    className="h-auto px-1 py-0 text-[10px] uppercase tracking-widest text-muted-foreground"
                  >
                    Mark all read
                  </Button>
                )}
                {notifications.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAll}
                    disabled={loading}
                    className="h-auto px-1 py-0 text-[10px] uppercase tracking-widest text-muted-foreground hover:text-destructive"
                  >
                    Clear All
                  </Button>
                )}
              </div>
            </div>

            {/* List */}
            <div className="max-h-[400px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Bell
                    className="mx-auto mb-2 h-8 w-8 opacity-50"
                    aria-hidden="true"
                  />
                  <p className="font-mono text-xs uppercase">
                    No notifications
                  </p>
                </div>
              ) : (
                <div className="flex flex-col">
                  {notifications.map((notif) => (
                    <div
                      key={notif.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        if (!notif.read) markAsRead([notif.id]);
                        onNotificationClick?.(notif);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          if (!notif.read) markAsRead([notif.id]);
                          onNotificationClick?.(notif);
                        }
                      }}
                      className={cn(
                        'flex cursor-pointer gap-3 border-b border-border p-4 transition-colors last:border-0 hover:bg-muted/50',
                        !notif.read ? 'bg-muted/30' : 'opacity-60',
                      )}
                    >
                      <div className="mt-0.5">
                        {notif.type === 'NEW_PACKET' ? (
                          <FileText className="h-4 w-4 text-blue-500" />
                        ) : (
                          <Activity className="h-4 w-4 text-amber-500" />
                        )}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-start justify-between">
                          <h4 className="text-xs font-bold uppercase tracking-wider">
                            {notif.title}
                          </h4>
                          <span className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                            <Clock className="h-3 w-3" aria-hidden="true" />
                            {formatTimeAgo(notif.timestamp)}
                          </span>
                        </div>
                        <p className="font-mono text-[11px] leading-relaxed">
                          {notif.message}
                        </p>
                        {notif.npi && (
                          <div className="mt-2 font-mono text-[10px] text-muted-foreground">
                            NPI: {notif.npi}
                          </div>
                        )}
                      </div>
                      {!notif.read && (
                        <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-border bg-muted/30 p-2 text-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsOpen(false);
                  onViewAll?.();
                }}
                className="w-full text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
              >
                View All Activity
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
