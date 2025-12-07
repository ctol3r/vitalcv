import { PrismaClient, DidcommThread } from '@prisma/client';

const prisma = new PrismaClient();

export interface ThreadTraceInput {
  threadId: string;
  parentThreadId?: string;
  auditEventId: string;
  messageType: string;
  connectionId?: string;
  metadata?: Record<string, any>;
  status?: string;
}

export async function recordThreadTrace(input: ThreadTraceInput): Promise<DidcommThread> {
  return prisma.didcommThread.upsert({
    where: { threadId: input.threadId },
    update: {
      parentThreadId: input.parentThreadId,
      auditEventId: input.auditEventId,
      messageType: input.messageType,
      connectionId: input.connectionId,
      metadata: input.metadata,
      status: input.status ?? 'pending',
    },
    create: {
      threadId: input.threadId,
      parentThreadId: input.parentThreadId,
      auditEventId: input.auditEventId,
      messageType: input.messageType,
      connectionId: input.connectionId,
      metadata: input.metadata,
      status: input.status ?? 'pending',
    },
  });
}

export async function markThreadStatus(
  threadId: string,
  status: string,
): Promise<DidcommThread | null> {
  return prisma.didcommThread.update({
    where: { threadId },
    data: { status },
  });
}

export async function findThread(threadId: string): Promise<DidcommThread | null> {
  return prisma.didcommThread.findUnique({
    where: { threadId },
  });
}

export async function listRecentThreads(limit = 25): Promise<DidcommThread[]> {
  return prisma.didcommThread.findMany({
    orderBy: { updatedAt: 'desc' },
    take: limit,
  });
}











