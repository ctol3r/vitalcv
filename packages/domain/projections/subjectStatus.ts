import { EmployerAcceptance } from '../events/EmployerAcceptance';
import { RecognitionEvent } from '../events/RecognitionEvent';
import { StartAttestation } from '../events/StartAttestation';

export type SubjectStatus = {
  recognized: boolean;
  accepted: boolean;
  started: boolean;
  recognitionId?: string;
  acceptanceId?: string;
  startId?: string;
  recognizedAt?: string;
  acceptedAt?: string;
  attestedAt?: string;
};

function sortByTimestamp<T>(
  items: T[],
  timestamp: (item: T) => string,
  id: (item: T) => string,
): T[] {
  return [...items].sort((a, b) => {
    const aTime = Date.parse(timestamp(a));
    const bTime = Date.parse(timestamp(b));
    const safeATime = Number.isNaN(aTime) ? 0 : aTime;
    const safeBTime = Number.isNaN(bTime) ? 0 : bTime;

    if (safeATime !== safeBTime) return safeATime - safeBTime;
    return id(a).localeCompare(id(b));
  });
}

export function subjectStatus(input: {
  recognitions: RecognitionEvent[];
  acceptances: EmployerAcceptance[];
  starts: StartAttestation[];
}): SubjectStatus {
  const activeRecognitions = input.recognitions.filter((rec) => !rec.revocation);
  const recognitionIds = new Set(activeRecognitions.map((rec) => rec.recognitionId));

  const validAcceptances = input.acceptances.filter((acc) => recognitionIds.has(acc.recognitionId));
  const acceptanceIds = new Set(validAcceptances.map((acc) => acc.acceptanceId));

  const validStarts = input.starts.filter((start) => acceptanceIds.has(start.acceptanceId));

  const sortedRecognitions = sortByTimestamp(
    activeRecognitions,
    (rec) => rec.recognizedAt,
    (rec) => rec.recognitionId,
  );
  const sortedAcceptances = sortByTimestamp(
    validAcceptances,
    (acc) => acc.acceptedAt,
    (acc) => acc.acceptanceId,
  );
  const sortedStarts = sortByTimestamp(
    validStarts,
    (start) => start.attestedAt,
    (start) => start.startId,
  );

  const latestRecognition = sortedRecognitions[sortedRecognitions.length - 1];
  const latestAcceptance = latestRecognition
    ? sortedAcceptances[sortedAcceptances.length - 1]
    : undefined;
  const latestStart = latestAcceptance ? sortedStarts[sortedStarts.length - 1] : undefined;

  return {
    recognized: Boolean(latestRecognition),
    accepted: Boolean(latestAcceptance),
    started: Boolean(latestStart),
    recognitionId: latestRecognition?.recognitionId,
    acceptanceId: latestAcceptance?.acceptanceId,
    startId: latestStart?.startId,
    recognizedAt: latestRecognition?.recognizedAt,
    acceptedAt: latestAcceptance?.acceptedAt,
    attestedAt: latestStart?.attestedAt,
  };
}
