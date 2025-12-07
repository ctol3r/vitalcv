/**
 * OrbitalLayoutEngine
 * Physics-based orbital positioning for credentials
 * Tasks 21-30: Orbital Layout Engine
 */

import type { OrbitalPosition, LumenPhysicsConfig } from './types';

export interface OrbitalCredential {
  id: string;
  type: 'License' | 'DEA' | 'Board' | 'CME' | 'Skill';
  expirationDate: Date | null;
  anchorConfidence: number;
  skillDepth: number;
  riskScore: number;
  matchScore?: number; // For job matching
}

export interface ClusterGroup {
  id: string;
  type: OrbitalCredential['type'];
  credentials: OrbitalCredential[];
  position: { angle: number; baseRadius: number };
}

export class OrbitalLayoutEngine {
  private physics: LumenPhysicsConfig;
  private centerX: number;
  private centerY: number;
  private maxRadius: number;
  private clusters: Map<string, ClusterGroup> = new Map();

  constructor(
    physics: LumenPhysicsConfig,
    center: { x: number; y: number } = { x: 0, y: 0 },
    maxRadius: number = 500
  ) {
    this.physics = physics;
    this.centerX = center.x;
    this.centerY = center.y;
    this.maxRadius = maxRadius;
  }

  /**
   * Calculate orbital position for a credential
   * Task 23: orbit radius = expiration proximity
   */
  calculatePosition(
    credential: OrbitalCredential,
    now: Date = new Date()
  ): OrbitalPosition {
    // Radius based on expiration proximity (closer to expiration = closer to center)
    const expirationProximity = this.calculateExpirationProximity(
      credential.expirationDate,
      now
    );
    const radius = this.maxRadius * (0.3 + expirationProximity * 0.7);

    // Velocity based on skill depth (Task 24)
    const velocity = 0.5 + credential.skillDepth * 1.5;

    // Glow intensity based on anchor confidence (Task 25)
    const glowIntensity = credential.anchorConfidence;

    // Jitter based on risk score (Task 26)
    const jitter = credential.riskScore * 0.2;

    // Angle determined by cluster grouping (Task 28)
    const angle = this.calculateClusterAngle(credential);

    return {
      radius,
      angle,
      velocity,
      glowIntensity,
      jitter,
    };
  }

  /**
   * Calculate expiration proximity (0.0 = expired, 1.0 = far from expiration)
   */
  private calculateExpirationProximity(
    expirationDate: Date | null,
    now: Date
  ): number {
    if (!expirationDate) return 1.0;

    const totalDuration = 90 * 24 * 60 * 60 * 1000; // 90 days in ms
    const timeUntilExpiry = expirationDate.getTime() - now.getTime();

    if (timeUntilExpiry <= 0) return 0.0;
    if (timeUntilExpiry >= totalDuration) return 1.0;

    return timeUntilExpiry / totalDuration;
  }

  /**
   * Group credentials into clusters (Task 28)
   */
  groupIntoClusters(credentials: OrbitalCredential[]): ClusterGroup[] {
    const groups = new Map<string, OrbitalCredential[]>();

    credentials.forEach((cred) => {
      if (!groups.has(cred.type)) {
        groups.set(cred.type, []);
      }
      groups.get(cred.type)!.push(cred);
    });

    const clusters: ClusterGroup[] = [];
    const clusterTypes: OrbitalCredential['type'][] = [
      'License',
      'DEA',
      'Board',
      'CME',
      'Skill',
    ];

    clusterTypes.forEach((type, index) => {
      const creds = groups.get(type) || [];
      if (creds.length > 0) {
        const angle = (index * 2 * Math.PI) / clusterTypes.length;
        clusters.push({
          id: type.toLowerCase(),
          type,
          credentials: creds,
          position: {
            angle,
            baseRadius: this.maxRadius * 0.6,
          },
        });
      }
    });

    this.clusters.clear();
    clusters.forEach((cluster) => {
      this.clusters.set(cluster.id, cluster);
    });

    return clusters;
  }

  /**
   * Calculate angle within cluster
   */
  private calculateClusterAngle(credential: OrbitalCredential): number {
    const cluster = Array.from(this.clusters.values()).find(
      (c) => c.type === credential.type
    );
    if (!cluster) {
      // Default angle if no cluster
      return Math.random() * 2 * Math.PI;
    }

    const index = cluster.credentials.findIndex((c) => c.id === credential.id);
    const spacing = (2 * Math.PI) / Math.max(1, cluster.credentials.length);
    return cluster.position.angle + index * spacing;
  }

  /**
   * Calculate collision avoidance adjustments (Task 27)
   */
  avoidCollisions(
    positions: Map<string, OrbitalPosition>,
    minDistance: number = 50
  ): Map<string, OrbitalPosition> {
    const adjusted = new Map(positions);
    const entries = Array.from(positions.entries());

    entries.forEach(([id1, pos1]) => {
      entries.forEach(([id2, pos2]) => {
        if (id1 === id2) return;

        const x1 = this.centerX + pos1.radius * Math.cos(pos1.angle);
        const y1 = this.centerY + pos1.radius * Math.sin(pos1.angle);
        const x2 = this.centerX + pos2.radius * Math.cos(pos2.angle);
        const y2 = this.centerY + pos2.radius * Math.sin(pos2.angle);

        const dx = x2 - x1;
        const dy = y2 - y1;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < minDistance) {
          // Push apart
          const pushAngle = Math.atan2(dy, dx);
          const pushDistance = (minDistance - distance) / 2;

          const currentPos1 = adjusted.get(id1)!;
          const currentPos2 = adjusted.get(id2)!;

          adjusted.set(id1, {
            ...currentPos1,
            angle: currentPos1.angle - pushDistance / currentPos1.radius,
          });

          adjusted.set(id2, {
            ...currentPos2,
            angle: currentPos2.angle + pushDistance / currentPos2.radius,
          });
        }
      });
    });

    return adjusted;
  }

  /**
   * Calculate magnetic pull for job matches (Task 30)
   */
  calculateMagneticPull(
    credential: OrbitalCredential,
    jobPosition: { x: number; y: number }
  ): { pullX: number; pullY: number; strength: number } {
    if (!credential.matchScore || credential.matchScore <= 0) {
      return { pullX: 0, pullY: 0, strength: 0 };
    }

    const position = this.calculatePosition(credential);
    const credX = this.centerX + position.radius * Math.cos(position.angle);
    const credY = this.centerY + position.radius * Math.sin(position.angle);

    const dx = jobPosition.x - credX;
    const dy = jobPosition.y - credY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance === 0) {
      return { pullX: 0, pullY: 0, strength: 0 };
    }

    // Inverse square law with match score
    const baseStrength = this.physics.gravity * credential.matchScore;
    const strength = baseStrength / (1 + distance * distance * 0.001);

    return {
      pullX: (dx / distance) * strength,
      pullY: (dy / distance) * strength,
      strength,
    };
  }

  /**
   * Calculate zoom scale for pinch/zoom (Task 29)
   */
  calculateZoomScale(currentScale: number, zoomFactor: number): number {
    const minScale = 0.5;
    const maxScale = 3.0;
    const newScale = currentScale * zoomFactor;
    return Math.max(minScale, Math.min(maxScale, newScale));
  }
}

