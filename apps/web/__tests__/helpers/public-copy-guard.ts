import { PUBLIC_WEDGE_ROUTE_TARGETS as RUNTIME_PUBLIC_WEDGE_ROUTE_TARGETS } from '@/lib/trust/public-wedge-parity';

export const APPROVED_PUBLIC_WORDING = {
  checked: 'Checked',
  sourceBacked: 'source-backed',
  current: 'current',
  preview: 'preview',
  accessRequired: 'access required',
  pending: 'pending',
  reviewRequired: 'review required',
} as const;

export const PROHIBITED_PUBLIC_STRINGS = [
  'Get Verified',
  'Primary sources verify you',
  'Already Cleared For',
  'Get Verified Free',
  'Trust Protocol',
  'signed link',
  'expires in 24h',
  'no account needed',
] as const;

export const PROHIBITED_EMPLOYER_PUBLIC_STRINGS = [
  'Verified since',
  'Trust score',
  'Open employer workspace',
  'launch-day queue state',
  'operator dashboard',
  'graph truth',
  'launch alerts',
] as const;

export const PUBLIC_WEDGE_ROUTE_TARGETS = {
  homepageContinuePrefix: `${RUNTIME_PUBLIC_WEDGE_ROUTE_TARGETS.passportEntry}?npi=`,
  explorePrimary: '/onboarding',
  exploreSecondary: '/ask',
  interviewBlocked: RUNTIME_PUBLIC_WEDGE_ROUTE_TARGETS.homepageLookup,
  interviewReviewPrefix: `${RUNTIME_PUBLIC_WEDGE_ROUTE_TARGETS.reviewEntry}/`,
  employerEntry: RUNTIME_PUBLIC_WEDGE_ROUTE_TARGETS.reviewEntry,
} as const;

function stripTags(input: string): string {
  return input.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function findHrefByText(markup: string, text: string): string | null {
  const anchors = markup.match(/<a\b[^>]*href="[^"]+"[^>]*>[\s\S]*?<\/a>/g) ?? [];

  for (const anchor of anchors) {
    const hrefMatch = anchor.match(/\bhref="([^"]+)"/);
    if (!hrefMatch) {
      continue;
    }

    if (stripTags(anchor).includes(text)) {
      return hrefMatch[1] ?? null;
    }
  }

  return null;
}
