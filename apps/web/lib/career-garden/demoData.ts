/**
 * Career Garden prototype — a local UI fixture, nothing more.
 *
 * Hard rules, pinned by __tests__/career-garden-demo-data.test.ts:
 *   - No NPI and no 10+ digit runs anywhere (nothing can name a real person).
 *   - No realistic external identifiers (ORCID-shaped, DOI-shaped, etc.).
 *   - No clinician identity record, credential number, or source-backed claim.
 *   - No fabricated readiness score and no packet-like persistence shape.
 *   - Fictional employers/venues carry an explicit "sample" marker.
 *   - No banned truth-contract strings; never the bare state word "Verified".
 *   - Notes are professional-development content only — no patient details.
 *
 * This module feeds the garden UI prototype and nothing else. It is not an
 * evidence model, not a CV data model, and must never be imported outside
 * the career-garden surfaces and their tests.
 */

export const CAREER_GARDEN_IS_FICTIONAL = true as const;

export const GARDEN_PRIVACY_LINE =
  'Private workspace — only you can see notes until you choose to share.';

export const NOTE_PRIVACY_LINE = 'Only you can see this.';

export const AI_DRAFT_LINE = 'AI-assisted draft — review before sharing.';

export const DRAFT_ONLY_LINE = 'Draft only — review before sharing.';

export const GARDEN_SAMPLE_NOTICE =
  'Prototype with sample data — the notes, employers, and postings here are fictional.';

export const CURSOR_HONESTY_LINE =
  'Previews only — the Cursor never changes your workspace without your explicit approval, and nothing here calls an AI service.';

/** Workspace-state vocabulary for garden items (never evidence states). */
export type GardenProvenance =
  | 'self-attested'
  | 'ai-assisted-draft'
  | 'connected-profile'
  | 'self-added-link'
  | 'candidate-match'
  | 'not-connected';

export const PROVENANCE_LABEL: Record<GardenProvenance, string> = {
  'self-attested': 'Self-attested',
  'ai-assisted-draft': 'AI-assisted draft',
  'connected-profile': 'Connected profile (sample)',
  'self-added-link': 'Self-added link',
  'candidate-match': 'Candidate match — needs your review',
  'not-connected': 'Not connected',
};

/* ------------------------------------------------------------------ */
/* Seeds — private notes and captures                                  */
/* ------------------------------------------------------------------ */

export type CvSection = 'experience' | 'research' | 'teaching' | 'service' | 'publications';

export const CV_SECTION_LABEL: Record<CvSection, string> = {
  experience: 'Clinical experience',
  research: 'Research',
  teaching: 'Teaching & mentoring',
  service: 'Service & quality',
  publications: 'Publications',
};

export interface GardenSeed {
  id: string;
  title: string;
  body: string;
  capturedAt: string;
  tags: string[];
  branchIds: string[];
  status: 'unfiled' | 'growing';
  /** Deterministic CV-bullet draft the review panel proposes for this seed. */
  growDraft: {
    section: CvSection;
    headline: string;
    detail: string;
  };
}

export const DEMO_SEEDS: GardenSeed[] = [
  {
    id: 'seed-journal-club',
    title: 'Journal club reflection — discharge follow-up calls',
    body: 'Led this month’s journal club on structured discharge follow-up calls. Group take-away: our unit could trial a 48-hour call script. I volunteered to draft it and bring a one-page proposal to the quality committee.',
    capturedAt: '2026-07-21',
    tags: ['quality', 'teaching'],
    branchIds: ['branch-qi-discharge'],
    status: 'growing',
    growDraft: {
      section: 'service',
      headline: 'Proposed a 48-hour discharge follow-up call trial',
      detail:
        'Drafted the call script and a one-page proposal for the unit quality committee after leading a journal club on structured discharge follow-up.',
    },
  },
  {
    id: 'seed-pocus-series',
    title: 'Idea — resident POCUS teaching series',
    body: 'Three residents asked for more point-of-care ultrasound practice this rotation. Sketch: four 30-minute hands-on sessions, one probe skill each, paired with sign-off checklists. Ask the sim lab about equipment time.',
    capturedAt: '2026-07-18',
    tags: ['teaching', 'ultrasound'],
    branchIds: ['branch-pocus-teaching'],
    status: 'unfiled',
    growDraft: {
      section: 'teaching',
      headline: 'Designed a four-session resident POCUS skills series',
      detail:
        'Planned hands-on point-of-care ultrasound sessions with per-skill sign-off checklists in coordination with the simulation lab.',
    },
  },
  {
    id: 'seed-telehealth-panel',
    title: 'Conference note — rural telehealth staffing panel',
    body: 'Panelists agreed the bottleneck is cross-coverage scheduling, not technology. Worth connecting this to our regional group’s open nocturnist conversations. Follow up with the moderator about their staffing model write-up.',
    capturedAt: '2026-07-12',
    tags: ['research', 'telehealth'],
    branchIds: ['branch-rural-telemedicine'],
    status: 'unfiled',
    growDraft: {
      section: 'research',
      headline: 'Synthesized rural telehealth staffing models from a regional panel',
      detail:
        'Collected cross-coverage scheduling patterns from a regional telehealth panel to inform a staffing-model comparison memo.',
    },
  },
  {
    id: 'seed-mentoring-log',
    title: 'Mentoring log — third-year advisee check-in',
    body: 'Quarterly check-in with my advisee. We mapped out an away-rotation plan and agreed on a reading list for hospital medicine sub-internship prep. Next check-in in October.',
    capturedAt: '2026-07-05',
    tags: ['mentoring'],
    branchIds: ['branch-pocus-teaching'],
    status: 'unfiled',
    growDraft: {
      section: 'teaching',
      headline: 'Maintained quarterly structured mentoring for a clinical advisee',
      detail:
        'Ran a recurring advising cadence covering rotation planning and sub-internship preparation.',
    },
  },
];

/* ------------------------------------------------------------------ */
/* Roots — profile connections shown on Privacy & Connections          */
/* ------------------------------------------------------------------ */

export type RootState = Extract<
  GardenProvenance,
  'connected-profile' | 'self-added-link' | 'candidate-match' | 'not-connected'
>;

export interface GardenRoot {
  id: string;
  provider: string;
  /** Displayed reference — deliberately impossible-shaped, never a real ID. */
  externalRef: string;
  state: RootState;
  method: string;
  observed: string;
  observedAt: string | null;
  refresh: string;
  sharing: string;
}

export const DEMO_ROOTS: GardenRoot[] = [
  {
    id: 'root-orcid',
    provider: 'ORCID',
    externalRef: 'orcid.sample/your-record',
    state: 'connected-profile',
    method: 'Authenticated connection (sample)',
    observed: 'Public works only — 3 public entries listed on the sample record. Nothing beyond the public list is read.',
    observedAt: '2026-07-19',
    refresh: 'Refreshes only when you ask.',
    sharing: 'Never shared until you include it in a packet.',
  },
  {
    id: 'root-linkedin',
    provider: 'LinkedIn',
    externalRef: 'linkedin.sample/your-profile',
    state: 'self-added-link',
    method: 'Link you added',
    observed: 'Link saved. Nothing imported from this profile.',
    observedAt: '2026-07-10',
    refresh: 'Not read by VitalCV.',
    sharing: 'Shown only where you place the link.',
  },
  {
    id: 'root-nppes',
    provider: 'NPPES registry',
    externalRef: 'no lookup run',
    state: 'not-connected',
    method: 'Source lookup — available in the product, not run in this prototype',
    observed: 'Nothing observed. This prototype runs no source lookups and makes no source-backed claims.',
    observedAt: null,
    refresh: 'Runs only when you ask it to.',
    sharing: 'Nothing to share.',
  },
  {
    id: 'root-scholar',
    provider: 'Google Scholar',
    externalRef: 'scholar.sample/your-profile',
    state: 'candidate-match',
    method: 'Link you added',
    observed: '2 publication candidates matched by author name. A name match is never treated as authorship until you confirm it.',
    observedAt: '2026-07-15',
    refresh: 'Candidates re-listed when you ask.',
    sharing: 'Candidates are never shared — only entries you confirm.',
  },
];

/* ------------------------------------------------------------------ */
/* Branches — projects, specialties, teaching, research themes         */
/* ------------------------------------------------------------------ */

export interface GardenBranch {
  id: string;
  name: string;
  kind: 'Project' | 'Specialty' | 'Teaching' | 'Research theme';
  summary: string;
}

export const DEMO_BRANCHES: GardenBranch[] = [
  {
    id: 'branch-hospital-medicine',
    name: 'Hospital medicine practice',
    kind: 'Specialty',
    summary: 'Core inpatient practice and schedules.',
  },
  {
    id: 'branch-pocus-teaching',
    name: 'POCUS teaching',
    kind: 'Teaching',
    summary: 'Resident point-of-care ultrasound curriculum and mentoring.',
  },
  {
    id: 'branch-rural-telemedicine',
    name: 'Rural telemedicine access',
    kind: 'Research theme',
    summary: 'Staffing models and access research for rural coverage.',
  },
  {
    id: 'branch-qi-discharge',
    name: 'Discharge follow-up QI',
    kind: 'Project',
    summary: 'Quality-improvement work on post-discharge follow-up calls.',
  },
];

/* ------------------------------------------------------------------ */
/* Blooms — living CV lines (workspace drafts, never evidence records) */
/* ------------------------------------------------------------------ */

export interface CvEntry {
  id: string;
  section: CvSection;
  headline: string;
  detail: string;
  provenance: Extract<GardenProvenance, 'self-attested' | 'ai-assisted-draft'>;
  /** Plain-language origin notes shown under "Show origin". */
  origin: string[];
  branchIds: string[];
  fromSeedId?: string;
}

export const DEMO_CV_ENTRIES: CvEntry[] = [
  {
    id: 'cv-hospitalist-role',
    section: 'experience',
    headline: 'Hospitalist — Meadowbrook Regional Hospital (sample employer)',
    detail: 'Inpatient general medicine service, 7-on/7-off, teaching attending two blocks per year.',
    provenance: 'self-attested',
    origin: ['You entered this on 2026-06-28.'],
    branchIds: ['branch-hospital-medicine'],
  },
  {
    id: 'cv-pocus-workshops',
    section: 'teaching',
    headline: 'Resident POCUS workshop instructor',
    detail: 'Quarterly hands-on ultrasound workshops for internal medicine residents since 2025.',
    provenance: 'self-attested',
    origin: ['From the session log you entered on 2026-05-14.'],
    branchIds: ['branch-pocus-teaching'],
  },
  {
    id: 'cv-pub-telehealth',
    section: 'publications',
    headline: '“Cross-coverage staffing patterns in rural telehealth” — Regional Health Review (sample venue)',
    detail: 'Co-authored review of staffing models for rural telehealth coverage.',
    provenance: 'self-attested',
    origin: [
      'Listed on your connected ORCID record (sample, public works only).',
      'You confirmed authorship on 2026-07-19 — confirmation is yours, not a source claim.',
    ],
    branchIds: ['branch-rural-telemedicine'],
  },
];

/** Publication candidates from the sample Scholar link — review required. */
export interface PublicationCandidate {
  id: string;
  title: string;
  venue: string;
  matchedBy: string;
}

export const DEMO_PUB_CANDIDATES: PublicationCandidate[] = [
  {
    id: 'cand-pocus-checklist',
    title: '“Checklist-based POCUS sign-off for residents” (sample)',
    venue: 'Bedside Teaching Notes (sample venue)',
    matchedBy: 'Author-name match from your saved Scholar link',
  },
  {
    id: 'cand-followup-calls',
    title: '“Structured follow-up calls after discharge” (sample)',
    venue: 'Care Transitions Digest (sample venue)',
    matchedBy: 'Author-name match from your saved Scholar link',
  },
];

/* ------------------------------------------------------------------ */
/* Research shelf — items the clinician is reading                     */
/* ------------------------------------------------------------------ */

export interface ResearchItem {
  id: string;
  title: string;
  venue: string;
  addedAt: string;
  annotation: string;
  branchIds: string[];
}

export const DEMO_RESEARCH_ITEMS: ResearchItem[] = [
  {
    id: 'res-telehealth-scheduling',
    title: '“Scheduling as the rural telehealth bottleneck” (sample article)',
    venue: 'Rural Care Quarterly (sample venue)',
    addedAt: '2026-07-13',
    annotation: 'Matches what the panel said — coverage design, not bandwidth, limits access. Compare with our regional group’s model.',
    branchIds: ['branch-rural-telemedicine'],
  },
  {
    id: 'res-pocus-retention',
    title: '“Skill retention after brief ultrasound courses” (sample article)',
    venue: 'Clinical Skills Forum (sample venue)',
    addedAt: '2026-07-08',
    annotation: 'Retention falls off without spaced practice — supports the four-session spaced design over a single workshop day.',
    branchIds: ['branch-pocus-teaching'],
  },
];

/* ------------------------------------------------------------------ */
/* Opportunities — fictional postings for the Prepare flow only        */
/* ------------------------------------------------------------------ */

export type OpportunityEvidenceState = 'self_attested' | 'needs_review' | 'unavailable' | 'access_required';

export interface OpportunityEvidenceItem {
  label: string;
  state: OpportunityEvidenceState;
  note: string;
}

export interface GardenOpportunity {
  id: string;
  title: string;
  org: string;
  location: string;
  schedule: string;
  compensation: string;
  practiceModel: string;
  team: string;
  timeline: string;
  fitReasons: string[];
  requiredEvidence: OpportunityEvidenceItem[];
  optionalEvidence: OpportunityEvidenceItem[];
}

export const DEMO_OPPORTUNITIES: GardenOpportunity[] = [
  {
    id: 'opp-cedar-grove',
    title: 'Nocturnist, hospital medicine (sample posting)',
    org: 'Cedar Grove Medical Center (sample employer)',
    location: 'Cedar Grove, OR (sample)',
    schedule: '7-on / 7-off nights',
    compensation: '$310k–$335k stated range (sample figures)',
    practiceModel: 'Closed ICU, hospitalist-led admissions',
    team: '12 hospitalists, 4 nocturnists',
    timeline: 'Reviewing candidates through September (sample)',
    fitReasons: [
      'Night-block schedule matches the preference you saved in this workspace.',
      'Inpatient scope matches your hospital medicine branch.',
      'Teaching optional — compatible with keeping your POCUS series.',
    ],
    requiredEvidence: [
      {
        label: 'Identity record',
        state: 'access_required',
        note: 'A registry lookup exists in the product; none has run in this prototype.',
      },
      {
        label: 'Current employment history',
        state: 'self_attested',
        note: 'You entered this. A reference letter could strengthen it.',
      },
      {
        label: 'Oregon license (sample requirement)',
        state: 'unavailable',
        note: 'Not in your workspace. The posting requires it before start, not before applying.',
      },
    ],
    optionalEvidence: [
      {
        label: 'Procedural teaching record',
        state: 'needs_review',
        note: 'Your POCUS workshop log could support this — review before including.',
      },
    ],
  },
  {
    id: 'opp-lakeshore',
    title: 'Academic hospitalist, clinician-educator track (sample posting)',
    org: 'Lakeshore University Health (sample employer)',
    location: 'Lakeshore, MN (sample)',
    schedule: 'Day service with resident teams',
    compensation: '$268k base plus educator stipend (sample figures)',
    practiceModel: 'Academic inpatient service with protected teaching time',
    team: 'Division of 30, 6 clinician-educators',
    timeline: 'Interviews begin late August (sample)',
    fitReasons: [
      'Educator track matches your teaching branch and mentoring log.',
      'Your rural telemedicine research theme fits the division’s access program.',
    ],
    requiredEvidence: [
      {
        label: 'Identity record',
        state: 'access_required',
        note: 'A registry lookup exists in the product; none has run in this prototype.',
      },
      {
        label: 'Teaching portfolio',
        state: 'needs_review',
        note: 'Draft exists from your workshop log — review the entries before sharing.',
      },
      {
        label: 'Publication list',
        state: 'self_attested',
        note: 'One entry you confirmed; two candidates still await your review.',
      },
    ],
    optionalEvidence: [
      {
        label: 'Curriculum sample',
        state: 'unavailable',
        note: 'Your POCUS series outline is still a seed — grow it into a document first.',
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Recent garden activity — the calm Seasons strip on the home page    */
/* ------------------------------------------------------------------ */

export interface SeasonEvent {
  id: string;
  at: string;
  kind: 'capture' | 'growth' | 'renewal' | 'transition';
  label: string;
  detail: string;
}

export const DEMO_SEASON_EVENTS: SeasonEvent[] = [
  {
    id: 'season-jc-note',
    at: '2026-07-21',
    kind: 'capture',
    label: 'Seed planted',
    detail: 'Journal club reflection captured as a private note.',
  },
  {
    id: 'season-orcid',
    at: '2026-07-19',
    kind: 'growth',
    label: 'Root connected (sample)',
    detail: 'ORCID connected — public works only; you confirmed one publication yourself.',
  },
  {
    id: 'season-scholar',
    at: '2026-07-15',
    kind: 'growth',
    label: 'Candidates waiting',
    detail: 'Two publication candidates from your Scholar link await your review.',
  },
  {
    id: 'season-license-window',
    at: '2026-09-01',
    kind: 'renewal',
    label: 'Renewal window ahead',
    detail: 'A sample renewal window opens in September — a quiet reminder, nothing is done for you.',
  },
];

/* ------------------------------------------------------------------ */
/* Today — the review panel on the garden home                         */
/* ------------------------------------------------------------------ */

export interface TodayTask {
  id: string;
  label: string;
  detail: string;
  href: string;
}

export const DEMO_TODAY_TASKS: TodayTask[] = [
  {
    id: 'today-grow-jc',
    label: 'Review one growing seed',
    detail: 'Your journal club note has a CV draft waiting for your review.',
    href: '/holder/garden/notes?note=seed-journal-club&grow=1',
  },
  {
    id: 'today-scholar-candidates',
    label: 'Review 2 publication candidates',
    detail: 'Author-name matches from your saved Scholar link — confirm or dismiss.',
    href: '/holder/garden/research',
  },
  {
    id: 'today-cedar-grove',
    label: 'Look at one fitting sample posting',
    detail: 'A sample nocturnist posting matches your saved schedule preference.',
    href: '/holder/garden/opportunities?op=opp-cedar-grove',
  },
];

/** Weekly tend-your-garden suggestions. */
export const DEMO_TEND_ITEMS = [
  '3 seeds are unfiled — link them to a project or let them rest.',
  'One CV line cites an origin you have not looked at this quarter.',
  'Your Scholar candidates have waited 12 days — confirm or dismiss them.',
] as const;

/* ------------------------------------------------------------------ */
/* Lookups                                                             */
/* ------------------------------------------------------------------ */

export function findSeed(id: string | undefined): GardenSeed | undefined {
  return DEMO_SEEDS.find((s) => s.id === id);
}

export function findOpportunity(id: string | undefined): GardenOpportunity | undefined {
  return DEMO_OPPORTUNITIES.find((o) => o.id === id);
}

export function branchName(id: string): string {
  return DEMO_BRANCHES.find((b) => b.id === id)?.name ?? id;
}
