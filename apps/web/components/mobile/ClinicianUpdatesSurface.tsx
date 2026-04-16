'use client';

import * as React from 'react';
import { BellRing, RefreshCw } from 'lucide-react';
import { ApplicationList, NotificationList } from '@/components/mobile/ClinicianPanels';
import { ClinicianStatusBanner } from '@/components/mobile/ClinicianStatusBanner';
import { ClinicianSupportCard } from '@/components/mobile/ClinicianSupportCard';
import { useClinicianMobile } from '@/components/mobile/ClinicianMobileProvider';
import { trackClinicianEventOncePerSession } from '@/lib/mobile/analytics';

export default function ClinicianUpdatesSurface() {
  const {
    data,
    visibleNotifications,
    unreadNotifications,
    dismissedNotificationIds,
    markAllNotificationsRead,
    clearDismissedNotifications,
    isRefreshing,
    refreshError,
    refresh,
  } = useClinicianMobile();
  const npi = data.workspace?.personProfile?.npi ?? 'unknown';
  const applicationNotifications = visibleNotifications.filter((notification) => Boolean(notification.relatedApplicationId));

  React.useEffect(() => {
    void trackClinicianEventOncePerSession(`application-status:${npi}`, 'clinician.application_status_viewed', {
      npi,
      applicationCount: data.activeApplications.length,
      alertCount: applicationNotifications.length,
    });
  }, [applicationNotifications.length, data.activeApplications.length, npi]);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 pb-28 pt-6 sm:px-6 sm:pb-12 lg:px-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-100">
            <BellRing className="h-3.5 w-3.5" />
            Status and alerts
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">Updates</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">
            Readiness changes, blockers, and live application status stay together here so return visits never feel disconnected.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {unreadNotifications.length > 0 ? (
            <button
              type="button"
              onClick={markAllNotificationsRead}
              className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/[0.08]"
            >
              Mark all read
            </button>
          ) : null}
          {dismissedNotificationIds.length > 0 ? (
            <button
              type="button"
              onClick={clearDismissedNotifications}
              className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/[0.08]"
            >
              Restore dismissed
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={isRefreshing}
            aria-busy={isRefreshing}
            className="inline-flex min-h-12 touch-manipulation items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </header>

      {refreshError ? (
        <ClinicianStatusBanner
          tone="error"
          title="Updates could not refresh"
          detail={refreshError}
          actionHref="/holder/opportunities"
          actionLabel="Return to roles"
        />
      ) : null}

      <NotificationList
        notifications={visibleNotifications}
        heading="Recent updates"
        description="Application movement, blocker changes, and readiness notifications are kept in one stream. Dismissal persists on this device until you restore items."
        dismissible
      />

      <ApplicationList
        applications={data.activeApplications}
        heading="Applications in motion"
        description="Submitted applications keep their employer context, readiness snapshot, and next-step links attached."
      />

      <ClinicianSupportCard
        topic="applications"
        detail="If an application status looks stuck or missing, refresh once and then open the source role before contacting support with the employer and role name."
        primaryHref="/holder/opportunities"
        primaryLabel="Open live roles"
      />
    </main>
  );
}
