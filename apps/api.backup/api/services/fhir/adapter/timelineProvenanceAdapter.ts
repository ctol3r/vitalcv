import { TimelineEvent, TIMELINE_PHASE_LABELS } from '../../timeline/types';
import { ProvenanceResource, FhirCodeableConcept } from '../types/r6';

export interface TimelineProvenanceOptions {
  /**
   * Reference to the Practitioner resource (e.g., Practitioner/123)
   */
  subjectReference: string;
  /**
   * Display name for the system emitting timeline evidence.
   */
  sourceDisplay?: string;
}

const PHASE_SYSTEM = 'https://chai-vc.com/fhir/codes/timeline-phase';
const ACTIVITY_SYSTEM = 'https://chai-vc.com/fhir/codes/timeline-activity';
const STATUS_SYSTEM = 'https://chai-vc.com/fhir/codes/timeline-status';

function buildCodeableConcept(system: string, code: string, display?: string): FhirCodeableConcept {
  return {
    coding: [
      {
        system,
        code,
        display: display ?? code,
      },
    ],
    text: display,
  };
}

export function timelineEventsToProvenance(
  events: TimelineEvent[],
  options: TimelineProvenanceOptions
): ProvenanceResource[] {
  const recordedAt = new Date().toISOString();

  return events.map((event) => ({
    resourceType: 'Provenance',
    id: `prov-${event.id}`,
    recorded: recordedAt,
    occurredDateTime: event.timestamp.toISOString(),
    target: [
      {
        reference: options.subjectReference,
        display: options.sourceDisplay ?? 'Clinician timeline target',
      },
    ],
    activity: buildCodeableConcept(ACTIVITY_SYSTEM, event.type, event.title),
    reason: [
      buildCodeableConcept(PHASE_SYSTEM, event.phase, TIMELINE_PHASE_LABELS[event.phase]),
    ],
    agent: [
      {
        type: buildCodeableConcept(
          'http://terminology.hl7.org/CodeSystem/provenance-participant-type',
          'author',
          'Author'
        ),
        role: event.status
          ? [
              buildCodeableConcept(
                STATUS_SYSTEM,
                event.status,
                event.status.replace(/_/g, ' ')
              ),
            ]
          : undefined,
        who: event.actor?.reference
          ? { reference: event.actor.reference, display: event.actor.display }
          : { display: event.actor?.display ?? options.sourceDisplay ?? 'Chai VC Platform' },
      },
    ],
  }));
}


