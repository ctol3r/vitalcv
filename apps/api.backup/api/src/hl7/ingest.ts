
import { Router, Request, Response } from 'express';
import express from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { parseHL7 } from './parser';

const prisma = new PrismaClient();
export const hl7Router = Router();

// Parse text/plain and HL7 v2 mime types as string
// JSON will be parsed by global middleware in app.ts if content-type is application/json
hl7Router.post(
  '/ingest',
  express.text({ type: ['text/plain', 'application/hl7-v2'] }),
  async (req: Request, res: Response) => {
    try {
      let raw: string;

      if (typeof req.body === 'string') {
        raw = req.body;
      } else if (typeof req.body === 'object') {
        // If global json middleware parsed it
        raw = JSON.stringify(req.body);
      } else {
        // Buffer or other types
        return res.status(400).json({ ok: false, error: 'Unsupported content type or empty body' });
      }

      const { status, parsedData, error } = parseHL7(raw);

      const message = await prisma.hL7Message.create({
        data: {
          raw,
          parsed: parsedData ?? undefined,
          status,
        }
      });

      res.json({ ok: true, id: message.id, status: message.status });
    } catch (e) {
      console.error('HL7 ingest error', e);
      res.status(500).json({ ok: false, error: 'Internal server error' });
    }
  }
);

// GET /messages - List messages with optional status filter
hl7Router.get('/messages', async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const where: Prisma.HL7MessageWhereInput = {};
    if (status && typeof status === 'string') {
      where.status = status;
    }

    const messages = await prisma.hL7Message.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100
    });

    res.json({ ok: true, messages });
  } catch (e) {
    console.error('HL7 list error', e);
    res.status(500).json({ ok: false, error: 'Failed to list messages' });
  }
});

// POST /:id/retry - Manually retry parsing
hl7Router.post('/:id/retry', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const message = await prisma.hL7Message.findUnique({ where: { id } });

    if (!message) {
      return res.status(404).json({ ok: false, error: 'Message not found' });
    }

    const { status, parsedData } = parseHL7(message.raw);

    const updated = await prisma.hL7Message.update({
      where: { id },
      data: {
        status,
        parsed: parsedData ?? undefined
      }
    });

    res.json({ ok: true, message: updated });
  } catch (e) {
    console.error('HL7 retry error', e);
    res.status(500).json({ ok: false, error: 'Failed to retry message' });
  }
});
