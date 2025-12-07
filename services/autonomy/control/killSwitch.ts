/**
 * B222B-ETH-008: AutonomyKillSwitch
 *
 * Emergency stop mechanism to immediately halt all autonomous actions across regions;
 * requires quorum approval to re-enable.
 */

import { createLogger } from '@chai-vc/logging-core';
import { PrismaClient } from '@prisma/client';
import { EventEmitter } from 'events';

const logger = createLogger({ service: 'autonomy-kill-switch' });
const prisma = new PrismaClient();

/**
 * Kill switch status
 */
export enum KillSwitchStatus {
  ENABLED = 'enabled',
  DISABLED = 'disabled',
  EMERGENCY_STOP = 'emergency_stop',
}

/**
 * Region identifier
 */
export type Region = string;

/**
 * Kill switch activation record
 */
export interface KillSwitchActivation {
  /** Activation ID */
  id: string;
  /** Status */
  status: KillSwitchStatus;
  /** Region affected (undefined = all regions) */
  region?: Region;
  /** User who activated */
  activatedBy: string;
  /** Reason for activation */
  reason: string;
  /** Timestamp */
  activatedAt: Date;
  /** Deactivated timestamp (if applicable) */
  deactivatedAt?: Date;
  /** Deactivated by */
  deactivatedBy?: string;
  /** Quorum approvals for re-enable */
  quorumApprovals: QuorumApproval[];
}

/**
 * Quorum approval record
 */
export interface QuorumApproval {
  /** Approver user ID */
  userId: string;
  /** Approver role */
  role: string;
  /** Timestamp */
  approvedAt: Date;
  /** Signature/hash for verification */
  signature?: string;
}

/**
 * Kill switch configuration
 */
export interface KillSwitchConfig {
  /** Required quorum size for re-enable */
  quorumSize: number;
  /** Required roles for quorum */
  requiredRoles: string[];
  /** Minimum number of approvals from each role */
  roleQuorum?: Record<string, number>;
  /** Regions to monitor */
  regions: Region[];
  /** Event emitter for kill switch events */
  eventEmitter?: EventEmitter;
}

/**
 * Default kill switch configuration
 */
const DEFAULT_CONFIG: KillSwitchConfig = {
  quorumSize: 3,
  requiredRoles: ['admin', 'compliance_officer', 'ethics_board'],
  roleQuorum: {
    admin: 1,
    compliance_officer: 1,
    ethics_board: 1,
  },
  regions: ['us-east', 'us-west', 'eu', 'ap'],
};

/**
 * AutonomyKillSwitch
 *
 * Emergency stop mechanism for autonomous actions.
 */
export class AutonomyKillSwitch {
  private config: KillSwitchConfig;
  private status: KillSwitchStatus = KillSwitchStatus.ENABLED;
  private activations: Map<string, KillSwitchActivation> = new Map();
  private eventEmitter: EventEmitter;

  constructor(config?: Partial<KillSwitchConfig>) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
    this.eventEmitter = config?.eventEmitter || new EventEmitter();
  }

  /**
   * Activate emergency stop (immediate halt)
   */
  async activateEmergencyStop(
    activatedBy: string,
    reason: string,
    region?: Region
  ): Promise<KillSwitchActivation> {
    logger.warn('Emergency stop activated', {
      activatedBy,
      reason,
      region: region || 'all',
    });

    const activation: KillSwitchActivation = {
      id: `killswitch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: KillSwitchStatus.EMERGENCY_STOP,
      region,
      activatedBy,
      reason,
      activatedAt: new Date(),
      quorumApprovals: [],
    };

    this.activations.set(activation.id, activation);
    this.status = KillSwitchStatus.EMERGENCY_STOP;

    // Emit event
    this.eventEmitter.emit('killswitch:activated', activation);

    // Store in database
    await this.storeActivation(activation);

    // Immediately halt all autonomous actions
    await this.haltAutonomousActions(region);

    return activation;
  }

  /**
   * Request quorum approval to re-enable
   */
  async requestReEnableApproval(
    activationId: string,
    userId: string,
    userRole: string,
    signature?: string
  ): Promise<{
    approved: boolean;
    remainingApprovals: number;
    activation: KillSwitchActivation;
  }> {
    const activation = this.activations.get(activationId);
    if (!activation) {
      throw new Error(`Kill switch activation not found: ${activationId}`);
    }

    if (activation.status !== KillSwitchStatus.EMERGENCY_STOP) {
      throw new Error(`Kill switch is not in emergency stop state`);
    }

    // Check if user has required role
    if (!this.config.requiredRoles.includes(userRole)) {
      throw new Error(`User role ${userRole} is not authorized for quorum approval`);
    }

    // Check if user already approved
    const existingApproval = activation.quorumApprovals.find((a) => a.userId === userId);
    if (existingApproval) {
      logger.warn('User already provided approval', { userId, activationId });
      return {
        approved: false,
        remainingApprovals: this.calculateRemainingApprovals(activation),
        activation,
      };
    }

    // Add approval
    const approval: QuorumApproval = {
      userId,
      role: userRole,
      approvedAt: new Date(),
      signature,
    };

    activation.quorumApprovals.push(approval);

    // Check if quorum is met
    const quorumMet = this.checkQuorum(activation);

    logger.info('Quorum approval received', {
      activationId,
      userId,
      userRole,
      quorumMet,
      approvals: activation.quorumApprovals.length,
      required: this.config.quorumSize,
    });

    // Update activation
    this.activations.set(activationId, activation);
    await this.updateActivation(activation);

    // Emit event
    this.eventEmitter.emit('killswitch:approval', {
      activationId,
      approval,
      quorumMet,
    });

    if (quorumMet) {
      // Re-enable autonomous actions
      await this.reEnableAutonomousActions(activation);
    }

    return {
      approved: true,
      remainingApprovals: this.calculateRemainingApprovals(activation),
      activation,
    };
  }

  /**
   * Re-enable autonomous actions (after quorum approval)
   */
  private async reEnableAutonomousActions(
    activation: KillSwitchActivation
  ): Promise<void> {
    logger.info('Re-enabling autonomous actions', {
      activationId: activation.id,
      region: activation.region || 'all',
    });

    activation.status = KillSwitchStatus.ENABLED;
    activation.deactivatedAt = new Date();
    activation.deactivatedBy = 'quorum_approval';

    this.status = KillSwitchStatus.ENABLED;

    // Update activation
    this.activations.set(activation.id, activation);
    await this.updateActivation(activation);

    // Emit event
    this.eventEmitter.emit('killswitch:re-enabled', activation);

    // Resume autonomous actions
    await this.resumeAutonomousActions(activation.region);
  }

  /**
   * Check if quorum is met
   */
  private checkQuorum(activation: KillSwitchActivation): boolean {
    // Check total quorum size
    if (activation.quorumApprovals.length < this.config.quorumSize) {
      return false;
    }

    // Check role-specific quorum if configured
    if (this.config.roleQuorum) {
      for (const [role, required] of Object.entries(this.config.roleQuorum)) {
        const roleApprovals = activation.quorumApprovals.filter((a) => a.role === role);
        if (roleApprovals.length < required) {
          return false;
        }
      }
    }

    // Check that we have at least one approval from each required role
    const approvedRoles = new Set(activation.quorumApprovals.map((a) => a.role));
    for (const requiredRole of this.config.requiredRoles) {
      if (!approvedRoles.has(requiredRole)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Calculate remaining approvals needed
   */
  private calculateRemainingApprovals(activation: KillSwitchActivation): number {
    const current = activation.quorumApprovals.length;
    const required = this.config.quorumSize;
    return Math.max(0, required - current);
  }

  /**
   * Halt all autonomous actions
   */
  private async haltAutonomousActions(region?: Region): Promise<void> {
    logger.warn('Halting autonomous actions', { region: region || 'all' });

    // In production, would:
    // 1. Signal all autonomous action executors to stop
    // 2. Cancel pending autonomous actions
    // 3. Update system status

    // Emit event for other services to listen
    this.eventEmitter.emit('autonomy:halt', { region });

    // TODO: Integrate with actual autonomy system
    // await autonomySystem.halt(region);
  }

  /**
   * Resume autonomous actions
   */
  private async resumeAutonomousActions(region?: Region): Promise<void> {
    logger.info('Resuming autonomous actions', { region: region || 'all' });

    // In production, would:
    // 1. Signal all autonomous action executors to resume
    // 2. Re-enable autonomous action queue processing

    // Emit event for other services to listen
    this.eventEmitter.emit('autonomy:resume', { region });

    // TODO: Integrate with actual autonomy system
    // await autonomySystem.resume(region);
  }

  /**
   * Get current kill switch status
   */
  getStatus(region?: Region): KillSwitchStatus {
    if (region) {
      // Check if there's an active activation for this region
      const activeActivation = Array.from(this.activations.values()).find(
        (a) =>
          a.status === KillSwitchStatus.EMERGENCY_STOP &&
          (a.region === region || !a.region)
      );
      return activeActivation ? KillSwitchStatus.EMERGENCY_STOP : KillSwitchStatus.ENABLED;
    }
    return this.status;
  }

  /**
   * Check if autonomous actions are enabled
   */
  isEnabled(region?: Region): boolean {
    return this.getStatus(region) === KillSwitchStatus.ENABLED;
  }

  /**
   * Get active activations
   */
  getActiveActivations(region?: Region): KillSwitchActivation[] {
    return Array.from(this.activations.values()).filter(
      (a) =>
        a.status === KillSwitchStatus.EMERGENCY_STOP &&
        (!region || a.region === region || !a.region)
    );
  }

  /**
   * Get activation by ID
   */
  getActivation(activationId: string): KillSwitchActivation | undefined {
    return this.activations.get(activationId);
  }

  /**
   * Store activation in database
   */
  private async storeActivation(activation: KillSwitchActivation): Promise<void> {
    try {
      // In production, would store in database
      // For now, just log
      logger.debug('Storing kill switch activation', {
        activationId: activation.id,
        status: activation.status,
      });

      // TODO: Implement database storage
      // await prisma.killSwitchActivation.create({ data: activation });
    } catch (error) {
      logger.error('Error storing kill switch activation', { error });
    }
  }

  /**
   * Update activation in database
   */
  private async updateActivation(activation: KillSwitchActivation): Promise<void> {
    try {
      // In production, would update in database
      logger.debug('Updating kill switch activation', {
        activationId: activation.id,
        status: activation.status,
        approvals: activation.quorumApprovals.length,
      });

      // TODO: Implement database update
      // await prisma.killSwitchActivation.update({
      //   where: { id: activation.id },
      //   data: activation,
      // });
    } catch (error) {
      logger.error('Error updating kill switch activation', { error });
    }
  }

  /**
   * Get event emitter for listening to kill switch events
   */
  getEventEmitter(): EventEmitter {
    return this.eventEmitter;
  }
}

/**
 * Create a new AutonomyKillSwitch instance
 */
export function createAutonomyKillSwitch(
  config?: Partial<KillSwitchConfig>
): AutonomyKillSwitch {
  return new AutonomyKillSwitch(config);
}

