import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface AIIncident {
  id: string;
  agentId: string;
  type: 'violation' | 'bias' | 'privacy_breach' | 'off_policy';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  status: 'open' | 'investigating' | 'resolved';
  createdAt: Date;
  resolvedAt?: Date;
}

// In-memory store (would use database in production)
const incidents: AIIncident[] = [];

/**
 * Create AI incident
 */
export async function createAIIncident(
  agentId: string,
  type: AIIncident['type'],
  severity: AIIncident['severity'],
  description: string,
): Promise<AIIncident> {
  const incident: AIIncident = {
    id: `incident_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    agentId,
    type,
    severity,
    description,
    status: 'open',
    createdAt: new Date(),
  };

  incidents.push(incident);
  return incident;
}

/**
 * Get incidents for agent
 */
export async function getAIIncidents(agentId?: string): Promise<AIIncident[]> {
  if (agentId) {
    return incidents.filter(i => i.agentId === agentId);
  }
  return incidents;
}

/**
 * Resolve incident
 */
export async function resolveAIIncident(incidentId: string): Promise<void> {
  const incident = incidents.find(i => i.id === incidentId);
  if (incident) {
    incident.status = 'resolved';
    incident.resolvedAt = new Date();
  }
}

