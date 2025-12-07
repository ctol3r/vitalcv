import {
  type FhirCodeableConcept,
  type FhirReference,
  type ScheduleResource,
  type SlotResource,
  type SlotStatus,
} from '../../../../../../services/fhir/types/r6';

export interface ScheduleAvailabilityWindow {
  id?: string;
  start: Date | string;
  end: Date | string;
  slotLengthMinutes?: number;
  location?: FhirReference;
  status?: SlotStatus;
  readinessScore?: number;
  requirements?: string[];
  telehealth?: boolean;
}

export interface ClinicianScheduleAvailability {
  scheduleId: string;
  clinicianId: string;
  practitionerRoleId: string;
  orgId?: string;
  serviceCategory?: FhirCodeableConcept[];
  serviceType?: FhirCodeableConcept[];
  specialty?: FhirCodeableConcept[];
  timezone?: string;
  comment?: string;
  windows: ScheduleAvailabilityWindow[];
}

export interface ScheduleMappingResult {
  schedule: ScheduleResource;
  slots: SlotResource[];
  practitionerRole: FhirReference;
}

const MIN_SLOT_MINUTES = 15;

export function mapClinicianScheduleAvailability(
  availability: ClinicianScheduleAvailability,
): ScheduleMappingResult {
  if (!availability.windows?.length) {
    throw new Error('At least one availability window is required to build a schedule');
  }

  const actorReferences = buildActorReferences(availability);
  const planningHorizon = derivePlanningHorizon(availability.windows);
  const schedule: ScheduleResource = {
    resourceType: 'Schedule',
    id: availability.scheduleId,
    actor: actorReferences,
    active: true,
    serviceCategory: availability.serviceCategory,
    serviceType: availability.serviceType,
    specialty: availability.specialty,
    planningHorizon,
    comment:
      availability.comment ??
      `Auto-generated from ${availability.windows.length} availability block(s).`,
    extension: availability.timezone
      ? [
          {
            url: 'https://vitalcv.health/fhir/StructureDefinition/timezone',
            valueString: availability.timezone,
          },
        ]
      : undefined,
  };

  const scheduleReference: FhirReference = { reference: `Schedule/${availability.scheduleId}` };
  const slots = availability.windows.flatMap((window, windowIndex) =>
    buildSlotsForWindow({
      scheduleReference,
      actors: actorReferences,
      window,
      windowIndex,
      serviceCategory: availability.serviceCategory,
      serviceType: availability.serviceType,
      specialty: availability.specialty,
    }),
  );

  return {
    schedule,
    slots,
    practitionerRole: { reference: `PractitionerRole/${availability.practitionerRoleId}` },
  };
}

function buildActorReferences(availability: ClinicianScheduleAvailability): FhirReference[] {
  const actors: FhirReference[] = [
    { reference: `PractitionerRole/${availability.practitionerRoleId}` },
    { reference: `Practitioner/${availability.clinicianId}` },
  ];
  if (availability.orgId) {
    actors.push({
      reference: `Organization/${availability.orgId}`,
    });
  }
  return actors;
}

function derivePlanningHorizon(windows: ScheduleAvailabilityWindow[]): {
  start?: string;
  end?: string;
} {
  const start = windows.reduce<Date | null>((earliest, window) => {
    const current = toDate(window.start);
    if (!earliest || current.getTime() < earliest.getTime()) {
      return current;
    }
    return earliest;
  }, null);

  const end = windows.reduce<Date | null>((latest, window) => {
    const current = toDate(window.end);
    if (!latest || current.getTime() > latest.getTime()) {
      return current;
    }
    return latest;
  }, null);

  return {
    start: start?.toISOString(),
    end: end?.toISOString(),
  };
}

function buildSlotsForWindow(options: {
  scheduleReference: FhirReference;
  actors: FhirReference[];
  window: ScheduleAvailabilityWindow;
  windowIndex: number;
  serviceCategory?: FhirCodeableConcept[];
  serviceType?: FhirCodeableConcept[];
  specialty?: FhirCodeableConcept[];
}): SlotResource[] {
  const { scheduleReference, actors, window, windowIndex } = options;
  const start = toDate(window.start);
  const end = toDate(window.end);

  if (end.getTime() <= start.getTime()) {
    throw new Error('Schedule window end must be after start');
  }

  const slotLength = Math.max(window.slotLengthMinutes ?? 60, MIN_SLOT_MINUTES);
  const slots: SlotResource[] = [];
  let cursor = new Date(start);
  let slotCursor = 0;

  while (cursor.getTime() < end.getTime()) {
    const slotEnd = new Date(Math.min(end.getTime(), cursor.getTime() + slotLength * 60 * 1000));
    const slot: SlotResource = {
      resourceType: 'Slot',
      id: `${scheduleReference.reference}:${window.id ?? windowIndex}:${slotCursor}`,
      schedule: scheduleReference,
      status: window.status ?? 'free',
      start: cursor.toISOString(),
      end: slotEnd.toISOString(),
      serviceCategory: options.serviceCategory,
      serviceType: options.serviceType,
      specialty: options.specialty,
      actor: actors,
      comment: buildSlotComment(window),
      extension: buildSlotExtensions(window),
    };

    if (window.location) {
      slot.actor = [...actors, window.location];
    }

    slots.push(slot);
    cursor = slotEnd;
    slotCursor += 1;
  }

  return slots;
}

function buildSlotComment(window: ScheduleAvailabilityWindow): string | undefined {
  const hints: string[] = [];
  if (window.telehealth) {
    hints.push('Telehealth-ready');
  }
  if (window.requirements?.length) {
    hints.push(`Requires: ${window.requirements.join(', ')}`);
  }
  return hints.length ? hints.join(' · ') : undefined;
}

function buildSlotExtensions(
  window: ScheduleAvailabilityWindow,
): Record<string, unknown>[] | undefined {
  const extensions: Record<string, unknown>[] = [];
  if (typeof window.readinessScore === 'number') {
    extensions.push({
      url: 'https://vitalcv.health/fhir/StructureDefinition/readinessScore',
      valueDecimal: Number(window.readinessScore.toFixed(4)),
    });
  }
  if (window.requirements?.length) {
    extensions.push({
      url: 'https://vitalcv.health/fhir/StructureDefinition/credentialRequirements',
      valueString: window.requirements.join(', '),
    });
  }
  return extensions.length ? extensions : undefined;
}

function toDate(value: Date | string): Date {
  if (value instanceof Date) {
    return value;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date value: ${value}`);
  }
  return parsed;
}

