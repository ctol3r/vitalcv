/**
 * Support Tickets API
 *
 * Endpoints for creating and managing support tickets
 * POST /api/support/tickets - Create new ticket
 * PATCH /api/support/tickets/:id - Update ticket status/assignment
 * GET /api/support/tickets - List tickets for org
 * GET /api/support/tickets/:id - Get ticket details
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  SupportTicket,
  TicketStatus,
  TicketSeverity,
  TicketCategory,
  calculateSLADeadline
} from '../../../../services/support/models/SupportTicket.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Validation schemas
const CreateTicketSchema = z.object({
  orgId: z.string().uuid(),
  userId: z.string().uuid(),
  category: z.nativeEnum(TicketCategory),
  severity: z.nativeEnum(TicketSeverity),
  title: z.string().min(5).max(200),
  description: z.string().min(20).max(5000)
});

const UpdateTicketSchema = z.object({
  status: z.nativeEnum(TicketStatus).optional(),
  assignedTo: z.string().uuid().optional(),
  notes: z.string().max(1000).optional()
});

const ListTicketsQuerySchema = z.object({
  orgId: z.string().uuid().optional(),
  status: z.nativeEnum(TicketStatus).optional(),
  severity: z.nativeEnum(TicketSeverity).optional(),
  category: z.nativeEnum(TicketCategory).optional(),
  assignedTo: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});

/**
 * POST /api/support/tickets
 * Create a new support ticket
 */
router.post('/tickets', async (req: Request, res: Response) => {
  try {
    const validatedData = CreateTicketSchema.parse(req.body);

    const ticket: SupportTicket = {
      id: uuidv4(),
      orgId: validatedData.orgId,
      userId: validatedData.userId,
      category: validatedData.category,
      severity: validatedData.severity,
      status: TicketStatus.OPEN,
      title: validatedData.title,
      description: validatedData.description,
      createdAt: new Date(),
      updatedAt: new Date(),
      statusHistory: [],
      slaDeadline: calculateSLADeadline(new Date(), validatedData.severity)
    };

    // TODO: Save to database
    // await db.query('INSERT INTO support_tickets ...', ticket);

    // Log audit event
    await logAuditEvent({
      eventType: 'support_ticket.created',
      actorId: validatedData.userId,
      orgId: validatedData.orgId,
      resourceType: 'support_ticket',
      resourceId: ticket.id,
      metadata: {
        severity: ticket.severity,
        category: ticket.category,
        slaDeadline: ticket.slaDeadline
      },
      timestamp: new Date()
    });

    // Send notifications based on severity
    if (ticket.severity === TicketSeverity.SEV1 || ticket.severity === TicketSeverity.SEV2) {
      await notifyOnCall(ticket);
    }

    res.status(201).json({
      success: true,
      data: ticket,
      message: 'Support ticket created successfully'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors
      });
    }

    console.error('Error creating support ticket:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create support ticket'
    });
  }
});

/**
 * PATCH /api/support/tickets/:id
 * Update ticket status or assignment
 */
router.patch('/tickets/:id', async (req: Request, res: Response) => {
  try {
    const ticketId = req.params.id;
    const validatedData = UpdateTicketSchema.parse(req.body);
    const actorId = req.user?.id || 'system'; // Assume auth middleware adds user

    // TODO: Fetch existing ticket from database
    // const existingTicket = await db.query('SELECT * FROM support_tickets WHERE id = $1', [ticketId]);

    const existingTicket: Partial<SupportTicket> = {
      id: ticketId,
      status: TicketStatus.OPEN,
      statusHistory: []
    };

    const updates: Partial<SupportTicket> = {
      updatedAt: new Date()
    };

    // Handle status change
    if (validatedData.status && validatedData.status !== existingTicket.status) {
      updates.status = validatedData.status;

      // Add to status history
      const statusChange = {
        fromStatus: existingTicket.status!,
        toStatus: validatedData.status,
        changedBy: actorId,
        changedAt: new Date(),
        notes: validatedData.notes
      };

      // TODO: Insert into support_ticket_status_history table

      // Update timestamps based on status
      if (validatedData.status === TicketStatus.RESOLVED) {
        updates.resolvedAt = new Date();
      } else if (validatedData.status === TicketStatus.CLOSED) {
        updates.closedAt = new Date();
      }

      // Log audit event for status change
      await logAuditEvent({
        eventType: 'support_ticket.status_changed',
        actorId: actorId,
        orgId: existingTicket.orgId!,
        resourceType: 'support_ticket',
        resourceId: ticketId,
        metadata: {
          fromStatus: existingTicket.status,
          toStatus: validatedData.status,
          notes: validatedData.notes
        },
        timestamp: new Date()
      });
    }

    // Handle assignment change
    if (validatedData.assignedTo !== undefined) {
      updates.assignedTo = validatedData.assignedTo;

      // Track first response time
      if (!existingTicket.firstResponseAt && validatedData.assignedTo) {
        updates.firstResponseAt = new Date();
      }

      await logAuditEvent({
        eventType: 'support_ticket.assigned',
        actorId: actorId,
        orgId: existingTicket.orgId!,
        resourceType: 'support_ticket',
        resourceId: ticketId,
        metadata: {
          assignedTo: validatedData.assignedTo
        },
        timestamp: new Date()
      });
    }

    // TODO: Update database
    // await db.query('UPDATE support_tickets SET ... WHERE id = $1', [ticketId, updates]);

    res.json({
      success: true,
      data: { id: ticketId, ...updates },
      message: 'Ticket updated successfully'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors
      });
    }

    console.error('Error updating support ticket:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update support ticket'
    });
  }
});

/**
 * GET /api/support/tickets
 * List tickets with filters
 */
router.get('/tickets', async (req: Request, res: Response) => {
  try {
    const query = ListTicketsQuerySchema.parse(req.query);

    // Build WHERE clause based on filters
    const filters: string[] = [];
    const params: any[] = [];

    if (query.orgId) {
      params.push(query.orgId);
      filters.push(`org_id = $${params.length}`);
    }

    if (query.status) {
      params.push(query.status);
      filters.push(`status = $${params.length}`);
    }

    if (query.severity) {
      params.push(query.severity);
      filters.push(`severity = $${params.length}`);
    }

    if (query.category) {
      params.push(query.category);
      filters.push(`category = $${params.length}`);
    }

    if (query.assignedTo) {
      params.push(query.assignedTo);
      filters.push(`assigned_to = $${params.length}`);
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
    const offset = (query.page - 1) * query.limit;

    // TODO: Execute query
    // const tickets = await db.query(`
    //   SELECT * FROM support_tickets
    //   ${whereClause}
    //   ORDER BY created_at DESC
    //   LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    // `, [...params, query.limit, offset]);

    // Mock response
    const tickets: SupportTicket[] = [];
    const total = 0;

    res.json({
      success: true,
      data: tickets,
      pagination: {
        page: query.page,
        limit: query.limit,
        total: total,
        totalPages: Math.ceil(total / query.limit)
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: error.errors
      });
    }

    console.error('Error listing support tickets:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list support tickets'
    });
  }
});

/**
 * GET /api/support/tickets/:id
 * Get ticket details including history
 */
router.get('/tickets/:id', async (req: Request, res: Response) => {
  try {
    const ticketId = req.params.id;

    // TODO: Fetch from database with status history and attachments
    // const ticket = await db.query(`
    //   SELECT t.*,
    //     json_agg(h.*) as status_history,
    //     json_agg(a.*) as attachments
    //   FROM support_tickets t
    //   LEFT JOIN support_ticket_status_history h ON h.ticket_id = t.id
    //   LEFT JOIN support_ticket_attachments a ON a.ticket_id = t.id
    //   WHERE t.id = $1
    //   GROUP BY t.id
    // `, [ticketId]);

    // Mock response
    const ticket: SupportTicket | null = null;

    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: 'Ticket not found'
      });
    }

    res.json({
      success: true,
      data: ticket
    });
  } catch (error) {
    console.error('Error fetching support ticket:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch support ticket'
    });
  }
});

// Helper functions

interface AuditEvent {
  eventType: string;
  actorId: string;
  orgId: string;
  resourceType: string;
  resourceId: string;
  metadata: Record<string, any>;
  timestamp: Date;
}

async function logAuditEvent(event: AuditEvent): Promise<void> {
  // TODO: Implement audit logging
  // This should integrate with existing audit service
  console.log('[AUDIT]', event);
}

async function notifyOnCall(ticket: SupportTicket): Promise<void> {
  // TODO: Implement on-call notification
  // Integration with PagerDuty, Slack, etc.
  console.log('[ON-CALL ALERT]', {
    ticketId: ticket.id,
    severity: ticket.severity,
    title: ticket.title
  });
}

export default router;

