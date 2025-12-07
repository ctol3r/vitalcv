/**
 * B225A-FIN-002: RevenueRecognitionEvent model
 *
 * Represents a revenue recognition event that tracks when revenue
 * should be recognized based on different schedules (immediate, linear, rateable).
 */

import { PrismaClient } from '@prisma/client';

export type RecognitionSchedule = 'immediate' | 'linear' | 'rateable';
export type RevenueRecognitionStatus = 'pending' | 'recognized' | 'settled';

export interface RevenueRecognitionEventData {
  id?: string;
  eventId: string;
  orgId?: string | null;
  amount: number;
  revenueType: 'VITA' | 'FIAT';
  recognitionSchedule?: RecognitionSchedule;
  recognizedAt?: Date | null;
  status?: RevenueRecognitionStatus;
  metadata?: Record<string, any> | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class RevenueRecognitionEvent {
  constructor(
    private prisma: PrismaClient,
    public readonly id: string,
    public readonly eventId: string,
    public readonly orgId: string | null,
    public readonly amount: number,
    public readonly revenueType: 'VITA' | 'FIAT',
    public readonly recognitionSchedule: RecognitionSchedule,
    public readonly recognizedAt: Date | null,
    public readonly status: RevenueRecognitionStatus,
    public readonly metadata: Record<string, any> | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  /**
   * Create a new revenue recognition event
   */
  static async create(
    prisma: PrismaClient,
    data: RevenueRecognitionEventData
  ): Promise<RevenueRecognitionEvent> {
    const event = await prisma.revenueRecognitionEvent.create({
      data: {
        eventId: data.eventId,
        orgId: data.orgId ?? null,
        amount: data.amount,
        revenueType: data.revenueType,
        recognitionSchedule: data.recognitionSchedule ?? 'immediate',
        recognizedAt: data.recognizedAt ?? null,
        status: data.status ?? 'pending',
        metadata: data.metadata ?? null,
      },
    });

    return new RevenueRecognitionEvent(
      prisma,
      event.id,
      event.eventId,
      event.orgId,
      event.amount,
      event.revenueType as 'VITA' | 'FIAT',
      event.recognitionSchedule as RecognitionSchedule,
      event.recognizedAt,
      event.status as RevenueRecognitionStatus,
      event.metadata as Record<string, any> | null,
      event.createdAt,
      event.updatedAt
    );
  }

  /**
   * Find revenue recognition event by ID
   */
  static async findById(
    prisma: PrismaClient,
    id: string
  ): Promise<RevenueRecognitionEvent | null> {
    const event = await prisma.revenueRecognitionEvent.findUnique({
      where: { id },
    });

    if (!event) return null;

    return new RevenueRecognitionEvent(
      prisma,
      event.id,
      event.eventId,
      event.orgId,
      event.amount,
      event.revenueType as 'VITA' | 'FIAT',
      event.recognitionSchedule as RecognitionSchedule,
      event.recognizedAt,
      event.status as RevenueRecognitionStatus,
      event.metadata as Record<string, any> | null,
      event.createdAt,
      event.updatedAt
    );
  }

  /**
   * Find revenue recognition events by event ID
   */
  static async findByEventId(
    prisma: PrismaClient,
    eventId: string
  ): Promise<RevenueRecognitionEvent[]> {
    const events = await prisma.revenueRecognitionEvent.findMany({
      where: { eventId },
      orderBy: { createdAt: 'desc' },
    });

    return events.map(
      (event) =>
        new RevenueRecognitionEvent(
          prisma,
          event.id,
          event.eventId,
          event.orgId,
          event.amount,
          event.revenueType as 'VITA' | 'FIAT',
          event.recognitionSchedule as RecognitionSchedule,
          event.recognizedAt,
          event.status as RevenueRecognitionStatus,
          event.metadata as Record<string, any> | null,
          event.createdAt,
          event.updatedAt
        )
    );
  }

  /**
   * Find revenue recognition events by organization ID
   */
  static async findByOrgId(
    prisma: PrismaClient,
    orgId: string,
    options?: {
      status?: RevenueRecognitionStatus;
      revenueType?: 'VITA' | 'FIAT';
      limit?: number;
      offset?: number;
    }
  ): Promise<RevenueRecognitionEvent[]> {
    const events = await prisma.revenueRecognitionEvent.findMany({
      where: {
        orgId,
        ...(options?.status && { status: options.status }),
        ...(options?.revenueType && { revenueType: options.revenueType }),
      },
      take: options?.limit,
      skip: options?.offset,
      orderBy: { createdAt: 'desc' },
    });

    return events.map(
      (event) =>
        new RevenueRecognitionEvent(
          prisma,
          event.id,
          event.eventId,
          event.orgId,
          event.amount,
          event.revenueType as 'VITA' | 'FIAT',
          event.recognitionSchedule as RecognitionSchedule,
          event.recognizedAt,
          event.status as RevenueRecognitionStatus,
          event.metadata as Record<string, any> | null,
          event.createdAt,
          event.updatedAt
        )
    );
  }

  /**
   * Find pending revenue recognition events
   */
  static async findPending(
    prisma: PrismaClient,
    options?: {
      limit?: number;
      offset?: number;
    }
  ): Promise<RevenueRecognitionEvent[]> {
    const events = await prisma.revenueRecognitionEvent.findMany({
      where: {
        status: 'pending',
      },
      take: options?.limit,
      skip: options?.offset,
      orderBy: { createdAt: 'asc' },
    });

    return events.map(
      (event) =>
        new RevenueRecognitionEvent(
          prisma,
          event.id,
          event.eventId,
          event.orgId,
          event.amount,
          event.revenueType as 'VITA' | 'FIAT',
          event.recognitionSchedule as RecognitionSchedule,
          event.recognizedAt,
          event.status as RevenueRecognitionStatus,
          event.metadata as Record<string, any> | null,
          event.createdAt,
          event.updatedAt
        )
    );
  }

  /**
   * Update the status of the revenue recognition event
   */
  async updateStatus(
    status: RevenueRecognitionStatus,
    recognizedAt?: Date | null
  ): Promise<RevenueRecognitionEvent> {
    const updated = await this.prisma.revenueRecognitionEvent.update({
      where: { id: this.id },
      data: {
        status,
        ...(recognizedAt !== undefined && { recognizedAt }),
      },
    });

    return new RevenueRecognitionEvent(
      this.prisma,
      updated.id,
      updated.eventId,
      updated.orgId,
      updated.amount,
      updated.revenueType as 'VITA' | 'FIAT',
      updated.recognitionSchedule as RecognitionSchedule,
      updated.recognizedAt,
      updated.status as RevenueRecognitionStatus,
      updated.metadata as Record<string, any> | null,
      updated.createdAt,
      updated.updatedAt
    );
  }

  /**
   * Convert to plain object
   */
  toJSON(): RevenueRecognitionEventData {
    return {
      id: this.id,
      eventId: this.eventId,
      orgId: this.orgId,
      amount: this.amount,
      revenueType: this.revenueType,
      recognitionSchedule: this.recognitionSchedule,
      recognizedAt: this.recognizedAt,
      status: this.status,
      metadata: this.metadata,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

