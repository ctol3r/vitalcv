import prisma from '../src/graphql/prisma_client';
import type { TrustAlert } from '../src/services/alerts/trustAlerts';

export interface TrustAlertsRepository {
  seedDefaults(alerts: readonly TrustAlert[]): Promise<void>;
  listAlerts(): Promise<TrustAlert[]>;
  createAlert(alert: TrustAlert): Promise<TrustAlert>;
  acknowledgeAlert(alertId: string, acknowledgedAt: string): Promise<TrustAlert | null>;
  getAlert(alertId: string): Promise<TrustAlert | null>;
}

type TrustAlertRow = {
  alertId: string;
  type: string;
  severity: string;
  title: string;
  description: string;
  credentialId: string | null;
  issuerId: string | null;
  subject: string | null;
  recommendedAction: string;
  acknowledged: boolean;
  acknowledgedAt: Date | null;
  createdAt: Date;
};

function toDomainAlert(row: TrustAlertRow): TrustAlert {
  return {
    alertId: row.alertId,
    type: row.type as TrustAlert['type'],
    severity: row.severity as TrustAlert['severity'],
    title: row.title,
    description: row.description,
    ...(row.credentialId ? { credentialId: row.credentialId } : {}),
    ...(row.issuerId ? { issuerId: row.issuerId } : {}),
    ...(row.subject ? { subject: row.subject } : {}),
    recommendedAction: row.recommendedAction,
    acknowledged: row.acknowledged,
    createdAt: row.createdAt.toISOString(),
    ...(row.acknowledgedAt ? { acknowledgedAt: row.acknowledgedAt.toISOString() } : {}),
  };
}

function sortAlerts(alerts: readonly TrustAlert[]): TrustAlert[] {
  return [...alerts].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
}

export class PrismaTrustAlertsRepository implements TrustAlertsRepository {
  async seedDefaults(alerts: readonly TrustAlert[]): Promise<void> {
    for (const alert of alerts) {
      const existing = await prisma.trustAlertRecord.findUnique({
        where: { alertId: alert.alertId },
        select: { alertId: true },
      });
      if (existing) {
        continue;
      }

      await prisma.trustAlertRecord.create({
        data: {
          alertId: alert.alertId,
          type: alert.type,
          severity: alert.severity,
          title: alert.title,
          description: alert.description,
          credentialId: alert.credentialId ?? null,
          issuerId: alert.issuerId ?? null,
          subject: alert.subject ?? null,
          recommendedAction: alert.recommendedAction,
          acknowledged: alert.acknowledged,
          acknowledgedAt: alert.acknowledgedAt ? new Date(alert.acknowledgedAt) : null,
          createdAt: new Date(alert.createdAt),
        },
      });
    }
  }

  async listAlerts(): Promise<TrustAlert[]> {
    const rows = await prisma.trustAlertRecord.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return sortAlerts(rows.map((row: TrustAlertRow) => toDomainAlert(row)));
  }

  async createAlert(alert: TrustAlert): Promise<TrustAlert> {
    const row = await prisma.trustAlertRecord.create({
      data: {
        alertId: alert.alertId,
        type: alert.type,
        severity: alert.severity,
        title: alert.title,
        description: alert.description,
        credentialId: alert.credentialId ?? null,
        issuerId: alert.issuerId ?? null,
        subject: alert.subject ?? null,
        recommendedAction: alert.recommendedAction,
        acknowledged: alert.acknowledged,
        acknowledgedAt: alert.acknowledgedAt ? new Date(alert.acknowledgedAt) : null,
        createdAt: new Date(alert.createdAt),
      },
    });
    return toDomainAlert(row);
  }

  async acknowledgeAlert(alertId: string, acknowledgedAt: string): Promise<TrustAlert | null> {
    const existing = await prisma.trustAlertRecord.findUnique({
      where: { alertId },
    });
    if (!existing) {
      return null;
    }

    const row = await prisma.trustAlertRecord.update({
      where: { alertId },
      data: {
        acknowledged: true,
        acknowledgedAt: new Date(acknowledgedAt),
      },
    });
    return toDomainAlert(row);
  }

  async getAlert(alertId: string): Promise<TrustAlert | null> {
    const row = await prisma.trustAlertRecord.findUnique({
      where: { alertId },
    });
    return row ? toDomainAlert(row) : null;
  }
}

export class InMemoryTrustAlertsRepository implements TrustAlertsRepository {
  private readonly alerts = new Map<string, TrustAlert>();

  constructor(initialAlerts: readonly TrustAlert[] = []) {
    for (const alert of initialAlerts) {
      this.alerts.set(alert.alertId, { ...alert });
    }
  }

  async seedDefaults(alerts: readonly TrustAlert[]): Promise<void> {
    for (const alert of alerts) {
      if (!this.alerts.has(alert.alertId)) {
        this.alerts.set(alert.alertId, { ...alert });
      }
    }
  }

  async listAlerts(): Promise<TrustAlert[]> {
    return sortAlerts(Array.from(this.alerts.values()).map((alert) => ({ ...alert })));
  }

  async createAlert(alert: TrustAlert): Promise<TrustAlert> {
    const stored = { ...alert };
    this.alerts.set(alert.alertId, stored);
    return { ...stored };
  }

  async acknowledgeAlert(alertId: string, acknowledgedAt: string): Promise<TrustAlert | null> {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      return null;
    }

    const updated: TrustAlert = {
      ...alert,
      acknowledged: true,
      acknowledgedAt,
    };
    this.alerts.set(alertId, updated);
    return { ...updated };
  }

  async getAlert(alertId: string): Promise<TrustAlert | null> {
    const alert = this.alerts.get(alertId);
    return alert ? { ...alert } : null;
  }
}
