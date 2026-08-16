import { HttpError } from '../../../utils/httpError';
import {
  normalizeStartMissionState,
  readStartMission,
  type StartMissionReadDependencies,
} from '../startMissionReadService';
import type { ApplicationPacketReadResponse } from '../../opportunities/applicationPacketReadService';

const IDS = {
  app: '4b6f0000-0000-4000-8000-000000000001',
  opp: '4b6f0000-0000-4000-8000-000000000002',
  org: '4b6f0000-0000-4000-8000-000000000003',
  activation: '4b6f0000-0000-4000-8000-000000000004',
  packet: '4b6f0000-0000-4000-8000-000000000005',
  requirement: '4b6f0000-0000-4000-8000-000000000006',
};

function packet(hash = 'packet-hash'): ApplicationPacketReadResponse {
  return {
    applicationId: IDS.app,
    opportunityId: IDS.opp,
    accessPerspective: 'clinician',
    mode: 'sealed',
    submittedPacket: {
      packetVersion: 1,
      packetHash: hash,
      opportunityVersion: '2026-08-14T10:00:00.000Z',
      clinicianNpi: '1558302470',
      integrity: 'valid',
      purpose: 'application',
      recipient: 'Example Health',
      consentAt: '2026-07-30T12:00:00.000Z',
      consentReceiptId: '4b6f0000-0000-4000-8000-000000000007',
      consentGrantId: '4b6f0000-0000-4000-8000-000000000008',
      selectedSections: ['identity'],
      // Derived from the sealed fields, never a stored parallel list — and this
      // fixture seals none, so nothing is withheld.
      withheldFieldIds: [],
      fields: [],
      // No selected section is left silent: `[]` asserts that every section in
      // the disclosure contributed, and nothing is unaccounted for.
      sectionAbsences: [],
      unexplainedSectionIds: [],
      methodologyVersion: 'phase1',
      clinicianNote: null,
      lifecycle: 'active',
    },
    legacyNotice: null,
  };
}

function persistence(overrides: Record<string, unknown> = {}) {
  return {
    application: {
      id: IDS.app,
      clerkUserId: 'user_clinician',
      npi: '1558302470',
      opportunityId: IDS.opp,
      opportunity: { organizationId: IDS.org, title: 'Hospitalist' },
    },
    activation: {
      id: IDS.activation,
      clinicianNpi: '1558302470',
      orgId: IDS.org,
      acceptanceId: null,
      activationState: 'requirements_in_progress',
      applicationId: IDS.app,
      opportunityId: IDS.opp,
      acceptedPacketId: IDS.packet,
      acceptedPacketHash: 'packet-hash',
      intendedStartDate: null,
      urgency: 'priority',
      policyVersion: 'pilot-v1',
      createdAt: new Date('2026-07-30T12:00:00.000Z'),
      updatedAt: new Date('2026-07-30T12:01:00.000Z'),
    },
    acceptedPacket: {
      id: IDS.packet,
      applicationId: IDS.app,
      packetVersion: 1,
      packetHash: 'packet-hash',
    },
    acceptance: null,
    requirements: [{
      id: IDS.requirement,
      category: 'evidence',
      label: 'Training verification',
      necessity: 'required',
      status: 'requested',
      owner: 'clinician',
      evidenceRule: 'training.complete',
      dependencyIds: [],
      dueAt: null,
      resolvedBy: null,
      resolvedAt: null,
      policyVersion: 'pilot-v1',
    }],
    verificationRequests: [],
    communications: [],
    ...overrides,
  };
}

describe('readStartMission', () => {
  it('authorizes through the existing packet boundary before loading mission data', async () => {
    let loadCalled = false;
    const dependencies: StartMissionReadDependencies = {
      readPacket: async () => { throw new HttpError(404, 'Application packet not found.'); },
      load: async () => {
        loadCalled = true;
        return persistence();
      },
    };

    await expect(readStartMission({ applicationId: IDS.app, clerkUserId: 'foreign_user' }, dependencies))
      .rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
    expect(loadCalled).toBe(false);
  });

  it('does not infer a mission from application state when no StartActivation exists', async () => {
    const dependencies: StartMissionReadDependencies = {
      readPacket: async () => packet(),
      load: async () => persistence({ activation: null, acceptedPacket: null }),
    };

    const result = await readStartMission({ applicationId: IDS.app, clerkUserId: 'user_clinician' }, dependencies);
    expect(result).toMatchObject({
      status: 'not_opened',
      packetHash: 'packet-hash',
    });
  });

  it('fails closed when the persisted accepted packet hash does not replay', async () => {
    const dependencies: StartMissionReadDependencies = {
      readPacket: async (input) => input.packetVersion ? packet('tampered-hash') : packet(),
      load: async () => persistence(),
    };

    await expect(readStartMission({ applicationId: IDS.app, clerkUserId: 'user_clinician' }, dependencies))
      .rejects.toMatchObject({ status: 409, code: 'START_MISSION_BINDING_FAILED' });
  });

  it('returns one bound mission with blockers and a clinician next action', async () => {
    const dependencies: StartMissionReadDependencies = {
      readPacket: async () => packet(),
      load: async () => persistence(),
    };

    const result = await readStartMission({ applicationId: IDS.app, clerkUserId: 'user_clinician' }, dependencies);
    expect(result.status).toBe('open');
    if (result.status !== 'open') throw new Error('expected open mission');

    expect(result.mission.packetBinding).toBe('bound');
    expect(result.mission.state).toBe('requirements_in_progress');
    expect(result.mission.blockerSummary).toEqual([{
      requirementId: IDS.requirement,
      label: 'Training verification',
      status: 'requested',
      owner: 'clinician',
      dueAt: null,
    }]);
    expect(result.mission.nextAction).toMatchObject({
      kind: 'clinician_requirement',
      owner: 'clinician',
      objectId: IDS.requirement,
    });
  });

  it('preserves unknown historical activation states instead of inventing meaning', () => {
    expect(normalizeStartMissionState('NOT_STARTABLE')).toBe('unknown');
  });
});
