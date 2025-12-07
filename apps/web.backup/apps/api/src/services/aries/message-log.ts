import { PrismaClient, AriesMessageDirection } from '@prisma/client';

const prisma = new PrismaClient();

export interface MessageLogInput {
  threadId: string;
  connectionId?: string | null;
  messageType: string;
  payload: Record<string, unknown>;
  auditId?: string;
}

export async function recordOutboundMessage(input: MessageLogInput) {
  await prisma.ariesMessageLog.create({
    data: {
      threadId: input.threadId,
      connectionId: input.connectionId ?? null,
      messageType: input.messageType,
      payload: input.payload,
      auditId: input.auditId,
      direction: AriesMessageDirection.OUTBOUND,
    },
  });
}

export async function recordInboundMessage(input: MessageLogInput) {
  await prisma.ariesMessageLog.create({
    data: {
      threadId: input.threadId,
      connectionId: input.connectionId ?? null,
      messageType: input.messageType,
      payload: input.payload,
      auditId: input.auditId,
      direction: AriesMessageDirection.INBOUND,
    },
  });
}

export async function listMessagesByThread(threadId: string) {
  return prisma.ariesMessageLog.findMany({
    where: { threadId },
    orderBy: { createdAt: 'asc' },
  });
}










