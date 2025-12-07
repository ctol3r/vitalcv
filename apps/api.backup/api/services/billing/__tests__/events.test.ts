/**
 * Tests for billing event pipeline
 * B133C-PRICING-002
 */

import {
  billingEvents,
  emitJobPostCreated,
  emitApplicationCreated,
  emitHireConfirmed,
  initializeBillingPipeline,
  ApplicationCreatedEvent,
  HireConfirmedEvent,
} from '../events';

describe('Billing Events Pipeline', () => {
  beforeEach(() => {
    // Clear all event listeners
    billingEvents.removeAllListeners();
  });

  describe('applicationCreated event', () => {
    it('should emit and consume applicationCreated event', (done) => {
      const testEvent: ApplicationCreatedEvent = {
        eventType: 'applicationCreated',
        timestamp: new Date(),
        organizationId: 'org-123',
        partnerId: 'partner-456',
        jobId: 'job-789',
        applicationId: 'app-101',
        candidateId: 'candidate-202',
        applicantDid: 'did:example:123',
        evidenceIds: ['vc-1', 'vc-2'],
        metadata: { source: 'test' },
      };

      billingEvents.onApplicationCreated((event) => {
        expect(event.organizationId).toBe('org-123');
        expect(event.partnerId).toBe('partner-456');
        expect(event.jobId).toBe('job-789');
        expect(event.applicationId).toBe('app-101');
        expect(event.evidenceIds).toHaveLength(2);
        done();
      });

      emitApplicationCreated(
        'org-123',
        'partner-456',
        'job-789',
        'app-101',
        'candidate-202',
        'did:example:123',
        ['vc-1', 'vc-2'],
        { source: 'test' }
      );
    });
  });

  describe('hireConfirmed event', () => {
    it('should emit and consume hireConfirmed event', (done) => {
      const hireDate = new Date('2025-11-15');

      billingEvents.onHireConfirmed((event) => {
        expect(event.organizationId).toBe('org-123');
        expect(event.partnerId).toBe('partner-456');
        expect(event.jobId).toBe('job-789');
        expect(event.applicationId).toBe('app-101');
        expect(event.candidateId).toBe('candidate-202');
        expect(event.hireDate).toEqual(hireDate);
        expect(event.estimatedSalary).toBe(120000);
        done();
      });

      emitHireConfirmed(
        'org-123',
        'partner-456',
        'job-789',
        'app-101',
        'candidate-202',
        hireDate,
        120000,
        { position: 'Senior RN' }
      );
    });
  });

  describe('billing pipeline', () => {
    it('should initialize and process events', () => {
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      initializeBillingPipeline();

      emitApplicationCreated(
        'org-123',
        'partner-456',
        'job-789',
        'app-101',
        'candidate-202',
        'did:example:123',
        ['vc-1']
      );

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Billing Pipeline] Processing application created: app-101')
      );

      emitHireConfirmed(
        'org-123',
        'partner-456',
        'job-789',
        'app-101',
        'candidate-202',
        new Date()
      );

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Billing Pipeline] Processing hire confirmed: app-101')
      );

      consoleLogSpy.mockRestore();
    });
  });

  describe('event structure validation', () => {
    it('should include all required fields in applicationCreated', (done) => {
      billingEvents.onApplicationCreated((event) => {
        expect(event).toHaveProperty('eventType', 'applicationCreated');
        expect(event).toHaveProperty('timestamp');
        expect(event).toHaveProperty('organizationId');
        expect(event).toHaveProperty('partnerId');
        expect(event).toHaveProperty('jobId');
        expect(event).toHaveProperty('applicationId');
        expect(event).toHaveProperty('candidateId');
        expect(event).toHaveProperty('applicantDid');
        expect(event).toHaveProperty('evidenceIds');
        done();
      });

      emitApplicationCreated(
        'org-1',
        'partner-1',
        'job-1',
        'app-1',
        'candidate-1',
        'did:1',
        ['vc-1']
      );
    });

    it('should include all required fields in hireConfirmed', (done) => {
      billingEvents.onHireConfirmed((event) => {
        expect(event).toHaveProperty('eventType', 'hireConfirmed');
        expect(event).toHaveProperty('timestamp');
        expect(event).toHaveProperty('organizationId');
        expect(event).toHaveProperty('partnerId');
        expect(event).toHaveProperty('jobId');
        expect(event).toHaveProperty('applicationId');
        expect(event).toHaveProperty('candidateId');
        expect(event).toHaveProperty('hireDate');
        done();
      });

      emitHireConfirmed(
        'org-1',
        'partner-1',
        'job-1',
        'app-1',
        'candidate-1',
        new Date()
      );
    });
  });
});

