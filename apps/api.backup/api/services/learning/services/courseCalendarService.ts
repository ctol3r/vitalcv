/**
 * B249B-LRN-014: CourseCalendarService
 *
 * Generates calendar events for live sessions and assignment due dates;
 * provides iCal feed per enrolled user; syncs with external calendars via API tokens
 */

import { PrismaClient } from '@prisma/client';
import ical, { ICalCalendar } from 'ical-generator';

export interface CalendarEvent {
  title: string;
  description?: string;
  start: Date;
  end: Date;
  location?: string;
  url?: string;
}

export interface LiveSession {
  courseId: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  meetingUrl?: string;
}

export interface AssignmentDueDate {
  courseId: string;
  moduleId: string;
  title: string;
  description?: string;
  dueDate: Date;
}

export class CourseCalendarService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Generate iCal feed for an enrolled user
   */
  async generateICalFeed(userId: string): Promise<string> {
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        userId,
        status: { in: ['enrolled', 'completed'] },
      },
      include: {
        course: {
          include: {
            modules: {
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    });

    const calendar = ical({
      prodId: { company: 'Chai VC Platform', product: 'Learning', language: 'EN' },
      name: 'Course Calendar',
      timezone: 'UTC',
    });

    // Add events for each enrollment
    for (const enrollment of enrollments) {
      // Add course start event
      calendar.createEvent({
        start: enrollment.enrolledAt,
        end: enrollment.enrolledAt,
        summary: `Started: ${enrollment.course.title}`,
        description: `You enrolled in ${enrollment.course.title}`,
        url: `/courses/${enrollment.course.slug}`,
      });

      // Add module events (if they have scheduled dates)
      for (const module of enrollment.course.modules) {
        if (module.contentUrl) {
          // You could add scheduled module access dates here
          // For now, we'll just add completion reminders
        }
      }

      // Add completion event if completed
      if (enrollment.completedAt) {
        calendar.createEvent({
          start: enrollment.completedAt,
          end: enrollment.completedAt,
          summary: `Completed: ${enrollment.course.title}`,
          description: `You completed ${enrollment.course.title}`,
          url: `/courses/${enrollment.course.slug}`,
        });
      }
    }

    return calendar.toString();
  }

  /**
   * Add live session to calendar
   */
  async addLiveSession(session: LiveSession): Promise<CalendarEvent> {
    // In a real implementation, you would store this in the database
    // For now, we'll just return the event structure
    const event: CalendarEvent = {
      title: session.title,
      description: session.description,
      start: session.startTime,
      end: session.endTime,
      url: session.meetingUrl,
    };

    return event;
  }

  /**
   * Add assignment due date to calendar
   */
  async addAssignmentDueDate(assignment: AssignmentDueDate): Promise<CalendarEvent> {
    const event: CalendarEvent = {
      title: `Due: ${assignment.title}`,
      description: assignment.description,
      start: assignment.dueDate,
      end: assignment.dueDate,
    };

    return event;
  }

  /**
   * Sync with external calendar (Google Calendar, Outlook, etc.)
   */
  async syncWithExternalCalendar(
    userId: string,
    calendarType: 'google' | 'outlook' | 'apple',
    accessToken: string
  ): Promise<void> {
    const icalFeed = await this.generateICalFeed(userId);

    // In a real implementation, you would:
    // 1. Convert iCal to the calendar provider's format
    // 2. Use the provider's API to sync events
    // 3. Handle conflicts and updates

    switch (calendarType) {
      case 'google':
        await this.syncWithGoogleCalendar(userId, icalFeed, accessToken);
        break;
      case 'outlook':
        await this.syncWithOutlookCalendar(userId, icalFeed, accessToken);
        break;
      case 'apple':
        await this.syncWithAppleCalendar(userId, icalFeed, accessToken);
        break;
      default:
        throw new Error(`Unsupported calendar type: ${calendarType}`);
    }
  }

  /**
   * Sync with Google Calendar
   */
  private async syncWithGoogleCalendar(
    userId: string,
    icalFeed: string,
    accessToken: string
  ): Promise<void> {
    // In a real implementation, you would use Google Calendar API
    // For now, this is a placeholder
    // Example:
    // const calendar = google.calendar({ version: 'v3', auth: accessToken });
    // Parse iCal feed and create/update events via Google Calendar API
  }

  /**
   * Sync with Outlook Calendar
   */
  private async syncWithOutlookCalendar(
    userId: string,
    icalFeed: string,
    accessToken: string
  ): Promise<void> {
    // In a real implementation, you would use Microsoft Graph API
    // For now, this is a placeholder
  }

  /**
   * Sync with Apple Calendar (iCloud)
   */
  private async syncWithAppleCalendar(
    userId: string,
    icalFeed: string,
    accessToken: string
  ): Promise<void> {
    // In a real implementation, you would use CalDAV protocol
    // For now, this is a placeholder
  }

  /**
   * Get calendar events for a user (for display in UI)
   */
  async getCalendarEvents(userId: string, startDate?: Date, endDate?: Date): Promise<CalendarEvent[]> {
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        userId,
        status: { in: ['enrolled', 'completed'] },
      },
      include: {
        course: true,
      },
    });

    const events: CalendarEvent[] = [];

    for (const enrollment of enrollments) {
      // Enrollment start
      if (!startDate || enrollment.enrolledAt >= startDate) {
        if (!endDate || enrollment.enrolledAt <= endDate) {
          events.push({
            title: `Started: ${enrollment.course.title}`,
            description: `You enrolled in ${enrollment.course.title}`,
            start: enrollment.enrolledAt,
            end: enrollment.enrolledAt,
            url: `/courses/${enrollment.course.slug}`,
          });
        }
      }

      // Completion
      if (enrollment.completedAt) {
        if (!startDate || enrollment.completedAt >= startDate) {
          if (!endDate || enrollment.completedAt <= endDate) {
            events.push({
              title: `Completed: ${enrollment.course.title}`,
              description: `You completed ${enrollment.course.title}`,
              start: enrollment.completedAt,
              end: enrollment.completedAt,
              url: `/courses/${enrollment.course.slug}`,
            });
          }
        }
      }
    }

    return events.sort((a, b) => a.start.getTime() - b.start.getTime());
  }
}

