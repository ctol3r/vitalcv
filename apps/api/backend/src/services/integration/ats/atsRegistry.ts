import { addGreenhouseNote, tagGreenhouseCandidate } from './greenhouse';
import { addICIMSNote } from './icims';
import { addLeverNote, addLeverTag } from './lever';
import { getWorkdayAccessToken, updateWorkdayWorkerNote } from './workday';

export type AtsType = 'greenhouse' | 'lever' | 'workday' | 'icims';
export type AtsAction = 'add_note' | 'add_tag';

export interface AtsNotificationRequest {
  type: AtsType;
  candidateId: string;
  action: AtsAction;
  value: string;
}

export interface AtsNotificationResult {
  notified: boolean;
  skipped: boolean;
}

export async function notifyAts(
  request: AtsNotificationRequest,
): Promise<AtsNotificationResult> {
  switch (request.type) {
    case 'greenhouse': {
      const apiKey = process.env.GREENHOUSE_API_KEY;
      if (!apiKey) {
        return { notified: false, skipped: true };
      }

      const notified =
        request.action === 'add_note'
          ? await addGreenhouseNote(request.candidateId, request.value, apiKey)
          : await tagGreenhouseCandidate(request.candidateId, request.value, apiKey);

      return { notified, skipped: false };
    }

    case 'lever': {
      const apiKey = process.env.LEVER_API_KEY;
      if (!apiKey) {
        return { notified: false, skipped: true };
      }

      const notified =
        request.action === 'add_note'
          ? await addLeverNote(request.candidateId, request.value, apiKey)
          : await addLeverTag(request.candidateId, request.value, apiKey);

      return { notified, skipped: false };
    }

    case 'workday': {
      const tenant = process.env.WORKDAY_TENANT;
      const clientId = process.env.WORKDAY_CLIENT_ID;
      const clientSecret = process.env.WORKDAY_SECRET;

      if (!tenant || !clientId || !clientSecret) {
        return { notified: false, skipped: true };
      }

      if (request.action === 'add_tag') {
        return { notified: false, skipped: false };
      }

      const accessToken = await getWorkdayAccessToken(tenant, clientId, clientSecret);
      if (!accessToken) {
        return { notified: false, skipped: false };
      }

      return {
        notified: await updateWorkdayWorkerNote(
          tenant,
          request.candidateId,
          request.value,
          accessToken,
        ),
        skipped: false,
      };
    }

    case 'icims': {
      const customerId = process.env.ICIMS_CUSTOMER_ID;
      const username = process.env.ICIMS_USERNAME;
      const password = process.env.ICIMS_PASSWORD;

      if (!customerId || !username || !password) {
        return { notified: false, skipped: true };
      }

      if (request.action === 'add_tag') {
        return { notified: false, skipped: false };
      }

      return {
        notified: await addICIMSNote(
          request.candidateId,
          request.value,
          customerId,
          username,
          password,
        ),
        skipped: false,
      };
    }
  }

  return { notified: false, skipped: false };
}
