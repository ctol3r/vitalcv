/**
 * B252A-I18N-008: Timezone model
 *
 * Schema: id, name (e.g., 'America/Los_Angeles'), offsetMinutes,
 * observesDST (bool), region, createdAt, updatedAt
 * Includes migration and tests
 */

import { PrismaClient, Timezone as PrismaTimezone } from '@prisma/client';

export interface TimezoneInput {
  name: string; // e.g., 'America/Los_Angeles'
  offsetMinutes: number; // Offset from UTC in minutes
  observesDST: boolean;
  region: string; // Region/continent
}

export interface TimezoneOutput {
  id: string;
  name: string;
  offsetMinutes: number;
  observesDST: boolean;
  region: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * TimezoneService
 *
 * Manages timezone data
 */
export class TimezoneService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new timezone
   */
  async createTimezone(input: TimezoneInput): Promise<TimezoneOutput> {
    const timezone = await this.prisma.timezone.create({
      data: {
        name: input.name,
        offsetMinutes: input.offsetMinutes,
        observesDST: input.observesDST,
        region: input.region,
      },
    });

    return this.mapToOutput(timezone);
  }

  /**
   * Get a timezone by ID
   */
  async getTimezoneById(id: string): Promise<TimezoneOutput | null> {
    const timezone = await this.prisma.timezone.findUnique({
      where: { id },
    });

    return timezone ? this.mapToOutput(timezone) : null;
  }

  /**
   * Get a timezone by name
   */
  async getTimezoneByName(name: string): Promise<TimezoneOutput | null> {
    const timezone = await this.prisma.timezone.findUnique({
      where: { name },
    });

    return timezone ? this.mapToOutput(timezone) : null;
  }

  /**
   * Update a timezone
   */
  async updateTimezone(
    id: string,
    input: Partial<TimezoneInput>
  ): Promise<TimezoneOutput> {
    const timezone = await this.prisma.timezone.update({
      where: { id },
      data: {
        ...(input.name && { name: input.name }),
        ...(input.offsetMinutes !== undefined && { offsetMinutes: input.offsetMinutes }),
        ...(input.observesDST !== undefined && { observesDST: input.observesDST }),
        ...(input.region && { region: input.region }),
      },
    });

    return this.mapToOutput(timezone);
  }

  /**
   * Delete a timezone
   */
  async deleteTimezone(id: string): Promise<boolean> {
    try {
      await this.prisma.timezone.delete({
        where: { id },
      });
      return true;
    } catch (error: any) {
      if (error.code === 'P2025') {
        return false;
      }
      throw error;
    }
  }

  /**
   * List all timezones with pagination
   */
  async listTimezones(
    skip: number = 0,
    take: number = 100
  ): Promise<TimezoneOutput[]> {
    const timezones = await this.prisma.timezone.findMany({
      skip,
      take,
      orderBy: { name: 'asc' },
    });

    return timezones.map((t) => this.mapToOutput(t));
  }

  /**
   * List timezones by region
   */
  async listTimezonesByRegion(region: string): Promise<TimezoneOutput[]> {
    const timezones = await this.prisma.timezone.findMany({
      where: { region },
      orderBy: { name: 'asc' },
    });

    return timezones.map((t) => this.mapToOutput(t));
  }

  /**
   * Get or create a timezone (upsert by name)
   */
  async getOrCreateTimezone(input: TimezoneInput): Promise<TimezoneOutput> {
    const timezone = await this.prisma.timezone.upsert({
      where: { name: input.name },
      create: {
        name: input.name,
        offsetMinutes: input.offsetMinutes,
        observesDST: input.observesDST,
        region: input.region,
      },
      update: {
        offsetMinutes: input.offsetMinutes,
        observesDST: input.observesDST,
        region: input.region,
      },
    });

    return this.mapToOutput(timezone);
  }

  private mapToOutput(timezone: PrismaTimezone): TimezoneOutput {
    return {
      id: timezone.id,
      name: timezone.name,
      offsetMinutes: timezone.offsetMinutes,
      observesDST: timezone.observesDST,
      region: timezone.region,
      createdAt: timezone.createdAt,
      updatedAt: timezone.updatedAt,
    };
  }
}

