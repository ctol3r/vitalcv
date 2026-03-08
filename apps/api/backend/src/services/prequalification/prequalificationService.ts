/**
 * Wave 189 — Prequalification Service
 *
 * Manages the prequalification lifecycle:
 *   resume uploaded → NPI verified → work auth → interview → assessment → prequalified
 *
 * Wave 190 persists state to DB. Currently in-memory for demo parity.
 */

import { randomUUID } from 'crypto';

// ── Status model ──────────────────────────────────────────────────────────────

export type PreqStep =
  | 'RESUME_UPLOADED'
  | 'NPI_VERIFIED'
  | 'WORK_AUTH_COMPLETE'
  | 'INTERVIEW_COMPLETE'
  | 'ASSESSMENT_COMPLETE'
  | 'PREQUALIFIED';

export interface PrequalificationStatus {
  npi: string;
  steps: PreqStep[];
  prequalified: boolean;
  instantOfferEligible: boolean;
  completedAt?: string;
  score: number;
  explanation: string;
}

// ── Interview session ─────────────────────────────────────────────────────────

export type InterviewRole = 'clinician' | 'verifier' | 'both';
export type InterviewBranch = 'general' | 'specialty' | 'compliance' | 'verifier_onboarding';

export interface InterviewSession {
  sessionId: string;
  npi: string;
  role: InterviewRole;
  branch: InterviewBranch;
  turns: Array<{ role: 'interviewer' | 'candidate'; content: string; ts: string }>;
  complete: boolean;
  startedAt: string;
  completedAt?: string;
}

// ── Assessment ────────────────────────────────────────────────────────────────

export interface AssessmentModule {
  id: string;
  title: string;
  specialty?: string;
  type: 'specialty' | 'compliance' | 'employer_specific';
  questions: Array<{ id: string; prompt: string; options?: string[] }>;
}

export interface AssessmentResult {
  resultId: string;
  npi: string;
  moduleId: string;
  score: number;
  passed: boolean;
  completedAt: string;
}

// ── In-memory stores ──────────────────────────────────────────────────────────

const statusStore = new Map<string, PrequalificationStatus>();
const interviewStore = new Map<string, InterviewSession>();
const assessmentStore = new Map<string, AssessmentResult[]>();

// ── Interview scripts (specialty-aware) ───────────────────────────────────────

const INTERVIEW_SCRIPTS: Record<InterviewBranch, string[]> = {
  general: [
    "Welcome to VitalCV! I'm your onboarding guide. Let's start — tell me about your current specialty and where you're licensed.",
    "Great. What types of opportunities are you looking for — locums, telehealth, permanent, or a mix?",
    "Are there any states where you'd like to expand your practice or get licensed soon?",
    "Do you have any upcoming credential renewals, gaps, or restrictions I should know about?",
    "Finally — what's your ideal start timeline for a new role?",
  ],
  specialty: [
    "Let's talk about your clinical specialty. Tell me about your board certifications and any sub-specialty training.",
    "How many years have you been practicing in this specialty?",
    "Do you have any procedural privileges or specific competencies that are relevant?",
    "Have you worked in locums or telehealth settings before in this specialty?",
  ],
  compliance: [
    "Have you ever had a license sanctioned, restricted, or revoked in any state?",
    "Are you currently clear on the OIG exclusion list and NPDB?",
    "Do you have any pending malpractice claims or open investigations?",
    "Are you authorized to work in the United States for healthcare employment?",
  ],
  verifier_onboarding: [
    "Tell me about your organization — what type of facility are you and how many clinicians do you typically hire?",
    "What specialties are you most actively hiring for?",
    "What's your current credentialing process and typical time-to-onboard?",
    "What credential levels do you require — do you need board certification, DEA, malpractice insurance?",
    "Are you interested in instant-offer workflows for prequalified candidates?",
  ],
};

// ── Assessment modules ────────────────────────────────────────────────────────

const ASSESSMENT_MODULES: AssessmentModule[] = [
  {
    id: 'cardiology-basics',
    title: 'Cardiology Credential Check',
    specialty: 'Cardiology',
    type: 'specialty',
    questions: [
      { id: 'c1', prompt: 'What board certification is required for interventional cardiology?', options: ['ABIM Cardiology', 'ABIM Internal Medicine', 'ACC Interventional', 'None required'] },
      { id: 'c2', prompt: 'How often must a CA medical license be renewed?', options: ['Every year', 'Every 2 years', 'Every 3 years', 'Every 5 years'] },
    ],
  },
  {
    id: 'psychiatry-telehealth',
    title: 'Telehealth Psychiatry Compliance',
    specialty: 'Psychiatry',
    type: 'compliance',
    questions: [
      { id: 'p1', prompt: 'Is a DEA registration required to prescribe controlled substances via telehealth?', options: ['Yes, in each state', 'No, federal DEA only', 'Depends on state', 'Not required for psychiatry'] },
      { id: 'p2', prompt: 'Which federal law governs telehealth prescribing for controlled substances?', options: ['HIPAA', 'Ryan Haight Act', 'ADA', 'EMTALA'] },
    ],
  },
  {
    id: 'general-compliance',
    title: 'Healthcare Labor Compliance',
    specialty: undefined,
    type: 'compliance',
    questions: [
      { id: 'g1', prompt: 'What is the NPDB?', options: ['National Provider Database Bureau', 'National Practitioner Data Bank', 'National Physician Data Base', 'National Provider Data Board'] },
      { id: 'g2', prompt: 'Work authorization in healthcare is governed by which form?', options: ['W-2', 'I-9', 'I-140', 'W-4'] },
    ],
  },
];

// ── Service functions ─────────────────────────────────────────────────────────

export function getPrequalificationStatus(npi: string): PrequalificationStatus {
  if (statusStore.has(npi)) return statusStore.get(npi)!;

  // Default scaffold
  const status: PrequalificationStatus = {
    npi,
    steps: [],
    prequalified: false,
    instantOfferEligible: false,
    score: 0,
    explanation: 'No prequalification steps completed yet.',
  };
  statusStore.set(npi, status);
  return status;
}

export function updatePrequalificationStep(npi: string, step: PreqStep): PrequalificationStatus {
  const status = getPrequalificationStatus(npi);
  if (!status.steps.includes(step)) {
    status.steps.push(step);
  }

  // Recompute score and flags
  const stepScores: Record<PreqStep, number> = {
    RESUME_UPLOADED: 10,
    NPI_VERIFIED: 20,
    WORK_AUTH_COMPLETE: 15,
    INTERVIEW_COMPLETE: 25,
    ASSESSMENT_COMPLETE: 20,
    PREQUALIFIED: 10,
  };
  status.score = status.steps.reduce((sum, s) => sum + (stepScores[s] ?? 0), 0);
  status.prequalified = status.steps.includes('PREQUALIFIED')
    || (status.score >= 80 && status.steps.includes('INTERVIEW_COMPLETE'));
  status.instantOfferEligible = status.prequalified && status.steps.includes('ASSESSMENT_COMPLETE');

  if (status.prequalified && !status.completedAt) {
    status.completedAt = new Date().toISOString();
  }

  status.explanation = buildExplanation(status.steps);
  statusStore.set(npi, status);
  console.log(JSON.stringify({ event: 'prequalification.step', npi, step, score: status.score }));
  return status;
}

export function startInterview(npi: string, role: InterviewRole): InterviewSession {
  const branch: InterviewBranch = role === 'verifier' ? 'verifier_onboarding' : 'general';
  const session: InterviewSession = {
    sessionId: randomUUID(),
    npi,
    role,
    branch,
    turns: [
      {
        role: 'interviewer',
        content: INTERVIEW_SCRIPTS[branch][0] ?? 'Welcome to VitalCV.',
        ts: new Date().toISOString(),
      },
    ],
    complete: false,
    startedAt: new Date().toISOString(),
  };
  interviewStore.set(session.sessionId, session);
  console.log(JSON.stringify({ event: 'interview.started', npi, sessionId: session.sessionId }));
  return session;
}

export function addInterviewTurn(
  sessionId: string,
  candidateMessage: string,
): InterviewSession | null {
  const session = interviewStore.get(sessionId);
  if (!session) return null;

  session.turns.push({ role: 'candidate', content: candidateMessage, ts: new Date().toISOString() });

  const nextIdx = Math.floor(session.turns.length / 2);
  const script = INTERVIEW_SCRIPTS[session.branch];

  if (nextIdx < script.length) {
    session.turns.push({ role: 'interviewer', content: script[nextIdx], ts: new Date().toISOString() });
  } else {
    session.turns.push({
      role: 'interviewer',
      content: "Thank you — that's everything I need. Your interview is complete and your profile has been updated.",
      ts: new Date().toISOString(),
    });
    session.complete = true;
    session.completedAt = new Date().toISOString();
    updatePrequalificationStep(session.npi, 'INTERVIEW_COMPLETE');
  }

  interviewStore.set(sessionId, session);
  return session;
}

export function getAssessmentModules(specialty?: string): AssessmentModule[] {
  if (!specialty) return ASSESSMENT_MODULES;
  return ASSESSMENT_MODULES.filter(
    m => !m.specialty || m.specialty.toLowerCase() === specialty.toLowerCase(),
  );
}

export function submitAssessment(
  npi: string,
  moduleId: string,
  answers: Record<string, string>,
): AssessmentResult {
  const module = ASSESSMENT_MODULES.find(m => m.id === moduleId);
  if (!module) throw new Error(`Module ${moduleId} not found`);

  // Simple scoring: score = fraction of questions answered
  const answered = Object.keys(answers).length;
  const score = Math.round((answered / module.questions.length) * 100);
  const passed = score >= 60;

  const result: AssessmentResult = {
    resultId: randomUUID(),
    npi,
    moduleId,
    score,
    passed,
    completedAt: new Date().toISOString(),
  };

  const existing = assessmentStore.get(npi) ?? [];
  existing.push(result);
  assessmentStore.set(npi, existing);

  if (passed) updatePrequalificationStep(npi, 'ASSESSMENT_COMPLETE');
  console.log(JSON.stringify({ event: 'assessment.submitted', npi, moduleId, score, passed }));
  return result;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildExplanation(steps: PreqStep[]): string {
  if (steps.length === 0) return 'No steps completed yet.';
  const labels: Record<PreqStep, string> = {
    RESUME_UPLOADED: 'resume uploaded',
    NPI_VERIFIED: 'NPI verified',
    WORK_AUTH_COMPLETE: 'work authorization confirmed',
    INTERVIEW_COMPLETE: 'AI interview complete',
    ASSESSMENT_COMPLETE: 'specialty assessment passed',
    PREQUALIFIED: 'prequalified',
  };
  return `Completed: ${steps.map(s => labels[s]).join(', ')}.`;
}
