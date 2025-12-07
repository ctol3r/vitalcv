/**
 * Multi-Ledger Anchor Harmonization
 * Task 7: Add multi-ledger anchor harmonization
 * Task 8: Add "block harmony score" calculation
 * Task 9: Add anchor drift clustering algorithm
 *
 * Harmonizes anchors across multiple blockchain networks and
 * calculates coherence metrics.
 */

export interface AnchorRecord {
  anchorId: string;
  credentialId: string;
  network: string;
  blockHeight: number;
  blockHash: string;
  txHash: string;
  timestamp: Date;
  merkleRoot: string;
  confidence: number; // 0-1
}

export interface BlockHarmony {
  credentialId: string;
  anchors: AnchorRecord[];
  harmonyScore: number; // 0-1
  consensus: number; // 0-1, how well anchors agree
  networks: string[];
  calculatedAt: Date;
}

export interface AnchorDrift {
  anchor: AnchorRecord;
  cluster: string;
  driftDistance: number; // 0-1, how far from cluster center
  neighbors: string[]; // anchor IDs in same cluster
}

export interface DriftCluster {
  id: string;
  center: {
    blockHeight: number;
    timestamp: Date;
    merkleRoot?: string;
  };
  anchors: AnchorRecord[];
  cohesion: number; // 0-1
  networks: string[];
}

export class MultiLedgerHarmonizer {
  private anchors: Map<string, AnchorRecord>;
  private harmonyWindow: number; // milliseconds

  constructor(harmonyWindowMs: number = 86400000) {
    this.anchors = new Map();
    this.harmonyWindow = harmonyWindowMs;
  }

  /**
   * Add an anchor record
   */
  addAnchor(anchor: AnchorRecord): void {
    this.anchors.set(anchor.anchorId, anchor);
  }

  /**
   * Calculate block harmony score for a credential across all ledgers
   */
  calculateBlockHarmony(credentialId: string): BlockHarmony {
    const anchors = Array.from(this.anchors.values()).filter(
      (a) => a.credentialId === credentialId
    );

    if (anchors.length === 0) {
      return {
        credentialId,
        anchors: [],
        harmonyScore: 0,
        consensus: 0,
        networks: [],
        calculatedAt: new Date(),
      };
    }

    // Calculate consensus
    const consensus = this.calculateConsensus(anchors);

    // Calculate harmony score
    const harmonyScore = this.calculateHarmonyScore(anchors, consensus);

    const networks = Array.from(new Set(anchors.map((a) => a.network)));

    return {
      credentialId,
      anchors,
      harmonyScore,
      consensus,
      networks,
      calculatedAt: new Date(),
    };
  }

  /**
   * Cluster anchors by drift patterns
   */
  clusterAnchorsByDrift(credentialId: string): {
    clusters: DriftCluster[];
    drifts: AnchorDrift[];
  } {
    const anchors = Array.from(this.anchors.values()).filter(
      (a) => a.credentialId === credentialId
    );

    if (anchors.length === 0) {
      return { clusters: [], drifts: [] };
    }

    // Group by network first
    const byNetwork = new Map<string, AnchorRecord[]>();
    anchors.forEach((anchor) => {
      if (!byNetwork.has(anchor.network)) {
        byNetwork.set(anchor.network, []);
      }
      byNetwork.get(anchor.network)!.push(anchor);
    });

    const clusters: DriftCluster[] = [];
    const drifts: AnchorDrift[] = [];

    // Create clusters per network
    byNetwork.forEach((networkAnchors, network) => {
      if (networkAnchors.length === 1) {
        // Single anchor = single cluster
        const cluster: DriftCluster = {
          id: `cluster_${network}_${networkAnchors[0].anchorId}`,
          center: {
            blockHeight: networkAnchors[0].blockHeight,
            timestamp: networkAnchors[0].timestamp,
            merkleRoot: networkAnchors[0].merkleRoot,
          },
          anchors: networkAnchors,
          cohesion: 1.0,
          networks: [network],
        };
        clusters.push(cluster);
        drifts.push({
          anchor: networkAnchors[0],
          cluster: cluster.id,
          driftDistance: 0,
          neighbors: [],
        });
      } else {
        // Multiple anchors - cluster by time and block height
        const subClusters = this.performClustering(networkAnchors);

        subClusters.forEach((clusterAnchors, idx) => {
          const center = this.calculateClusterCenter(clusterAnchors);
          const cohesion = this.calculateClusterCohesion(clusterAnchors, center);

          const cluster: DriftCluster = {
            id: `cluster_${network}_${idx}`,
            center,
            anchors: clusterAnchors,
            cohesion,
            networks: [network],
          };
          clusters.push(cluster);

          // Calculate drift for each anchor
          clusterAnchors.forEach((anchor) => {
            const driftDistance = this.calculateDriftDistance(anchor, center);
            drifts.push({
              anchor,
              cluster: cluster.id,
              driftDistance,
              neighbors: clusterAnchors
                .filter((a) => a.anchorId !== anchor.anchorId)
                .map((a) => a.anchorId),
            });
          });
        });
      }
    });

    return { clusters, drifts };
  }

  /**
   * Harmonize anchors across all networks
   */
  harmonizeAnchors(credentialId: string): {
    harmonized: boolean;
    conflicts: Array<{
      anchor1: AnchorRecord;
      anchor2: AnchorRecord;
      conflictType: 'merkle_mismatch' | 'timestamp_drift' | 'block_height_drift';
      severity: 'low' | 'medium' | 'high';
    }>;
    harmonizedAnchor?: AnchorRecord;
  } {
    const anchors = Array.from(this.anchors.values()).filter(
      (a) => a.credentialId === credentialId
    );

    if (anchors.length === 0) {
      return { harmonized: false, conflicts: [] };
    }

    const conflicts: Array<{
      anchor1: AnchorRecord;
      anchor2: AnchorRecord;
      conflictType: 'merkle_mismatch' | 'timestamp_drift' | 'block_height_drift';
      severity: 'low' | 'medium' | 'high';
    }> = [];

    // Check for conflicts
    for (let i = 0; i < anchors.length; i++) {
      for (let j = i + 1; j < anchors.length; j++) {
        const a1 = anchors[i];
        const a2 = anchors[j];

        // Check merkle root mismatch
        if (a1.merkleRoot !== a2.merkleRoot && a1.network === a2.network) {
          conflicts.push({
            anchor1: a1,
            anchor2: a2,
            conflictType: 'merkle_mismatch',
            severity: 'high',
          });
        }

        // Check timestamp drift
        const timeDiff = Math.abs(
          a1.timestamp.getTime() - a2.timestamp.getTime()
        );
        if (timeDiff > 3600000) {
          // More than 1 hour
          conflicts.push({
            anchor1: a1,
            anchor2: a2,
            conflictType: 'timestamp_drift',
            severity: timeDiff > 86400000 ? 'high' : 'medium',
          });
        }
      }
    }

    // Create harmonized anchor if no conflicts
    let harmonizedAnchor: AnchorRecord | undefined;
    if (conflicts.length === 0) {
      // Use highest confidence anchor as harmonized version
      const bestAnchor = anchors.reduce((best, a) =>
        a.confidence > best.confidence ? a : best
      );

      harmonizedAnchor = {
        ...bestAnchor,
        anchorId: `harmonized_${credentialId}`,
        network: 'multi_ledger',
      };
    }

    return {
      harmonized: conflicts.length === 0,
      conflicts,
      harmonizedAnchor,
    };
  }

  /**
   * Calculate consensus between anchors
   */
  private calculateConsensus(anchors: AnchorRecord[]): number {
    if (anchors.length < 2) return 1;

    // Check merkle root agreement
    const merkleRoots = anchors.map((a) => a.merkleRoot);
    const uniqueMerkleRoots = new Set(merkleRoots);
    const merkleAgreement = uniqueMerkleRoots.size === 1 ? 1 : 1 / uniqueMerkleRoots.size;

    // Check network diversity (more networks = better consensus)
    const networks = new Set(anchors.map((a) => a.network));
    const networkDiversity = Math.min(1, networks.size / 3);

    // Check timestamp consistency
    const timestamps = anchors.map((a) => a.timestamp.getTime());
    const avgTimestamp =
      timestamps.reduce((sum, t) => sum + t, 0) / timestamps.length;
    const variance =
      timestamps.reduce((sum, t) => sum + Math.pow(t - avgTimestamp, 2), 0) /
      timestamps.length;
    const timestampConsistency = Math.max(
      0,
      1 - Math.sqrt(variance) / (3600 * 1000)
    ); // Normalize by 1 hour

    // Weighted consensus
    return (
      merkleAgreement * 0.5 + networkDiversity * 0.3 + timestampConsistency * 0.2
    );
  }

  /**
   * Calculate harmony score
   */
  private calculateHarmonyScore(
    anchors: AnchorRecord[],
    consensus: number
  ): number {
    // Base score from consensus
    let score = consensus * 0.6;

    // Boost for multiple networks
    const networks = new Set(anchors.map((a) => a.network));
    const networkBonus = Math.min(0.3, (networks.size - 1) * 0.15);
    score += networkBonus;

    // Boost for high confidence anchors
    const avgConfidence =
      anchors.reduce((sum, a) => sum + a.confidence, 0) / anchors.length;
    score += avgConfidence * 0.1;

    return Math.min(1, score);
  }

  /**
   * Perform clustering on anchors
   */
  private performClustering(anchors: AnchorRecord[]): AnchorRecord[][] {
    if (anchors.length <= 1) return [anchors];

    // Simple time-based clustering (within 1 hour = same cluster)
    const clusters: AnchorRecord[][] = [];
    const processed = new Set<string>();

    anchors.forEach((anchor) => {
      if (processed.has(anchor.anchorId)) return;

      const cluster = [anchor];
      processed.add(anchor.anchorId);

      anchors.forEach((other) => {
        if (
          processed.has(other.anchorId) ||
          anchor.anchorId === other.anchorId
        ) {
          return;
        }

        const timeDiff = Math.abs(
          anchor.timestamp.getTime() - other.timestamp.getTime()
        );
        const blockDiff = Math.abs(anchor.blockHeight - other.blockHeight);

        // Same cluster if within 1 hour and similar block height
        if (timeDiff < 3600000 && blockDiff < 10) {
          cluster.push(other);
          processed.add(other.anchorId);
        }
      });

      clusters.push(cluster);
    });

    return clusters;
  }

  /**
   * Calculate cluster center
   */
  private calculateClusterCenter(anchors: AnchorRecord[]): {
    blockHeight: number;
    timestamp: Date;
    merkleRoot?: string;
  } {
    const avgBlockHeight =
      anchors.reduce((sum, a) => sum + a.blockHeight, 0) / anchors.length;

    const avgTimestampMs =
      anchors.reduce((sum, a) => sum + a.timestamp.getTime(), 0) /
      anchors.length;

    // Use most common merkle root
    const merkleRootCounts = new Map<string, number>();
    anchors.forEach((a) => {
      merkleRootCounts.set(a.merkleRoot, (merkleRootCounts.get(a.merkleRoot) || 0) + 1);
    });
    const mostCommonMerkleRoot = Array.from(merkleRootCounts.entries()).sort(
      (a, b) => b[1] - a[1]
    )[0]?.[0];

    return {
      blockHeight: Math.round(avgBlockHeight),
      timestamp: new Date(avgTimestampMs),
      merkleRoot: mostCommonMerkleRoot,
    };
  }

  /**
   * Calculate cluster cohesion
   */
  private calculateClusterCohesion(
    anchors: AnchorRecord[],
    center: { blockHeight: number; timestamp: Date }
  ): number {
    if (anchors.length === 1) return 1;

    const distances = anchors.map((anchor) => {
      const timeDiff = Math.abs(
        anchor.timestamp.getTime() - center.timestamp.getTime()
      ) / (3600 * 1000); // hours
      const blockDiff = Math.abs(anchor.blockHeight - center.blockHeight) / 10;

      return Math.sqrt(timeDiff * timeDiff + blockDiff * blockDiff);
    });

    const avgDistance =
      distances.reduce((sum, d) => sum + d, 0) / distances.length;

    // Lower average distance = higher cohesion
    return Math.max(0, 1 - avgDistance);
  }

  /**
   * Calculate drift distance from cluster center
   */
  private calculateDriftDistance(
    anchor: AnchorRecord,
    center: { blockHeight: number; timestamp: Date }
  ): number {
    const timeDiff = Math.abs(
      anchor.timestamp.getTime() - center.timestamp.getTime()
    ) / (3600 * 1000 * 24); // days
    const blockDiff = Math.abs(anchor.blockHeight - center.blockHeight) / 100; // normalized

    const distance = Math.sqrt(timeDiff * timeDiff + blockDiff * blockDiff);
    return Math.min(1, distance);
  }
}

