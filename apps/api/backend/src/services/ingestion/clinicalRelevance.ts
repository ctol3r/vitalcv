/**
 * The clinical relevance gate.
 *
 * `types.ts` states that the runner "owns persistence and the relevance gate,
 * so every feed gets the same treatment and a new connector cannot quietly
 * invent its own rules". The report has carried `rejectedNotClinical` since
 * the beginning — declared, summed into `rejected`, and never incremented,
 * because the only connector filtered clinically at the API level
 * (`JobCategoryCode` restricted to nine federal series). The gate the contract
 * promised did not exist; USAJOBS simply never needed it.
 *
 * A feed without a server-side clinical filter — any public ATS board — would
 * have had every listing persisted, so VitalCV's board would fill with
 * engineers and account executives. This module is that missing gate, applied
 * by the runner to every feed alike.
 *
 * What it is NOT: a specialty classifier. It answers one question — is this a
 * role a licensed clinician holds — and never writes `specialty`, because
 * inferring a specialty from a job title puts a role in front of the wrong
 * clinician (see `FeedListing.specialty`).
 */

/**
 * Role words that identify a clinician by the license or credential they hold.
 *
 * Word-boundary matched, so "PA" does not fire on "Palo Alto" and "RN" does
 * not fire on "Learning". Deliberately about the PERSON, not the setting:
 * "health", "clinic", and "medical" are absent on purpose — "Medical Billing
 * Specialist" and "Clinic Operations Manager" are not clinical roles.
 */
const CLINICAL_ROLE_PATTERNS: RegExp[] = [
  /\bnurse\b/i,
  /\bnursing\b/i,
  /\brn\b/i,
  /\blpn\b/i,
  /\blvn\b/i,
  /\bcna\b/i,
  /\bnurse practitioner\b/i,
  /\bnp\b/i,
  /\bphysician\b/i,
  /\bdoctor\b/i,
  /\bmd\b/i,
  /\bdo\b(?!\w)/i,
  /\bphysician assistant\b/i,
  /\bpa-c\b/i,
  /\bapp\b/i,
  /\badvanced practice\b/i,
  /\bclinician\b/i,
  /\bclinical\b/i,
  /\btherapist\b/i,
  /\btherapy\b/i,
  /\bpsychiatrist\b/i,
  /\bpsychiatric\b/i,
  /\bpsychologist\b/i,
  /\bcounselor\b/i,
  /\bcounsellor\b/i,
  /\bsocial worker\b/i,
  /\blcsw\b/i,
  /\blmft\b/i,
  /\blpcc?\b/i,
  /\bpharmacist\b/i,
  /\bdietitian\b/i,
  /\bdietician\b/i,
  /\bmedical assistant\b/i,
  // The exact phrase, not bare "medical": a Medical Director is a physician,
  // while "Medical Billing Specialist" and "Medical Records Coordinator" are
  // not clinical roles. Matching the whole phrase separates them.
  /\bmedical director\b/i,
  /\bphlebotom/i,
  /\bsonographer\b/i,
  /\bradiolog/i,
  /\bmidwife\b/i,
  /\bdentist\b/i,
  /\bhygienist\b/i,
  /\boptometrist\b/i,
  /\bpodiatrist\b/i,
  /\bparamedic\b/i,
  /\bprovider\b/i,
];

/**
 * Titles that contain a clinical word but describe a non-clinical job.
 *
 * Checked FIRST, because these are the false positives that would otherwise
 * put a recruiter or a salesperson on a board of clinical roles. "Clinical
 * Recruiter" and "Director of Clinical Operations" both match /clinical/ and
 * neither is a job a licensed clinician is hired into.
 */
const NON_CLINICAL_OVERRIDES: RegExp[] = [
  /\brecruit/i,
  /\bsourcer\b/i,
  /\btalent\b/i,
  /\bsales\b/i,
  /\baccount executive\b/i,
  /\bmarketing\b/i,
  /\bengineer\b/i,
  /\bdeveloper\b/i,
  /\bsoftware\b/i,
  /\bdata scientist\b/i,
  /\bproduct manager\b/i,
  /\bdesigner\b/i,
  /\bcontroller\b/i,
  /\baccountant\b/i,
  /\blegal counsel\b/i,
  /\bcustomer success\b/i,
  /\bbilling\b/i,
  /\bcoder\b/i,
  /\bcoding specialist\b/i,
  /\brecords\b/i,
  /\bscheduler\b/i,
  /\breceptionist\b/i,
  /\boperations\b/i,
  /\bprogram manager\b/i,
  /\bproject manager\b/i,
  /\bterritory manager\b/i,
];

/*
 * A note on the leadership cases, because this is the genuinely ambiguous edge.
 *
 * "Director of Clinical Operations" matches /clinical/ and is an operations
 * job. "Medical Director" and "Director of Nursing" match too and are roles a
 * physician and an RN respectively are hired into. So `\bdirector\b` cannot be
 * an override — it would drop real clinical leadership — and `\boperations\b`
 * is used instead, which separates the two without guessing.
 *
 * The residual error is one-directional on purpose: an operations role that
 * genuinely requires a license gets dropped, and no operations role is ever
 * shown to a clinician as clinical work. Dropping a borderline listing costs
 * one posting; showing a non-clinical job on a clinical board costs the
 * clinician's trust in every other row.
 */

/**
 * Whether a listing title describes a role a licensed clinician holds.
 *
 * Title only — a description mentioning "our clinical team" says nothing about
 * the role being filled, and matching on it turns every posting at a health
 * company clinical.
 */
export function isClinicalRole(title: string): boolean {
  const value = title?.trim();
  if (!value) return false;

  if (NON_CLINICAL_OVERRIDES.some((pattern) => pattern.test(value))) {
    return false;
  }

  return CLINICAL_ROLE_PATTERNS.some((pattern) => pattern.test(value));
}
