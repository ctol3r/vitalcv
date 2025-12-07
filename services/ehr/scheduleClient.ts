const log = getServiceLogger('ehr/scheduleClient');
/**
 * B136A-EHR-011: Fetch Clinician Schedule for OPPE Metrics (Stub)
 *
 * Stub implementation for fetching clinician schedules from EHR.
 * Returns mocked schedule data. Real integration TBD.
 */

import { EhrConfig } from './models/EhrConfig.js';
import { getServiceLogger } from '../logging/serviceLogger';

/**
 * Date range for schedule query
 */
export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * Schedule entry
 */
export interface ScheduleEntry {
  id: string;
  clinicianId: string;
  date: Date;
  startTime: string;
  endTime: string;
  location?: string;
  department?: string;
  appointmentCount?: number;
  procedureCount?: number;
  metadata?: Record<string, any>;
}

/**
 * Schedule summary for OPPE metrics
 */
export interface ScheduleSummary {
  clinicianId: string;
  range: DateRange;
  totalDays: number;
  totalHours: number;
  totalAppointments: number;
  totalProcedures: number;
  entries: ScheduleEntry[];
}

/**
 * EHR Schedule Client (stub)
 */
export class ScheduleClient {
  private config: EhrConfig;

  constructor(config: EhrConfig) {
    this.config = config;
  }

  /**
   * Fetch schedule for a clinician (mocked for now)
   */
  async fetchSchedule(clinicianId: string, range: DateRange): Promise<ScheduleSummary> {
    log.info('[Schedule Client Stub] Fetching schedule:', {
      clinicianId,
      range,
      ehrType: this.config.ehrType,
      orgId: this.config.orgId,
    });

    // Mock schedule data
    const entries = generateMockSchedule(clinicianId, range);

    const summary: ScheduleSummary = {
      clinicianId,
      range,
      totalDays: entries.length,
      totalHours: entries.reduce((sum, e) => {
        const start = parseTime(e.startTime);
        const end = parseTime(e.endTime);
        return sum + (end - start);
      }, 0),
      totalAppointments: entries.reduce((sum, e) => sum + (e.appointmentCount || 0), 0),
      totalProcedures: entries.reduce((sum, e) => sum + (e.procedureCount || 0), 0),
      entries,
    };

    return summary;
  }

  /**
   * Fetch schedule summary only (no detailed entries)
   */
  async fetchScheduleSummary(clinicianId: string, range: DateRange): Promise<Omit<ScheduleSummary, 'entries'>> {
    const full = await this.fetchSchedule(clinicianId, range);
    const { entries, ...summary } = full;
    return summary;
  }
}

/**
 * Generate mock schedule for testing
 */
function generateMockSchedule(clinicianId: string, range: DateRange): ScheduleEntry[] {
  const entries: ScheduleEntry[] = [];
  const current = new Date(range.start);
  const end = new Date(range.end);

  let entryIndex = 0;
  while (current <= end) {
    // Skip weekends for mock data
    if (current.getDay() !== 0 && current.getDay() !== 6) {
      entries.push({
        id: `sched-${entryIndex++}`,
        clinicianId,
        date: new Date(current),
        startTime: '08:00',
        endTime: '17:00',
        location: 'Main Hospital',
        department: 'Surgery',
        appointmentCount: Math.floor(Math.random() * 12) + 4, // 4-15 appointments
        procedureCount: Math.floor(Math.random() * 5), // 0-4 procedures
        metadata: {
          stub: true,
        },
      });
    }

    current.setDate(current.getDate() + 1);
  }

  return entries;
}

/**
 * Parse time string (HH:MM) to hours
 */
function parseTime(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours + minutes / 60;
}

/**
 * Export for testing
 */
export async function testScheduleFetch(config: EhrConfig, clinicianId: string): Promise<ScheduleSummary> {
  const client = new ScheduleClient(config);
  const range: DateRange = {
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    end: new Date(),
  };
  return await client.fetchSchedule(clinicianId, range);
}

