export const APPROVED_PUBLIC_WORDING = {
  checked: 'Checked',
  sourceBacked: 'source-backed',
  current: 'current',
  preview: 'preview',
  accessRequired: 'access_required',
  pending: 'pending',
  reviewRequired: 'review_required',
} as const;

export const PROHIBITED_PUBLIC_STRINGS = [
  'Get Verified',
  'Primary sources verify you',
  'Open Interview Preview',
  'Already Cleared For',
  'Get Verified Free',
  'Build with the Trust Protocol',
  'Build with the VitalCV Trust Protocol',
  'Trust Protocol',
  'signed link',
  'expires in 24h',
  // 'no account needed' left this list by founder ruling 2026-08-07: it was
  // banned in the wedge era (d9d9937b0) when the promise was false — the
  // sign-in wall repossessed it. #1090 made it true (the record renders
  // before any account ask), and the audit called the homepage line that
  // carries it the best microcopy on the site. The ban survives where its
  // register is still wrong: buyer surfaces, in the employer list below.
  'Network Peer Acceptance',
  'AUTHORITATIVE issuers require',
  'TRUST_THRESHOLD',
  'REVOCATION_ESCALATION',
  'PEER_ACCEPTANCE',
] as const;

export const PROHIBITED_EMPLOYER_PUBLIC_STRINGS = [
  // Buyer surfaces request organization access — an account-free promise is
  // the wrong register there (founder ruling 2026-08-07; see note above).
  'no account needed',
  'no account required',
  'Verified since',
  'Trust score',
  'Open employer workspace',
  'launch-day queue state',
  'operator dashboard',
  'graph truth',
  'launch alerts',
  'marketplace',
  'platform network',
  'trust protocol',
] as const;

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
