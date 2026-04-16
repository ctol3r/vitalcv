import type { Request, Response } from 'express';

jest.mock('../../services/entity/passportService', () => ({
  buildPassportByNpi: jest.fn(),
}));

jest.mock('../../services/entity/employerPacket', () => ({
  buildEmployerEvidencePacket: jest.fn(),
}));

jest.mock('../../services/identity/identityIngestionPipeline', () => ({
  getVerificationReceiptsForNpi: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../obs/logger', () => ({
  log: jest.fn(),
}));

import { manifestCache } from '../../services/ttlCache';
import { buildPassportByNpi } from '../../services/entity/passportService';
import { buildEmployerEvidencePacket } from '../../services/entity/employerPacket';
import { getVerificationReceiptsForNpi } from '../../services/identity/identityIngestionPipeline';
import { registerManifestRoutes } from '../manifest';

const buildPassportByNpiMock = buildPassportByNpi as jest.MockedFunction<typeof buildPassportByNpi>;
const buildEmployerEvidencePacketMock =
  buildEmployerEvidencePacket as jest.MockedFunction<typeof buildEmployerEvidencePacket>;
const getVerificationReceiptsForNpiMock =
  getVerificationReceiptsForNpi as jest.MockedFunction<typeof getVerificationReceiptsForNpi>;

function buildGetHandler() {
  const get = jest.fn();
  registerManifestRoutes({ get } as never);
  const getCall = get.mock.calls.find((call) => call[0] === '/api/manifest/:npi');
  if (!getCall) {
    throw new Error('manifest route was not registered');
  }
  return getCall[1] as (req: Request, res: Response) => Promise<void>;
}

function buildResponse() {
  const res = {
    status: jest.fn(),
    json: jest.fn(),
    send: jest.fn(),
    type: jest.fn(),
    setHeader: jest.fn(),
  } as unknown as Response & {
    status: jest.Mock;
    json: jest.Mock;
    send: jest.Mock;
    type: jest.Mock;
    setHeader: jest.Mock;
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  res.send.mockReturnValue(res);
  res.type.mockReturnValue(res);
  return res;
}

describe('GET /api/manifest/:npi', () => {
  beforeEach(() => {
    manifestCache.clear();
    buildPassportByNpiMock.mockReset();
    buildEmployerEvidencePacketMock.mockReset();
    getVerificationReceiptsForNpiMock.mockReset().mockResolvedValue([]);
  });

  it('rejects invalid NPIs', async () => {
    const handler = buildGetHandler();
    const res = buildResponse();

    await handler({
      params: { npi: 'not-an-npi' },
      query: {},
    } as unknown as Request, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'invalid_npi',
      error_description: 'npi must be a 10-digit string.',
    });
  });

  it('caches serialized manifests and sanitizes employerId', async () => {
    buildPassportByNpiMock.mockResolvedValue({ entityId: 'entity-1' } as never);
    buildEmployerEvidencePacketMock.mockImplementation(({ employerId }) => ({
      manifestId: 'manifest-1',
      employerId,
      payload: { ready: true },
    }) as never);

    const handler = buildGetHandler();
    const firstResponse = buildResponse();
    const secondResponse = buildResponse();

    await handler({
      params: { npi: '1234567890' },
      query: { employerId: '  org-1  ' },
    } as unknown as Request, firstResponse);

    await handler({
      params: { npi: '1234567890' },
      query: { employerId: 'org-1' },
    } as unknown as Request, secondResponse);

    expect(firstResponse.status).toHaveBeenCalledWith(200);
    expect(firstResponse.setHeader).toHaveBeenCalledWith('X-VitalCV-Cache', 'MISS');
    expect(firstResponse.send).toHaveBeenCalledWith(
      JSON.stringify({
        manifestId: 'manifest-1',
        employerId: 'org-1',
        payload: { ready: true },
      }),
    );

    expect(secondResponse.status).toHaveBeenCalledWith(200);
    expect(secondResponse.setHeader).toHaveBeenCalledWith('X-VitalCV-Cache', 'HIT');
    expect(secondResponse.send).toHaveBeenCalledWith(
      JSON.stringify({
        manifestId: 'manifest-1',
        employerId: 'org-1',
        payload: { ready: true },
      }),
    );

    expect(buildPassportByNpiMock).toHaveBeenCalledTimes(1);
    expect(buildEmployerEvidencePacketMock).toHaveBeenCalledTimes(1);
    expect(getVerificationReceiptsForNpiMock).toHaveBeenCalledTimes(1);
    expect(buildEmployerEvidencePacketMock).toHaveBeenCalledWith({
      passport: { entityId: 'entity-1' },
      employerId: 'org-1',
    });
  });
});
