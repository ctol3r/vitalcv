import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, CheckCircle2, AlertCircle, FileText, Activity, Clock } from "lucide-react";
import axios from "axios";
import { cn } from "@/components/sandbox/lib/utils";

export interface Notification {
  id: string;
  type: "NEW_PACKET" | "STATUS_CHANGE";
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  npi?: string;
}

export default function EmployerNotifications({ orgId }: { orgId: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await axios.get("/api/employer/notifications", {
          headers: { "x-organization-id": orgId }
        });
        setNotifications(res.data.notifications || []);
      } catch {
        // fetch failed — notifications stay empty
      }
    };

    void fetchNotifications();

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}?orgId=${orgId}`;

    const connectWs = () => {
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        // connected
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'NOTIFICATION') {
            setNotifications(prev => [data.payload, ...prev]);
          }
        } catch (err) {
          console.error("Failed to parse WebSocket message", err);
        }
      };

      ws.onclose = () => {
        setTimeout(connectWs, 5000);
      };

      wsRef.current = ws;
    };

    connectWs();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [orgId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const markAsRead = async (ids: string[]) => {
    try {
      setLoading(true);
      await axios.post("/api/employer/notifications/read", { notificationIds: ids }, {
        headers: { "x-organization-id": orgId }
      });
      setNotifications((prev) =>
        prev.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n))
      );
    } catch (err) {
      console.error("Failed to mark notifications as read", err);
    } finally {
      setLoading(false);
    }
  };

  const markAllAsRead = () => {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length > 0) {
      markAsRead(unreadIds);
    }
  };

  const clearAllNotifications = async () => {
    try {
      setLoading(true);
      await axios.delete("/api/employer/notifications", {
        headers: { "x-organization-id": orgId }
      });
      setNotifications([]);
    } catch (err) {
      console.error("Failed to clear notifications", err);
    } finally {
      setLoading(false);
    }
  };

  const formatTimeAgo = (isoString: string) => {
    const diff = Date.now() - new Date(isoString).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 hover:bg-ink/5 rounded-full transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[var(--color-bg)]" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 mt-2 w-80 md:w-96 bg-[var(--color-bg)] border border-line shadow-2xl z-50 overflow-hidden flex flex-col"
          >
            <div className="p-4 border-b border-line flex justify-between items-center bg-ink/5">
              <h3 className="text-xs font-bold uppercase tracking-widest">Notifications</h3>
              <div className="flex items-center gap-3">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    disabled={loading}
                    className="text-[10px] font-mono opacity-60 hover:opacity-100 transition-opacity uppercase"
                  >
                    Mark all read
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={clearAllNotifications}
                    disabled={loading}
                    className="text-[10px] font-mono opacity-60 hover:text-red-500 transition-colors uppercase"
                  >
                    Clear All
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-[400px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center opacity-40">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-xs font-mono uppercase">No notifications</p>
                </div>
              ) : (
                <div className="flex flex-col">
                  {notifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => {
                        if (!notif.read) markAsRead([notif.id]);
                      }}
                      className={cn(
                        "p-4 border-b border-line last:border-0 hover:bg-ink/5 transition-colors cursor-pointer flex gap-3",
                        !notif.read ? "bg-ink/5" : "opacity-60"
                      )}
                    >
                      <div className="mt-0.5">
                        {notif.type === "NEW_PACKET" ? (
                          <FileText className="w-4 h-4 text-blue-500" />
                        ) : (
                          <Activity className="w-4 h-4 text-amber-500" />
                        )}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex justify-between items-start">
                          <h4 className="text-xs font-bold uppercase tracking-wider">
                            {notif.title}
                          </h4>
                          <span className="text-[10px] font-mono flex items-center gap-1 opacity-60">
                            <Clock className="w-3 h-3" />
                            {formatTimeAgo(notif.timestamp)}
                          </span>
                        </div>
                        <p className="text-[11px] font-mono leading-relaxed">
                          {notif.message}
                        </p>
                        {notif.npi && (
                          <div className="text-[10px] font-mono opacity-60 mt-2">
                            NPI: {notif.npi}
                          </div>
                        )}
                      </div>
                      {!notif.read && (
                        <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {notifications.length > 0 && (
              <div className="p-2 border-t border-line bg-ink/5 text-center">
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-[10px] font-bold uppercase tracking-widest opacity-60 hover:opacity-100 transition-opacity w-full py-2"
                >
                  Close
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
