'use client';

import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DemoHeader } from '@/apps/web/src/components/layout/DemoHeader';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '@/components/ui/pagination';
import { getJSON, postJSON } from '@/components/api/http';
import { Notification } from '@/apps/web/src/components/notifications/NotificationDropdown';

type NotificationType = 'all' | 'privilege' | 'job' | 'payer' | 'psv';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<NotificationType>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          page: page.toString(),
          limit: itemsPerPage.toString(),
        });
        if (filter !== 'all') {
          params.append('type', filter);
        }
        const data = await getJSON<{ notifications: Notification[]; total: number }>(
          `/api/me/notifications?${params.toString()}`
        );
        // Handle both array response and object with notifications array
        if (Array.isArray(data)) {
          setNotifications(data);
          setTotalPages(Math.ceil(data.length / itemsPerPage));
        } else {
          setNotifications(data.notifications || []);
          setTotalPages(Math.ceil((data.total || 0) / itemsPerPage));
        }
      } catch (error) {
        console.error('Failed to fetch notifications:', error);
        setNotifications([]);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, [filter, page]);

  const handleMarkAllRead = async () => {
    try {
      await postJSON('/api/me/notifications/mark-all-read', {});
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await postJSON(`/api/me/notifications/${id}/read`, {});
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
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

  const getNotificationTypeColor = (type: Notification['type']) => {
    switch (type) {
      case 'privilege':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'job':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'payer':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'psv':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <DemoHeader
        title="Notifications"
        description="Scoped to your active organization. Alerts combine privileges, jobs, payer enrollments, and PSV monitoring."
      />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Notifications</CardTitle>
            {unreadCount > 0 && (
              <Button onClick={handleMarkAllRead} variant="outline" size="sm">
                Mark all as read
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={filter} onValueChange={(value) => {
            setFilter(value as NotificationType);
            setPage(1);
          }}>
            <TabsList className="mb-4">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="privilege">Privilege</TabsTrigger>
              <TabsTrigger value="job">Job</TabsTrigger>
              <TabsTrigger value="payer">Payer</TabsTrigger>
              <TabsTrigger value="psv">PSV</TabsTrigger>
            </TabsList>

            {loading ? (
              <div className="py-8 text-center text-muted-foreground">
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                No notifications found
              </div>
            ) : (
              <>
                <div className="space-y-2" role="list" aria-label="Notifications list">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      role="listitem"
                      className={`p-4 rounded-lg border transition-colors ${
                        !notification.read
                          ? 'bg-accent border-primary/20'
                          : 'bg-background border-border'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge
                              variant="outline"
                              className={getNotificationTypeColor(notification.type)}
                            >
                              {getNotificationTypeLabel(notification.type)}
                            </Badge>
                            {!notification.read && (
                              <span
                                className="h-2 w-2 rounded-full bg-primary"
                                aria-label="Unread"
                              />
                            )}
                          </div>
                          <p className="text-sm text-foreground mb-2">{notification.message}</p>
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(notification.timestamp), {
                                addSuffix: true,
                              })}
                            </p>
                            <div className="flex items-center gap-2">
                              {!notification.read && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleMarkAsRead(notification.id)}
                                  className="text-xs"
                                >
                                  Mark as read
                                </Button>
                              )}
                              {notification.link && (
                                <Link href={notification.link}>
                                  <Button variant="outline" size="sm" className="text-xs">
                                    View
                                  </Button>
                                </Link>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="mt-6">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              if (page > 1) setPage(page - 1);
                            }}
                            aria-disabled={page === 1}
                            className={page === 1 ? 'pointer-events-none opacity-50' : ''}
                          />
                        </PaginationItem>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                          if (
                            pageNum === 1 ||
                            pageNum === totalPages ||
                            (pageNum >= page - 1 && pageNum <= page + 1)
                          ) {
                            return (
                              <PaginationItem key={pageNum}>
                                <PaginationLink
                                  href="#"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    setPage(pageNum);
                                  }}
                                  isActive={pageNum === page}
                                >
                                  {pageNum}
                                </PaginationLink>
                              </PaginationItem>
                            );
                          } else if (pageNum === page - 2 || pageNum === page + 2) {
                            return (
                              <PaginationItem key={pageNum}>
                                <PaginationEllipsis />
                              </PaginationItem>
                            );
                          }
                          return null;
                        })}
                        <PaginationItem>
                          <PaginationNext
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              if (page < totalPages) setPage(page + 1);
                            }}
                            aria-disabled={page === totalPages}
                            className={
                              page === totalPages ? 'pointer-events-none opacity-50' : ''
                            }
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </>
            )}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

