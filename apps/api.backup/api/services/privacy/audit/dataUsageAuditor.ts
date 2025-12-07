/**
 * B237B-DP-018: DataUsageAuditor
 *
 * Monitors and audits how shared tokens and connections are used.
 * Flags anomalies (unexpected volume, unusual scopes) and notifies owner.
 * Produces usage reports.
 */

import { PrismaClient } from '@prisma/client';

export interface UsageAnomaly {
  type: 'volume_spike' | 'unusual_scope' | 'unexpected_access' | 'geographic_anomaly';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  connectionId?: string;
  tokenId?: string;
  metadata?: Record<string, any>;
}

export interface UsageReport {
  period: { start: Date; end: Date };
  connectionId?: string;
  tokenId?: string;
  totalRequests: number;
  totalRecordsAccessed: number;
  byAction: Record<string, number>;
  byDataType: Record<string, number>;
  anomalies: UsageAnomaly[];
  topIpAddresses: Array<{ ip: string; count: number }>;
}

export class DataUsageAuditor {
  constructor(
    private prisma: PrismaClient,
    private anomalyThresholds = {
      volumeSpikeMultiplier: 3, // 3x normal volume
      unusualScopeThreshold: 0.1, // 10% of requests use unusual scopes
      geographicAnomalyThreshold: 0.2, // 20% from unexpected locations
    }
  ) {}

  /**
   * Analyze usage for a connection
   */
  async analyzeConnectionUsage(
    connectionId: string,
    periodDays: number = 30
  ): Promise<UsageReport> {
    const connection = await this.prisma.thirdPartyConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      throw new Error('Connection not found');
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    const logs = await this.prisma.connectionUsageLog.findMany({
      where: {
        connectionId,
        createdAt: { gte: startDate },
      },
      orderBy: { createdAt: 'asc' },
    });

    return this.generateReport(logs, { connectionId });
  }

  /**
   * Analyze usage for a shared token
   */
  async analyzeTokenUsage(
    tokenId: string,
    periodDays: number = 30
  ): Promise<UsageReport> {
    const token = await this.prisma.sharedAccessToken.findUnique({
      where: { id: tokenId },
    });

    if (!token) {
      throw new Error('Token not found');
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    const logs = await this.prisma.tokenUsageLog.findMany({
      where: {
        tokenId,
        createdAt: { gte: startDate },
      },
      orderBy: { createdAt: 'asc' },
    });

    return this.generateReport(logs, { tokenId });
  }

  /**
   * Detect anomalies in usage
   */
  async detectAnomalies(
    connectionId?: string,
    tokenId?: string,
    periodDays: number = 7
  ): Promise<UsageAnomaly[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    let logs: any[];

    if (connectionId) {
      logs = await this.prisma.connectionUsageLog.findMany({
        where: {
          connectionId,
          createdAt: { gte: startDate },
        },
      });
    } else if (tokenId) {
      logs = await this.prisma.tokenUsageLog.findMany({
        where: {
          tokenId,
          createdAt: { gte: startDate },
        },
      });
    } else {
      throw new Error('Either connectionId or tokenId must be provided');
    }

    const anomalies: UsageAnomaly[] = [];

    // Check for volume spikes
    const volumeAnomaly = this.detectVolumeSpike(logs);
    if (volumeAnomaly) {
      anomalies.push({
        ...volumeAnomaly,
        connectionId,
        tokenId,
      });
    }

    // Check for unusual scopes
    if (connectionId) {
      const connection = await this.prisma.thirdPartyConnection.findUnique({
        where: { id: connectionId },
      });

      if (connection) {
        const scopeAnomaly = this.detectUnusualScopes(logs, connection.scopes);
        if (scopeAnomaly) {
          anomalies.push({
            ...scopeAnomaly,
            connectionId,
          });
        }
      }
    }

    // Check for unexpected access patterns
    const accessAnomaly = this.detectUnexpectedAccess(logs);
    if (accessAnomaly) {
      anomalies.push({
        ...accessAnomaly,
        connectionId,
        tokenId,
      });
    }

    // Check for geographic anomalies
    const geoAnomaly = this.detectGeographicAnomaly(logs);
    if (geoAnomaly) {
      anomalies.push({
        ...geoAnomaly,
        connectionId,
        tokenId,
      });
    }

    return anomalies;
  }

  /**
   * Generate usage report
   */
  private generateReport(logs: any[], context: { connectionId?: string; tokenId?: string }): UsageReport {
    const byAction: Record<string, number> = {};
    const byDataType: Record<string, number> = {};
    let totalRecordsAccessed = 0;
    const ipCounts: Record<string, number> = {};

    for (const log of logs) {
      // Count by action
      byAction[log.action] = (byAction[log.action] || 0) + 1;

      // Count records accessed
      totalRecordsAccessed += log.recordCount || 0;

      // Count IP addresses
      if (log.ipAddress) {
        ipCounts[log.ipAddress] = (ipCounts[log.ipAddress] || 0) + 1;
      }

      // Extract data types from metadata
      if (log.metadata && (log.metadata as any).dataTypes) {
        for (const dt of (log.metadata as any).dataTypes) {
          byDataType[dt] = (byDataType[dt] || 0) + 1;
        }
      }
    }

    // Get top IP addresses
    const topIpAddresses = Object.entries(ipCounts)
      .map(([ip, count]) => ({ ip, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const startDate = logs.length > 0 ? logs[0].createdAt : new Date();
    const endDate = logs.length > 0 ? logs[logs.length - 1].createdAt : new Date();

    // Detect anomalies
    const anomalies = this.detectAnomaliesFromLogs(logs, context);

    return {
      period: { start: startDate, end: endDate },
      ...context,
      totalRequests: logs.length,
      totalRecordsAccessed,
      byAction,
      byDataType,
      anomalies,
      topIpAddresses,
    };
  }

  /**
   * Detect volume spike anomaly
   */
  private detectVolumeSpike(logs: any[]): UsageAnomaly | null {
    if (logs.length < 2) return null;

    // Calculate average requests per day
    const days = (logs[logs.length - 1].createdAt - logs[0].createdAt) / (1000 * 60 * 60 * 24);
    const avgPerDay = logs.length / days;

    // Check last 24 hours
    const last24h = new Date();
    last24h.setHours(last24h.getHours() - 24);
    const recentLogs = logs.filter(log => log.createdAt >= last24h);
    const recentPerDay = recentLogs.length;

    if (recentPerDay > avgPerDay * this.anomalyThresholds.volumeSpikeMultiplier) {
      return {
        type: 'volume_spike',
        severity: recentPerDay > avgPerDay * 5 ? 'critical' : 'high',
        description: `Volume spike detected: ${recentPerDay} requests in last 24h vs average ${avgPerDay.toFixed(1)}/day`,
        metadata: {
          averagePerDay: avgPerDay,
          recentCount: recentPerDay,
          multiplier: recentPerDay / avgPerDay,
        },
      };
    }

    return null;
  }

  /**
   * Detect unusual scope usage
   */
  private detectUnusualScopes(logs: any[], allowedScopes: string[]): UsageAnomaly | null {
    if (logs.length === 0) return null;

    const scopeUsage: Record<string, number> = {};
    let totalWithScopes = 0;

    for (const log of logs) {
      if (log.metadata && (log.metadata as any).scopes) {
        totalWithScopes++;
        for (const scope of (log.metadata as any).scopes) {
          scopeUsage[scope] = (scopeUsage[scope] || 0) + 1;
        }
      }
    }

    // Check for scopes not in allowed list
    const unusualScopes = Object.keys(scopeUsage).filter(s => !allowedScopes.includes(s));

    if (unusualScopes.length > 0 && totalWithScopes > 0) {
      const unusualRatio = unusualScopes.reduce((sum, s) => sum + scopeUsage[s], 0) / totalWithScopes;

      if (unusualRatio > this.anomalyThresholds.unusualScopeThreshold) {
        return {
          type: 'unusual_scope',
          severity: unusualRatio > 0.3 ? 'high' : 'medium',
          description: `Unusual scopes detected: ${unusualScopes.join(', ')}`,
          metadata: {
            unusualScopes,
            ratio: unusualRatio,
          },
        };
      }
    }

    return null;
  }

  /**
   * Detect unexpected access patterns
   */
  private detectUnexpectedAccess(logs: any[]): UsageAnomaly | null {
    if (logs.length === 0) return null;

    // Check for access outside normal hours (e.g., 2 AM - 6 AM)
    const offHoursLogs = logs.filter(log => {
      const hour = new Date(log.createdAt).getHours();
      return hour >= 2 && hour < 6;
    });

    if (offHoursLogs.length > logs.length * 0.2) {
      return {
        type: 'unexpected_access',
        severity: 'medium',
        description: `High percentage of access during off-hours: ${((offHoursLogs.length / logs.length) * 100).toFixed(1)}%`,
        metadata: {
          offHoursCount: offHoursLogs.length,
          totalCount: logs.length,
          percentage: (offHoursLogs.length / logs.length) * 100,
        },
      };
    }

    return null;
  }

  /**
   * Detect geographic anomalies
   */
  private detectGeographicAnomaly(logs: any[]): UsageAnomaly | null {
    if (logs.length === 0) return null;

    // Group by IP prefix (first 2 octets for IPv4)
    const ipGroups: Record<string, number> = {};
    let totalWithIp = 0;

    for (const log of logs) {
      if (log.ipAddress) {
        totalWithIp++;
        const prefix = log.ipAddress.split('.').slice(0, 2).join('.');
        ipGroups[prefix] = (ipGroups[prefix] || 0) + 1;
      }
    }

    if (totalWithIp === 0) return null;

    // Find most common location
    const sortedGroups = Object.entries(ipGroups).sort((a, b) => b[1] - a[1]);
    const mostCommon = sortedGroups[0];
    const mostCommonRatio = mostCommon[1] / totalWithIp;

    // If less than threshold from most common location, flag as anomaly
    if (mostCommonRatio < this.anomalyThresholds.geographicAnomalyThreshold) {
      return {
        type: 'geographic_anomaly',
        severity: 'low',
        description: `Access from multiple geographic locations detected`,
        metadata: {
          locationCount: sortedGroups.length,
          topLocation: mostCommon[0],
          topLocationRatio: mostCommonRatio,
        },
      };
    }

    return null;
  }

  /**
   * Detect anomalies from logs (helper)
   */
  private detectAnomaliesFromLogs(logs: any[], context: { connectionId?: string; tokenId?: string }): UsageAnomaly[] {
    const anomalies: UsageAnomaly[] = [];

    const volumeAnomaly = this.detectVolumeSpike(logs);
    if (volumeAnomaly) {
      anomalies.push({ ...volumeAnomaly, ...context });
    }

    const accessAnomaly = this.detectUnexpectedAccess(logs);
    if (accessAnomaly) {
      anomalies.push({ ...accessAnomaly, ...context });
    }

    const geoAnomaly = this.detectGeographicAnomaly(logs);
    if (geoAnomaly) {
      anomalies.push({ ...geoAnomaly, ...context });
    }

    return anomalies;
  }

  /**
   * Notify vault owner of anomalies
   */
  async notifyOwner(
    vaultId: string,
    anomalies: UsageAnomaly[]
  ): Promise<void> {
    const vault = await this.prisma.personalDataVault.findUnique({
      where: { id: vaultId },
      include: { owner: true },
    });

    if (!vault) {
      throw new Error('Vault not found');
    }

    // Filter critical and high severity anomalies
    const criticalAnomalies = anomalies.filter(a =>
      a.severity === 'critical' || a.severity === 'high'
    );

    if (criticalAnomalies.length > 0) {
      // In production, send notification (email, push, etc.)
      // For now, log to audit trail
      await this.prisma.vaultAuditLog.create({
        data: {
          vaultId,
          actorId: 'system',
          action: 'anomaly_detected',
          scope: 'audit',
          metadata: {
            anomalies: criticalAnomalies,
            count: criticalAnomalies.length,
          },
          hash: this.generateAuditHash(vaultId, 'system', 'anomaly_detected'),
        },
      });
    }
  }

  private generateAuditHash(vaultId: string, actorId: string, action: string): string {
    const crypto = require('crypto');
    const data = `${vaultId}:${actorId}:${action}:${Date.now()}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}

