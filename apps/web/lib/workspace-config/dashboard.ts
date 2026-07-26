/**
 * Dynamic dashboard projections (Wave 1300, C5)
 * ──────────────────────────────────────────────────────────────────────────
 * Config-driven dashboards. A dashboard is a list of widgets, each bound to a
 * Career Model section. Widgets are resolved against a ROLE PROJECTION, so a
 * widget can only ever show data the role is permitted to see — a widget bound
 * to a hidden section resolves to `hidden`, never to fabricated data. Widget
 * values are pass-through; the dashboard never alters or inflates them.
 *
 * Pure: a projection over an already role-scoped model.
 */
import type { CareerSection, RoleProjection } from './roles';

export type WidgetType = 'summary' | 'list' | 'metric';

export interface WidgetConfig {
  widgetId: string;
  title: string;
  type: WidgetType;
  /** The Career Model section this widget draws from. */
  source: CareerSection;
}

export interface DashboardConfig {
  dashboardId: string;
  label: string;
  /** Roles permitted to view this dashboard. */
  roleIds: string[];
  widgets: WidgetConfig[];
}

export interface ResolvedWidget {
  widgetId: string;
  title: string;
  type: WidgetType;
  source: CareerSection;
  /** 'ok' when the role can see the source section, else 'hidden'. */
  status: 'ok' | 'hidden';
  /** Section data by reference when visible; null when hidden. */
  data: unknown;
}

export interface DashboardProjection {
  dashboardId: string;
  label: string;
  roleId: string;
  widgets: ResolvedWidget[];
}

/**
 * Resolve a dashboard for a role projection. A widget whose source section is
 * not visible to the role resolves to `hidden` with null data — never invented
 * content. Visible widgets carry the section data by reference, unchanged.
 */
export function projectDashboard(config: DashboardConfig, projection: RoleProjection): DashboardProjection {
  const visible = new Set(projection.visibleSections);
  const widgets: ResolvedWidget[] = config.widgets.map((w) => {
    const isVisible = visible.has(w.source);
    return {
      widgetId: w.widgetId,
      title: w.title,
      type: w.type,
      source: w.source,
      status: isVisible ? 'ok' : 'hidden',
      data: isVisible ? (projection.sections as Record<CareerSection, unknown>)[w.source] ?? null : null,
    };
  });
  return { dashboardId: config.dashboardId, label: config.label, roleId: projection.roleId, widgets };
}
