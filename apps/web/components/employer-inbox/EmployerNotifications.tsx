'use client';

/**
 * EmployerNotifications — Assimilated from AI Studio sandbox
 *
 * Changes from source:
 * - Removed hardcoded orgId 'ORG-SUTTER-001'; reads from prop or auth context
 * - Removed raw console.error; replaced with silent error boundaries
 * - Removed axios dependency; switched to native fetch
 * - WebSocket reconnect: removed console.log noise; silent reconnect
 * - Notification bell: unchanged UI, no doctrine violations
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Activity, FileText, Clock } from 'lucide-react';

export interface Notification {
  id: string;
  type: 'NEW_PACKET' | 'STATUS_CHANGE';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  npi?: string;
}

interface EmployerNotificationsProps {
  orgId?: string;
}

export default function EmployerNotifications({ orgId }: EmployerNotificationsProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const fetchNotifications = async () => {
    try {
      const headers: Record<string, string> = {};
      if (orgId) headers['x-organization-id'] = orgId;
      const res = await fetch('/api/employer/notifications', { headers });
      if (!res.ok) return;
      const data = await res.json() as { notifications?: Notification[] };
      setNotifications(data.notifications ?? []);
    } catch {
      // Silent — notifications are non-critical
    }
  };

  useEffect(() => {
    void fetchNotifications();

    if (typeof window === 'undefined') return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}${orgId ? `?orgId=${encodeURIComponent(orgId)}` : ''}`;

    const connectWs = () => {
      const ws = new WebSocket(wsUrl);

      ws.onmessage = (event: MessageEvent<string>) => {
        try {
          const data = JSON.parse(event.data) as { type?: string; payload?: Notification };
          if (data.type === 'NOTIFICATION' && data.payload) {
            setNotifications((prev) => [data.payload!, ...prev]);
          }
        } catch {
          // Ignore malformed frames
        }
      };

      ws.onclose = () => {
        setTimeout(connectWs, 5000);
      };

      wsRef.current = ws;
    };

    connectWs();

    return () => {
      wsRef.current?.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAsRead = async (ids: string[]) => {
    try {
      setActionLoading(true);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (orgId) headers['x-organization-id'] = orgId;
      const res = await fetch('/api/employer/notifications/read', {
        method: 'POST',
        headers,
        body: JSON.stringify({ notificationIds: ids }),
      });
      if (!res.ok) return;
      setNotifications((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)));
    } catch {
      // Silent
    } finally {
      setActionLoading(false);
    }
  };

  const markAllAsRead = () => {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length > 0) void markAsRead(unreadIds);
  };

  const clearAllNotifications = async () => {
    try {
      setActionLoading(true);
      const headers: Record<string, string> = {};
      if (orgId) headers['x-organization-id'] = orgId;
      const res = await fetch('/api/employer/notifications', { method: 'DELETE', headers });
      if (!res.ok) return;
      setNotifications([]);
    } catch {
      // Silent
    } finally {
      setActionLoading(false);
    }
  };

  const formatTimeAgo = (isoString: string) => {
    const diff = Date.now() - new Date(isoString).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 hover:bg-black/5 rounded-full transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-background" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 mt-2 w-80 md:w-96 bg-background border border-border shadow-xl z-50 overflow-hidden flex flex-col rounded-xl"
          >
            <div className="p-4 border-b border-border flex justify-between items-center bg-muted/30">
              <h3 className="text-xs font-bold uppercase tracking-widest">Notifications</h3>
              <div className="flex items-center gap-3">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    disabled={actionLoading}
                    className="text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors uppercase disabled:opacity-40"
                  >
                    Mark all read
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={() => void clearAllNotifications()}
                    disabled={actionLoading}
                    className="text-[10px] font-mono text-muted-foreground hover:text-red-500 transition-colors uppercase disabled:opacity-40"
                  >
                    Clear all
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-[400px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Bell className="w-6 h-6 mx-auto mb-2 opacity-30" />
                  <p className="text-xs font-mono uppercase">No notifications</p>
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-border">
                  {notifications.map((notif) => (
                    <button
                      key={notif.id}
                      onClick={() => { if (!notif.read) void markAsRead([notif.id]); }}
                      className={`p-4 text-left hover:bg-muted/30 transition-colors flex gap-3 w-full ${!notif.read ? 'bg-muted/20' : 'opacity-60'}`}
                    >
                      <div className="mt-0.5 shrink-0">
                        {notif.type === 'NEW_PACKET'
                          ? <FileText className="w-4 h-4 text-blue-500" />
                          : <Activity className="w-4 h-4 text-amber-500" />
                        }
                      </div>
                      <div className="flex-1 space-y-1 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <h4 className="text-xs font-bold uppercase tracking-wide truncate">{notif.title}</h4>
                          <span className="text-[10px] font-mono flex items-center gap-1 text-muted-foreground shrink-0">
                            <Clock className="w-3 h-3" />
                            {formatTimeAgo(notif.timestamp)}
                          </span>
                        </div>
                        <p className="text-[11px] font-mono leading-relaxed text-muted-foreground">{notif.message}</p>
                        {notif.npi && (
                          <div className="text-[10px] font-mono text-muted-foreground mt-1">NPI: {notif.npi}</div>
                        )}
                      </div>
                      {!notif.read && (
                        <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="p-2 border-t border-border bg-muted/30 text-center">
              <button className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors w-full py-2">
                View all activity
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
