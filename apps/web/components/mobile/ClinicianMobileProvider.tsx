'use client';

import * as React from 'react';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  normalizeClinicianMobilePayload,
  recomputeClinicianMobileData,
  type ClinicianMobileData,
  type ClinicianNotification,
} from '@/lib/mobile/clinician-state';
import { trackClinicianEventOncePerSession } from '@/lib/mobile/analytics';
import { upsertClinicianApplication, type MobileApplication, type MobileDashboardData } from '@/lib/mobile/dashboard';

interface ClinicianMobileContextValue {
  data: ClinicianMobileData;
  visibleNotifications: ClinicianNotification[];
  unreadNotifications: ClinicianNotification[];
  selectedOpportunityId: string | null;
  previousVisitAt: string | null;
  resumePath: string | null;
  dismissedNotificationIds: string[];
  readNotificationIds: string[];
  isRefreshing: boolean;
  isOffline: boolean;
  refreshError: string | null;
  refresh: () => Promise<void>;
  refreshTrustState: () => Promise<void>;
  selectOpportunity: (opportunityId: string | null) => void;
  dismissNotification: (notificationId: string) => void;
  markNotificationRead: (notificationId: string) => void;
  markAllNotificationsRead: () => void;
  clearDismissedNotifications: () => void;
  applySubmitted: (application: MobileApplication) => void;
}

const DASHBOARD_STORAGE_KEY = 'vitalcv.mobile.dashboard-cache';
const SELECTED_OPPORTUNITY_STORAGE_KEY = 'vitalcv.mobile.selected-opportunity';
const DISMISSED_NOTIFICATIONS_STORAGE_KEY = 'vitalcv.mobile.dismissed-notifications';
const READ_NOTIFICATIONS_STORAGE_KEY = 'vitalcv.mobile.read-notifications';
const LAST_VISIT_STORAGE_KEY = 'vitalcv.mobile.last-visit';
const RESUME_PATH_STORAGE_KEY = 'vitalcv.mobile.resume-path';
const REFRESH_THROTTLE_MS = 30_000;

const ClinicianMobileContext = createContext<ClinicianMobileContextValue | null>(null);

function parseTimestamp(value: string | null | undefined): number {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function toBaseData(data: ClinicianMobileData): MobileDashboardData {
  return {
    signedIn: data.signedIn,
    workspace: data.workspace,
    trustState: data.trustState,
    applications: data.applications,
    opportunities: data.opportunities,
    missingForHigherMatches: data.missingForHigherMatches,
    refreshedAt: data.refreshedAt,
  };
}

function shouldAdoptCachedDashboard(current: ClinicianMobileData, cached: ClinicianMobileData): boolean {
  const currentNpi = current.workspace?.personProfile?.npi ?? null;
  const cachedNpi = cached.workspace?.personProfile?.npi ?? null;

  if (currentNpi !== cachedNpi) {
    return false;
  }

  return parseTimestamp(cached.refreshedAt) > parseTimestamp(current.refreshedAt);
}

function preferFresherDashboard(current: ClinicianMobileData, incoming: ClinicianMobileData): ClinicianMobileData {
  return shouldAdoptCachedDashboard(incoming, current) ? current : incoming;
}

export function ClinicianMobileProvider({
  initialData,
  children,
}: {
  initialData: ClinicianMobileData;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamString = searchParams?.toString() ?? '';
  const [data, setData] = useState(initialData);
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string | null>(null);
  const [previousVisitAt, setPreviousVisitAt] = useState<string | null>(null);
  const [resumePath, setResumePath] = useState<string | null>(null);
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState<string[]>([]);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const refreshPromiseRef = useRef<Promise<void> | null>(null);
  const lastRefreshRequestAtRef = useRef(parseTimestamp(initialData.refreshedAt));

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const cachedPayload = window.localStorage.getItem(DASHBOARD_STORAGE_KEY);
    if (cachedPayload) {
      try {
        const cached = normalizeClinicianMobilePayload(JSON.parse(cachedPayload));
        if (cached && shouldAdoptCachedDashboard(initialData, cached)) {
          setData(cached);
        }
      } catch {
        window.localStorage.removeItem(DASHBOARD_STORAGE_KEY);
      }
    }

    const storedSelectedOpportunity = window.localStorage.getItem(SELECTED_OPPORTUNITY_STORAGE_KEY);
    if (storedSelectedOpportunity) {
      setSelectedOpportunityId(storedSelectedOpportunity);
    }

    const storedPreviousVisit = window.localStorage.getItem(LAST_VISIT_STORAGE_KEY);
    if (storedPreviousVisit) {
      setPreviousVisitAt(storedPreviousVisit);
    }
    window.localStorage.setItem(LAST_VISIT_STORAGE_KEY, new Date().toISOString());

    const storedResumePath = window.localStorage.getItem(RESUME_PATH_STORAGE_KEY);
    if (storedResumePath) {
      setResumePath(storedResumePath);
    }

    const storedDismissedNotifications = window.localStorage.getItem(DISMISSED_NOTIFICATIONS_STORAGE_KEY);
    if (storedDismissedNotifications) {
      try {
        const parsed = JSON.parse(storedDismissedNotifications) as unknown;
        if (Array.isArray(parsed)) {
          setDismissedNotificationIds(parsed.filter((value): value is string => typeof value === 'string'));
        }
      } catch {
        window.localStorage.removeItem(DISMISSED_NOTIFICATIONS_STORAGE_KEY);
      }
    }

    const storedReadNotifications = window.localStorage.getItem(READ_NOTIFICATIONS_STORAGE_KEY);
    if (storedReadNotifications) {
      try {
        const parsed = JSON.parse(storedReadNotifications) as unknown;
        if (Array.isArray(parsed)) {
          setReadNotificationIds(parsed.filter((value): value is string => typeof value === 'string'));
        }
      } catch {
        window.localStorage.removeItem(READ_NOTIFICATIONS_STORAGE_KEY);
      }
    }

    setIsOffline(typeof navigator !== 'undefined' ? !navigator.onLine : false);
  }, [initialData]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(DASHBOARD_STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (selectedOpportunityId) {
      window.localStorage.setItem(SELECTED_OPPORTUNITY_STORAGE_KEY, selectedOpportunityId);
      return;
    }

    window.localStorage.removeItem(SELECTED_OPPORTUNITY_STORAGE_KEY);
  }, [selectedOpportunityId]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(DISMISSED_NOTIFICATIONS_STORAGE_KEY, JSON.stringify(dismissedNotificationIds));
  }, [dismissedNotificationIds]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(READ_NOTIFICATIONS_STORAGE_KEY, JSON.stringify(readNotificationIds));
  }, [readNotificationIds]);

  useEffect(() => {
    if (!data.signedIn) {
      return;
    }

    const npi = data.workspace?.personProfile?.npi ?? 'unknown';
    void trackClinicianEventOncePerSession(`sign-in:${npi}`, 'clinician.sign_in', {
      npi,
    });
  }, [data.signedIn, data.workspace?.personProfile?.npi]);

  useEffect(() => {
    if (typeof window === 'undefined' || !pathname) {
      return;
    }

    const currentRoute = searchParamString
      ? `${pathname}?${searchParamString}`
      : pathname;

    if (pathname.startsWith('/holder') && pathname !== '/holder/home') {
      window.localStorage.setItem(RESUME_PATH_STORAGE_KEY, currentRoute);
      setResumePath(currentRoute);
    }
  }, [pathname, searchParamString]);

  const refresh = async () => {
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsOffline(true);
      setRefreshError('You are offline. Showing the last synced clinician state.');
      return Promise.resolve();
    }

    const request = (async () => {
      setIsRefreshing(true);
      setRefreshError(null);

      try {
        const response = await fetch('/api/mobile/dashboard', {
          cache: 'no-store',
          headers: {
            Accept: 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Mobile dashboard request failed (${response.status}).`);
        }

        const payload = normalizeClinicianMobilePayload(await response.json());
        if (!payload) {
          throw new Error('Mobile dashboard payload was invalid.');
        }

        setIsOffline(false);
        setData((current) => preferFresherDashboard(current, payload));
        lastRefreshRequestAtRef.current = Date.now();
      } catch (error) {
        setIsOffline(typeof navigator !== 'undefined' ? !navigator.onLine : false);
        setRefreshError(error instanceof Error ? error.message : 'Unable to refresh mobile state.');
      } finally {
        setIsRefreshing(false);
        refreshPromiseRef.current = null;
      }
    })();

    refreshPromiseRef.current = request;
    return request;
  };

  const refreshTrustState = async () => {
    const npi = data.workspace?.personProfile?.npi ?? null;
    if (!npi) {
      return;
    }

    setRefreshError(null);

    try {
      const response = await fetch(`/api/trust-state/${encodeURIComponent(npi)}/refresh`, {
        method: 'POST',
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`Trust refresh failed (${response.status}).`);
      }

      await refresh();
    } catch (error) {
      setRefreshError(error instanceof Error ? error.message : 'Unable to refresh trust state.');
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    function syncVisitTimestamp() {
      window.localStorage.setItem(LAST_VISIT_STORAGE_KEY, new Date().toISOString());
    }

    function maybeRefresh() {
      if (Date.now() - lastRefreshRequestAtRef.current < REFRESH_THROTTLE_MS) {
        return;
      }

      void refresh();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        maybeRefresh();
        return;
      }

      if (document.visibilityState === 'hidden') {
        syncVisitTimestamp();
      }
    }

    function handleOnline() {
      setIsOffline(false);
      setRefreshError(null);
    }

    function handleOffline() {
      setIsOffline(true);
      setRefreshError('You are offline. Showing the last synced clinician state.');
      syncVisitTimestamp();
    }

    window.addEventListener('focus', maybeRefresh);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('pagehide', syncVisitTimestamp);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', maybeRefresh);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('pagehide', syncVisitTimestamp);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const visibleNotifications = useMemo(
    () => data.notifications.filter((notification) => !dismissedNotificationIds.includes(notification.id)),
    [data.notifications, dismissedNotificationIds],
  );
  const unreadNotifications = useMemo(
    () => visibleNotifications.filter((notification) => !readNotificationIds.includes(notification.id)),
    [readNotificationIds, visibleNotifications],
  );

  const value = useMemo<ClinicianMobileContextValue>(() => ({
    data,
    visibleNotifications,
    unreadNotifications,
    selectedOpportunityId,
    previousVisitAt,
    resumePath,
    dismissedNotificationIds,
    readNotificationIds,
    isRefreshing,
    isOffline,
    refreshError,
    refresh,
    refreshTrustState,
    selectOpportunity: setSelectedOpportunityId,
    dismissNotification: (notificationId) => {
      setDismissedNotificationIds((current) => current.includes(notificationId)
        ? current
        : [...current, notificationId]);
    },
    markNotificationRead: (notificationId) => {
      setReadNotificationIds((current) => current.includes(notificationId)
        ? current
        : [...current, notificationId]);
    },
    markAllNotificationsRead: () => {
      setReadNotificationIds((current) => {
        const nextIds = new Set([...current, ...visibleNotifications.map((notification) => notification.id)]);
        return [...nextIds];
      });
    },
    clearDismissedNotifications: () => {
      setDismissedNotificationIds([]);
    },
    applySubmitted: (application) => {
      setData((current) => {
        const applications = upsertClinicianApplication(current.applications, application);
        const opportunities = current.opportunities.map((opportunity) => (
          opportunity.id === application.opportunityId
            ? { ...opportunity, application }
            : opportunity
        ));

        return recomputeClinicianMobileData({
          base: {
            ...toBaseData(current),
            applications,
            opportunities,
            refreshedAt: new Date().toISOString(),
          },
          profileCompleteness: current.profileCompleteness,
          trustHistory: current.trustHistory,
          proof: current.proof,
        });
      });

      setSelectedOpportunityId(application.opportunityId);
      lastRefreshRequestAtRef.current = Date.now();
    },
  }), [
    data,
    dismissedNotificationIds,
    isRefreshing,
    isOffline,
    previousVisitAt,
    readNotificationIds,
    refreshError,
    resumePath,
    selectedOpportunityId,
    unreadNotifications,
    visibleNotifications,
  ]);

  return (
    <ClinicianMobileContext.Provider value={value}>
      {children}
    </ClinicianMobileContext.Provider>
  );
}

export function useClinicianMobile() {
  const context = useContext(ClinicianMobileContext);
  if (!context) {
    throw new Error('useClinicianMobile must be used within a ClinicianMobileProvider.');
  }

  return context;
}
