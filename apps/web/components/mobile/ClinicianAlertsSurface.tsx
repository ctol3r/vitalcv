'use client';

import * as React from 'react';
import { BellRing, RefreshCw } from 'lucide-react';
import { NotificationList } from '@/components/mobile/ClinicianPanels';
import { ClinicianStatusBanner } from '@/components/mobile/ClinicianStatusBanner';
import { ClinicianSupportCard } from '@/components/mobile/ClinicianSupportCard';
import { useClinicianMobile } from '@/components/mobile/ClinicianMobileProvider';
import { trackClinicianEventOncePerSession } from '@/lib/mobile/analytics';

export default function ClinicianAlertsSurface() {
  const {
    data,
    visibleNotifications,
    unreadNotifications,
    readNotificationIds,
    previousVisitAt,
    markAllNotificationsRead,
    isRefreshing,
    refreshError,
    refresh,
  } = useClinicianMobile();

  const npi = data.workspace?.personProfile?.npi ?? 'unknown';
  const previousVisitMs = previousVisitAt ? Date.parse(previousVisitAt) : 0;
  const changedSinceLastVisit = previousVisitMs > 0
    ? visibleNotifications.filter((notification) => Date.parse(notification.occurredAt) > previousVisitMs)
    : [];

  React.useEffect(() => {
    void trackClinicianEventOncePerSession(`alerts:${npi}`, 'clinician.alert_viewed', {
      npi,
      alertCount: visibleNotifications.length,
    });
  }, [npi, visibleNotifications.length]);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 pb-28 pt-6 sm:px-6 sm:pb-12 lg:px-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-100">
            <BellRing className="h-3.5 w-3.5" />
            Alert center
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">Alerts</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">
            Recent notifications about your application progress and readiness state.
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
          title="Alerts could not refresh"
          detail={refreshError}
          actionHref="/holder/home"
          actionLabel="Return home"
        />
      ) : null}

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Unread</p>
          <p className="mt-2 text-3xl font-semibold text-white">{unreadNotifications.length}</p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Read</p>
          <p className="mt-2 text-3xl font-semibold text-white">{readNotificationIds.length}</p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Since last visit</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-100">{changedSinceLastVisit.length}</p>
        </div>
      </section>

      <NotificationList
        notifications={visibleNotifications}
        heading="Live notifications"
        description="Important updates route you directly into readiness history, blocker resolution, or the related application detail."
      />

      <ClinicianSupportCard
        topic="alerts"
        detail="If you see an alert you don't understand, or if you feel blocked, review your readiness details or contact support for assistance."
        primaryHref="/holder/readiness"
        primaryLabel="Open readiness"
      />
    </main>
  );
}
