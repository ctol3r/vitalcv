import { PrismaClient, type Prisma, type SpecialtyRequirement } from '@prisma/client';

type JobRecord = Prisma.JobPostingGetPayload<{}> & {
  location?: {
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
  } | null;
};

export interface JobKeywordExtractionInput {
  job: JobRecord;
  requirements?: SpecialtyRequirement[];
}

export interface JobKeywordIndexResult {
  jobId: string;
  keywords: string[];
}

const MAX_KEYWORDS = 64;

export function extractJobKeywords(input: JobKeywordExtractionInput): JobKeywordIndexResult {
  const tokens = new Set<string>();
  const metadata = (input.job.metadata as Record<string, unknown> | null) ?? null;

  addToken(tokens, `job:${input.job.id}`);
  addToken(tokens, `org:${normalize(input.job.partnerId ?? 'unknown')}`);

  const specialty = input.job.specialty ?? metadata?.specialty;
  if (typeof specialty === 'string') {
    addToken(tokens, `specialty:${normalize(specialty)}`);
    splitIntoWords(specialty).forEach((word) => addToken(tokens, word));
  }

  splitIntoWords(input.job.title ?? '').forEach((word) => addToken(tokens, word));

  const requiredStates = normalizeStateList([
    ...(Array.isArray(input.job.requiredStates) ? input.job.requiredStates : []),
    input.job.location?.state ?? '',
  ]);
  requiredStates.forEach((state) => addToken(tokens, `region:${state}`));

  if (input.job.telehealth || input.job.modality === 'telehealth') {
    addToken(tokens, 'modality:telehealth');
    addToken(tokens, 'compact:preferred');
  }

  if ((input.job.requiredStates?.length ?? 0) > 1) {
    addToken(tokens, 'compact:required');
  }

  if (input.job.modality === 'hybrid') {
    addToken(tokens, 'modality:hybrid');
  }

  const requirementCompacts =
    input.requirements?.some((req) => req.compactOk) ?? false;
  if (requirementCompacts) {
    addToken(tokens, 'compact:accepted');
  }

  const credentials = collectCredentialKeywords(input.job, metadata);
  credentials.forEach((credential) => addToken(tokens, `credential:${credential}`));

  const regions = (metadata?.regions as string[] | undefined) ?? [];
  normalizeStateList(regions).forEach((region) => addToken(tokens, `region:${region}`));

  const serviceLines = new Set<string>();
  if (Array.isArray(metadata?.serviceLines)) {
    metadata?.serviceLines.forEach((line) => {
      if (typeof line === 'string') serviceLines.add(line);
    });
  }
  if (Array.isArray((input.job as any).serviceLines)) {
    ((input.job as any).serviceLines as string[]).forEach((line) => {
      if (typeof line === 'string') serviceLines.add(line);
    });
  }
  const roleField = (input.job as any).role;
  if (typeof roleField === 'string') {
    serviceLines.add(roleField);
  }
  if (Array.isArray(roleField)) {
    roleField.filter((item): item is string => typeof item === 'string').forEach((item) => serviceLines.add(item));
  }
  Array.from(serviceLines).forEach((service) => addToken(tokens, `service:${normalize(service)}`));

  const urgency = metadata?.urgency ?? (input.job as any).urgency;
  if (typeof urgency === 'string') {
    addToken(tokens, `urgency:${normalize(urgency)}`);
  }

  const keywords = Array.from(tokens).slice(0, MAX_KEYWORDS).sort();
  return {
    jobId: input.job.id,
    keywords,
  };
}

export async function indexJobPosting(prisma: PrismaClient, jobId: string): Promise<JobKeywordIndexResult> {
  const job = await prisma.jobPosting.findUnique({
    where: { id: jobId },
  });

  if (!job) {
    throw new Error(`JobPosting ${jobId} not found`);
  }

  const requirements = await prisma.specialtyRequirement.findMany({
    where: { jobId },
  });

  const index = extractJobKeywords({ job: job as JobRecord, requirements });

  await prisma.jobSearchIndex.upsert({
    where: { jobId },
    create: {
      jobId: index.jobId,
      keywords: index.keywords,
    },
    update: {
      keywords: index.keywords,
    },
  });

  return index;
}

function collectCredentialKeywords(
  job: JobRecord,
  metadata: Record<string, unknown> | null,
): string[] {
  const bucket = new Set<string>();
  const credentialSources: unknown[] = [];

  credentialSources.push((metadata as any)?.requiredCredentials);
  credentialSources.push((metadata as any)?.certifications);
  credentialSources.push((job as any)?.privilegeCodes);
  credentialSources.push((metadata as any)?.skills);

  credentialSources.forEach((source) => {
    if (Array.isArray(source)) {
      source.filter((value): value is string => typeof value === 'string').forEach((value) => {
        bucket.add(normalize(value));
      });
    }
  });

  return Array.from(bucket);
}

function splitIntoWords(input: string): string[] {
  return input
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((word) => word.trim())
    .filter(Boolean);
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '-');
}

function normalizeStateList(states: string[]): string[] {
  return Array.from(
    new Set(
      states
        .filter((state): state is string => typeof state === 'string')
        .map((state) => state.trim().toUpperCase())
        .filter((state) => state.length === 2),
    ),
  );
}

function addToken(bucket: Set<string>, value: string) {
  if (!value) return;
  bucket.add(value);
}


