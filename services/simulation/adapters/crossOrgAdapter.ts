/**
 * CrossOrgSimulationAdapter
 *
 * Mocks remote peers for federation and routing.
 * Simulates federated proof exchange and credential handoff
 * within a scenario.
 */

export interface RemotePeer {
  id: string;
  organizationId: string;
  did: string;
  endpoint: string;
  capabilities: string[];
  metadata?: Record<string, any>;
}

export interface ProofExchange {
  id: string;
  fromPeer: string;
  toPeer: string;
  proofType: string;
  credentialId?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  timestamp: number;
  data?: any;
}

export interface CredentialHandoff {
  id: string;
  credentialId: string;
  fromPeer: string;
  toPeer: string;
  status: 'initiated' | 'in_transit' | 'delivered' | 'failed';
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface FederationRoute {
  fromOrg: string;
  toOrg: string;
  routeType: 'direct' | 'relay' | 'mesh';
  latency: number; // milliseconds
  reliability: number; // 0-1
  active: boolean;
}

export class CrossOrgSimulationAdapter {
  private peers: Map<string, RemotePeer> = new Map();
  private proofExchanges: Map<string, ProofExchange> = new Map();
  private credentialHandoffs: Map<string, CredentialHandoff> = new Map();
  private routes: Map<string, FederationRoute> = new Map();
  private networkLatency: number = 100; // Default latency in ms
  private networkReliability: number = 0.95; // Default reliability (0-1)

  /**
   * Register a remote peer
   */
  registerPeer(peer: RemotePeer): void {
    this.peers.set(peer.id, peer);
  }

  /**
   * Get a peer by ID
   */
  getPeer(peerId: string): RemotePeer | undefined {
    return this.peers.get(peerId);
  }

  /**
   * List all registered peers
   */
  listPeers(): RemotePeer[] {
    return Array.from(this.peers.values());
  }

  /**
   * Remove a peer
   */
  removePeer(peerId: string): boolean {
    return this.peers.delete(peerId);
  }

  /**
   * Simulate federated proof exchange
   */
  async simulateProofExchange(
    fromPeerId: string,
    toPeerId: string,
    proofType: string,
    credentialId?: string,
    data?: any
  ): Promise<ProofExchange> {
    const fromPeer = this.peers.get(fromPeerId);
    const toPeer = this.peers.get(toPeerId);

    if (!fromPeer || !toPeer) {
      throw new Error(`Peer not found: ${fromPeerId} or ${toPeerId}`);
    }

    const exchange: ProofExchange = {
      id: `proof_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      fromPeer: fromPeerId,
      toPeer: toPeerId,
      proofType,
      credentialId,
      status: 'pending',
      timestamp: Date.now(),
      data,
    };

    this.proofExchanges.set(exchange.id, exchange);

    // Simulate network delay
    await this.simulateNetworkDelay(fromPeerId, toPeerId);

    // Simulate peer response (accept/reject based on reliability)
    if (Math.random() <= this.networkReliability) {
      exchange.status = 'accepted';
    } else {
      exchange.status = 'rejected';
    }

    return exchange;
  }

  /**
   * Simulate credential handoff
   */
  async simulateCredentialHandoff(
    credentialId: string,
    fromPeerId: string,
    toPeerId: string,
    metadata?: Record<string, any>
  ): Promise<CredentialHandoff> {
    const fromPeer = this.peers.get(fromPeerId);
    const toPeer = this.peers.get(toPeerId);

    if (!fromPeer || !toPeer) {
      throw new Error(`Peer not found: ${fromPeerId} or ${toPeerId}`);
    }

    const handoff: CredentialHandoff = {
      id: `handoff_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      credentialId,
      fromPeer: fromPeerId,
      toPeer: toPeerId,
      status: 'initiated',
      timestamp: Date.now(),
      metadata,
    };

    this.credentialHandoffs.set(handoff.id, handoff);

    // Simulate transit stages
    handoff.status = 'in_transit';
    await this.simulateNetworkDelay(fromPeerId, toPeerId);

    // Simulate delivery success/failure
    if (Math.random() <= this.networkReliability) {
      handoff.status = 'delivered';
    } else {
      handoff.status = 'failed';
    }

    return handoff;
  }

  /**
   * Establish a federation route between organizations
   */
  establishRoute(
    fromOrg: string,
    toOrg: string,
    routeType: 'direct' | 'relay' | 'mesh' = 'direct',
    latency?: number,
    reliability?: number
  ): FederationRoute {
    const routeKey = `${fromOrg}->${toOrg}`;
    const route: FederationRoute = {
      fromOrg,
      toOrg,
      routeType,
      latency: latency || this.networkLatency,
      reliability: reliability || this.networkReliability,
      active: true,
    };

    this.routes.set(routeKey, route);
    return route;
  }

  /**
   * Get route between organizations
   */
  getRoute(fromOrg: string, toOrg: string): FederationRoute | undefined {
    return this.routes.get(`${fromOrg}->${toOrg}`);
  }

  /**
   * Simulate network partition between organizations
   */
  partitionOrganizations(orgIds: string[]): void {
    // Deactivate routes involving partitioned orgs
    for (const [key, route] of this.routes.entries()) {
      if (
        orgIds.includes(route.fromOrg) ||
        orgIds.includes(route.toOrg)
      ) {
        route.active = false;
      }
    }
  }

  /**
   * Restore network connectivity
   */
  restoreConnectivity(): void {
    for (const route of this.routes.values()) {
      route.active = true;
    }
  }

  /**
   * Set network characteristics for simulation
   */
  setNetworkCharacteristics(latency: number, reliability: number): void {
    this.networkLatency = latency;
    this.networkReliability = reliability;
  }

  /**
   * Simulate network delay between peers
   */
  private async simulateNetworkDelay(fromPeerId: string, toPeerId: string): Promise<void> {
    const fromPeer = this.peers.get(fromPeerId);
    const toPeer = this.peers.get(toPeerId);

    if (!fromPeer || !toPeer) {
      return;
    }

    // Find route if organizations are different
    if (fromPeer.organizationId !== toPeer.organizationId) {
      const route = this.getRoute(fromPeer.organizationId, toPeer.organizationId);
      if (route && route.active) {
        const delay = route.latency + Math.random() * 50; // Add jitter
        await this.sleep(delay);
        return;
      }
    }

    // Default delay
    await this.sleep(this.networkLatency);
  }

  /**
   * Get all proof exchanges
   */
  getProofExchanges(): ProofExchange[] {
    return Array.from(this.proofExchanges.values());
  }

  /**
   * Get proof exchange by ID
   */
  getProofExchange(exchangeId: string): ProofExchange | undefined {
    return this.proofExchanges.get(exchangeId);
  }

  /**
   * Get all credential handoffs
   */
  getCredentialHandoffs(): CredentialHandoff[] {
    return Array.from(this.credentialHandoffs.values());
  }

  /**
   * Get credential handoff by ID
   */
  getCredentialHandoff(handoffId: string): CredentialHandoff | undefined {
    return this.credentialHandoffs.get(handoffId);
  }

  /**
   * Get all routes
   */
  getRoutes(): FederationRoute[] {
    return Array.from(this.routes.values());
  }

  /**
   * Clear all simulation data
   */
  reset(): void {
    this.proofExchanges.clear();
    this.credentialHandoffs.clear();
    this.routes.clear();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

