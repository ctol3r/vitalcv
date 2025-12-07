import { Router, Request, Response } from 'express';
import {
  loadUserSession,
  requireAuth,
  AuthenticatedRequest,
} from '../../../../../backend/src/middleware/accessGuards';
import { PrismaClient } from '@prisma/client';
import { CommitteePacketStatus } from '../../../../../services/committeePacket/models/CommitteePacket';
import {
  assembleCommitteePacket,
  generateCommitteePacketSnapshot,
} from '../../../../../services/committeePacket/assemble';
import { loadCommitteePacketDocument } from '../../../../../services/committeePacket/saveSnapshot';

const prisma = new PrismaClient();
const router = Router();
const DEFAULT_FRESHNESS_MINUTES = Number(process.env.COMMITTEE_PACKET_FRESHNESS_MINUTES ?? 360);
const FRESHNESS_WINDOW_MS = DEFAULT_FRESHNESS_MINUTES * 60 * 1000;

router.use(loadUserSession, requireAuth);

router.get('/:clinicianId/latest', async (req: Request, res: Response) => {
  try {
    const { clinicianId } = req.params;
    if (!clinicianId) {
      return res.status(400).json({ success: false, error: 'clinician_id_required' });
    }

    const clinician = await prisma.clinicianProfile.findUnique({
      where: { id: clinicianId },
      select: { id: true, userId: true },
    });

    if (!clinician) {
      return res.status(404).json({ success: false, error: 'clinician_not_found' });
    }

    const authReq = req as AuthenticatedRequest;
    if (!canAccessPackets(authReq.user, clinician.userId)) {
      return res.status(403).json({ success: false, error: 'forbidden' });
    }

    let packet = await prisma.committeePacket.findFirst({
      where: { clinicianId },
      orderBy: { snapshotAt: 'desc' },
    });

    const now = Date.now();
    const isStale = !packet || now - packet.snapshotAt.getTime() > FRESHNESS_WINDOW_MS;

    if (isStale) {
      packet = await generateCommitteePacketSnapshot({
        clinicianId,
        statusOverride: packet ? CommitteePacketStatus.REGENERATED : CommitteePacketStatus.GENERATED,
      });
    }

    if (!packet) {
      const document = await assembleCommitteePacket({ clinicianId });
      return res.status(200).json({
        success: true,
        regenerated: true,
        packet: null,
        document,
      });
    }

    const document = await loadCommitteePacketDocument(packet);

    return res.status(200).json({
      success: true,
      packet,
      document,
      regenerated: isStale,
      freshnessWindowMinutes: DEFAULT_FRESHNESS_MINUTES,
    });
  } catch (error) {
    console.error('[CommitteePacket] Failed to load packet', error);
    return res.status(500).json({
      success: false,
      error: 'internal_error',
      message: error instanceof Error ? error.message : 'unknown_error',
    });
  }
});

function canAccessPackets(user: AuthenticatedRequest['user'], ownerId: string) {
  if (!user) return false;
  const adminRoles = new Set(['ORG_ADMIN', 'INTERNAL_ADMIN']);
  const isAdmin = user.roles?.some((role) => adminRoles.has(role));
  const isSelf = user.id && user.id.toString() === ownerId;
  return Boolean(isAdmin || isSelf);
}

export default router;
