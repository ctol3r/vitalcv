// WAVE 1300 — HEALTHCARE WORKFORCE OPERATING SYSTEM · configuration model
// VitalCV is no longer one fixed product. It is configurable infrastructure: an
// organization picks a WORKSPACE, and that workspace defines terminology, the
// workflow pipeline, the roles, the dashboards, and the automation rules.
// Nothing here is hardcoded into the surfaces — the surfaces render from this.

/* ---------- Role library (shared pool; workspaces reference by id) ---------- */
const ROLES = {
  recruiter:    { id: 'recruiter',    label: 'Recruiter',              icon: 'Search',      scope: 'Sourcing & pipeline', landing: 'dashboards' },
  credentialing:{ id: 'credentialing',label: 'Credentialing Specialist',icon: 'ShieldCheck', scope: 'Evidence & readiness', landing: 'workflows' },
  chair:        { id: 'chair',        label: 'Department Chair',       icon: 'Building',    scope: 'Department oversight', landing: 'dashboards' },
  mso:          { id: 'mso',          label: 'Medical Staff Office',   icon: 'Stamp',       scope: 'Privileging & bylaws', landing: 'workflows' },
  cmo:          { id: 'cmo',          label: 'Chief Medical Officer',  icon: 'Award',       scope: 'Executive & quality',  landing: 'dashboards' },
  program:      { id: 'program',      label: 'Program Director',       icon: 'GraduationCap',scope: 'Trainees & milestones', landing: 'workflows' },
  coordinator:  { id: 'coordinator',  label: 'Staffing Coordinator',   icon: 'Users',       scope: 'Assignments & coverage', landing: 'dashboards' },
  payer_ops:    { id: 'payer_ops',    label: 'Network Operations',     icon: 'Network',     scope: 'Enrollment & directory', landing: 'workflows' },
};

/* ---------- Permission capabilities (toggled per role per workspace) ---------- */
const CAPABILITIES = [
  { id: 'view_evidence',   label: 'View evidence & sources',        group: 'Read' },
  { id: 'view_pii',        label: 'View protected identifiers',     group: 'Read' },
  { id: 'edit_pipeline',   label: 'Move records through stages',    group: 'Act' },
  { id: 'approve',         label: 'Approve / confer readiness',     group: 'Act' },
  { id: 'configure_wf',    label: 'Edit the workflow',              group: 'Configure' },
  { id: 'configure_dash',  label: 'Compose dashboards',             group: 'Configure' },
  { id: 'manage_automation',label: 'Manage automation rules',       group: 'Configure' },
  { id: 'manage_roles',    label: 'Manage roles & permissions',     group: 'Configure' },
];

/* ---------- Widget palette for the Dashboard Composer ---------- */
const WIDGETS = {
  pipeline_funnel: { id: 'pipeline_funnel', label: 'Pipeline funnel',     kind: 'graph',    icon: 'Filter',     span: 2, desc: 'Volume by stage, live' },
  readiness_gauge: { id: 'readiness_gauge', label: 'Readiness gauge',     kind: 'metric',   icon: 'Gauge',      span: 1, desc: 'Aggregate readiness %' },
  time_to_active:  { id: 'time_to_active',  label: 'Time to active',      kind: 'metric',   icon: 'Clock',      span: 1, desc: 'Median days, end-to-end' },
  expiring_creds:  { id: 'expiring_creds',  label: 'Expiring credentials',kind: 'alert',    icon: 'AlertTri',   span: 1, desc: 'Licenses lapsing < 90d' },
  evidence_changes:{ id: 'evidence_changes',label: 'Evidence changes',    kind: 'activity', icon: 'Activity',   span: 1, desc: 'New & updated sources' },
  open_tasks:      { id: 'open_tasks',      label: 'Open tasks',          kind: 'card',     icon: 'ListChecks', span: 1, desc: 'Assigned to you' },
  stage_aging:     { id: 'stage_aging',     label: 'Stage aging',         kind: 'graph',    icon: 'TrendingUp', span: 2, desc: 'Records past SLA per stage' },
  cohort_table:    { id: 'cohort_table',    label: 'Active cohort',       kind: 'card',     icon: 'Users',      span: 2, desc: 'Roster with status' },
  source_health:   { id: 'source_health',   label: 'Source health',       kind: 'widget',   icon: 'Heart',      span: 1, desc: 'Verifier uptime' },
  offers_out:      { id: 'offers_out',      label: 'Offers outstanding',  kind: 'metric',   icon: 'Send',       span: 1, desc: 'Awaiting signature' },
};

/* ---------- Automation primitives ---------- */
const EVENTS = {
  evidence_changed:  { id: 'evidence_changed',  label: 'Evidence changes',          icon: 'Activity' },
  readiness_drops:   { id: 'readiness_drops',   label: 'Readiness drops below threshold', icon: 'ArrowDown' },
  license_expiring:  { id: 'license_expiring',  label: 'License nears expiry',      icon: 'Calendar' },
  stage_entered:     { id: 'stage_entered',     label: 'Record enters a stage',     icon: 'ArrowRight' },
  stage_stalled:     { id: 'stage_stalled',     label: 'Record stalls past SLA',    icon: 'Clock' },
  offer_accepted:    { id: 'offer_accepted',    label: 'Offer accepted',            icon: 'Handshake' },
};
const ACTIONS = {
  notify_recruiter:    { id: 'notify_recruiter',    label: 'Notify recruiter',         icon: 'Bell' },
  notify_credentialing:{ id: 'notify_credentialing',label: 'Notify credentialing',     icon: 'ShieldCheck' },
  create_task:         { id: 'create_task',         label: 'Create a task',            icon: 'ListChecks' },
  advance_stage:       { id: 'advance_stage',       label: 'Advance to next stage',    icon: 'ArrowRight' },
  start_onboarding:    { id: 'start_onboarding',    label: 'Start onboarding',         icon: 'PlayCircle' },
  flag_review:         { id: 'flag_review',         label: 'Flag for review',          icon: 'Flag' },
};

/* ---------- WORKSPACES — the configurable organizations ---------- */
// terms drive every label in the product. stages drive the pipeline. roleIds,
// dashboard (widget ids) and automations seed the live, editable config.
const WORKSPACES = [
  {
    id: 'amc', name: 'Northwell Academic Medical Center', type: 'Academic Medical Center',
    accent: '#34d8e8', icon: 'GraduationCap', short: 'AMC',
    terms: { provider: 'Provider', providerPl: 'Providers', group: 'Department', groupPl: 'Departments', workflow: 'Appointment & Credentialing', record: 'File' },
    stats: { providers: 1840, groups: 42, active: 1612 },
    stages: [
      { id: 's1', label: 'Recruit',              owner: 'recruiter',     sla: 14 },
      { id: 's2', label: 'Interview',            owner: 'chair',         sla: 21 },
      { id: 's3', label: 'Evidence Review',      owner: 'credentialing', sla: 10 },
      { id: 's4', label: 'Credential Readiness', owner: 'credentialing', sla: 30 },
      { id: 's5', label: 'Privileging',          owner: 'mso',           sla: 14 },
      { id: 's6', label: 'Offer',                owner: 'chair',         sla: 7  },
      { id: 's7', label: 'Onboarding',           owner: 'mso',           sla: 21 },
      { id: 's8', label: 'Active Provider',      owner: 'cmo',           sla: 0  },
    ],
    roleIds: ['recruiter', 'credentialing', 'chair', 'mso', 'cmo'],
    dashboard: ['pipeline_funnel', 'readiness_gauge', 'time_to_active', 'expiring_creds', 'stage_aging', 'cohort_table'],
    automations: [
      { id: 'a1', event: 'evidence_changed', action: 'notify_recruiter',     target: 'Any provider in pipeline', enabled: true },
      { id: 'a2', event: 'readiness_drops',  action: 'notify_credentialing', target: 'Readiness < 80%',          enabled: true },
      { id: 'a3', event: 'license_expiring', action: 'create_task',          target: 'Active providers',         enabled: true },
    ],
  },
  {
    id: 'community', name: 'Cedar Valley Community Hospital', type: 'Community Hospital',
    accent: '#5ed6a4', icon: 'Heart', short: 'CVH',
    terms: { provider: 'Clinician', providerPl: 'Clinicians', group: 'Unit', groupPl: 'Units', workflow: 'Medical Staff Onboarding', record: 'File' },
    stats: { providers: 410, groups: 16, active: 372 },
    stages: [
      { id: 's1', label: 'Refer',                owner: 'recruiter',     sla: 10 },
      { id: 's2', label: 'Evidence Review',      owner: 'credentialing', sla: 14 },
      { id: 's3', label: 'Credential Readiness', owner: 'credentialing', sla: 21 },
      { id: 's4', label: 'Privileging',          owner: 'mso',           sla: 14 },
      { id: 's5', label: 'Onboarding',           owner: 'mso',           sla: 14 },
      { id: 's6', label: 'Active Clinician',     owner: 'cmo',           sla: 0  },
    ],
    roleIds: ['credentialing', 'mso', 'chair', 'cmo'],
    dashboard: ['readiness_gauge', 'expiring_creds', 'open_tasks', 'source_health', 'cohort_table'],
    automations: [
      { id: 'a1', event: 'readiness_drops',  action: 'notify_credentialing', target: 'Readiness < 75%',  enabled: true },
      { id: 'a2', event: 'license_expiring', action: 'create_task',          target: 'Active clinicians', enabled: true },
    ],
  },
  {
    id: 'group', name: 'Summit Cardiology Medical Group', type: 'Medical Group',
    accent: '#f0a93a', icon: 'Briefcase', short: 'SCG',
    terms: { provider: 'Provider', providerPl: 'Providers', group: 'Practice', groupPl: 'Practices', workflow: 'Provider Enrollment', record: 'Profile' },
    stats: { providers: 96, groups: 7, active: 88 },
    stages: [
      { id: 's1', label: 'Recruit',            owner: 'recruiter',     sla: 12 },
      { id: 's2', label: 'Offer',              owner: 'recruiter',     sla: 7  },
      { id: 's3', label: 'Evidence Review',    owner: 'credentialing', sla: 10 },
      { id: 's4', label: 'Payer Enrollment',   owner: 'payer_ops',     sla: 45 },
      { id: 's5', label: 'Onboarding',         owner: 'coordinator',   sla: 14 },
      { id: 's6', label: 'Active Provider',    owner: 'chair',         sla: 0  },
    ],
    roleIds: ['recruiter', 'credentialing', 'payer_ops', 'coordinator'],
    dashboard: ['pipeline_funnel', 'offers_out', 'time_to_active', 'open_tasks', 'cohort_table'],
    automations: [
      { id: 'a1', event: 'offer_accepted',  action: 'start_onboarding',     target: 'New providers',     enabled: true },
      { id: 'a2', event: 'stage_stalled',   action: 'notify_recruiter',     target: 'Payer Enrollment',  enabled: true },
      { id: 'a3', event: 'evidence_changed',action: 'notify_credentialing', target: 'Any provider',      enabled: false },
    ],
  },
  {
    id: 'staffing', name: 'Meridian Locums & Staffing', type: 'Staffing Agency',
    accent: '#c08bf0', icon: 'Users', short: 'MLS',
    terms: { provider: 'Candidate', providerPl: 'Candidates', group: 'Assignment', groupPl: 'Assignments', workflow: 'Placement Pipeline', record: 'Candidate' },
    stats: { providers: 2310, groups: 184, active: 640 },
    stages: [
      { id: 's1', label: 'Source',             owner: 'recruiter',     sla: 5  },
      { id: 's2', label: 'Screen',             owner: 'recruiter',     sla: 7  },
      { id: 's3', label: 'Evidence Review',    owner: 'credentialing', sla: 7  },
      { id: 's4', label: 'Submit to Client',   owner: 'coordinator',   sla: 3  },
      { id: 's5', label: 'Offer',              owner: 'coordinator',   sla: 5  },
      { id: 's6', label: 'Credential Readiness',owner: 'credentialing',sla: 14 },
      { id: 's7', label: 'On Assignment',      owner: 'coordinator',   sla: 0  },
    ],
    roleIds: ['recruiter', 'coordinator', 'credentialing'],
    dashboard: ['pipeline_funnel', 'offers_out', 'time_to_active', 'stage_aging', 'evidence_changes', 'cohort_table'],
    automations: [
      { id: 'a1', event: 'stage_stalled',   action: 'notify_recruiter', target: 'Submit to Client', enabled: true },
      { id: 'a2', event: 'offer_accepted',  action: 'create_task',      target: 'Credentialing',    enabled: true },
      { id: 'a3', event: 'evidence_changed',action: 'flag_review',      target: 'On Assignment',    enabled: true },
    ],
  },
  {
    id: 'residency', name: 'University Hospital Residency', type: 'Residency Program',
    accent: '#6aa8f5', icon: 'GraduationCap', short: 'UHR',
    terms: { provider: 'Resident', providerPl: 'Residents', group: 'Program', groupPl: 'Programs', workflow: 'Trainee Lifecycle', record: 'Trainee' },
    stats: { providers: 312, groups: 24, active: 288 },
    stages: [
      { id: 's1', label: 'Match',              owner: 'program',       sla: 0  },
      { id: 's2', label: 'Evidence Review',    owner: 'credentialing', sla: 21 },
      { id: 's3', label: 'Onboarding',         owner: 'program',       sla: 30 },
      { id: 's4', label: 'Active Trainee',     owner: 'program',       sla: 0  },
      { id: 's5', label: 'Milestone Review',   owner: 'program',       sla: 0  },
      { id: 's6', label: 'Graduation',         owner: 'program',       sla: 0  },
    ],
    roleIds: ['program', 'credentialing', 'cmo'],
    dashboard: ['readiness_gauge', 'expiring_creds', 'open_tasks', 'cohort_table', 'source_health'],
    automations: [
      { id: 'a1', event: 'stage_entered',   action: 'create_task',          target: 'Milestone Review', enabled: true },
      { id: 'a2', event: 'license_expiring',action: 'notify_credentialing',  target: 'Active trainees',  enabled: true },
    ],
  },
  {
    id: 'payer', name: 'BlueRiver Health Plan', type: 'Payer',
    accent: '#ec7a9b', icon: 'Network', short: 'BRH',
    terms: { provider: 'Member Provider', providerPl: 'Network Providers', group: 'Network', groupPl: 'Networks', workflow: 'Network Enrollment', record: 'Application' },
    stats: { providers: 14200, groups: 38, active: 12940 },
    stages: [
      { id: 's1', label: 'Application',        owner: 'payer_ops',     sla: 5  },
      { id: 's2', label: 'Evidence Review',    owner: 'credentialing', sla: 30 },
      { id: 's3', label: 'Credential Readiness',owner: 'credentialing',sla: 45 },
      { id: 's4', label: 'Committee Review',   owner: 'cmo',           sla: 30 },
      { id: 's5', label: 'Directory Listing',  owner: 'payer_ops',     sla: 7  },
      { id: 's6', label: 'In-Network',         owner: 'payer_ops',     sla: 0  },
    ],
    roleIds: ['payer_ops', 'credentialing', 'cmo'],
    dashboard: ['pipeline_funnel', 'readiness_gauge', 'stage_aging', 'expiring_creds', 'cohort_table'],
    automations: [
      { id: 'a1', event: 'readiness_drops', action: 'flag_review',           target: 'Readiness < 90%',   enabled: true },
      { id: 'a2', event: 'license_expiring',action: 'notify_credentialing',  target: 'In-Network',        enabled: true },
      { id: 'a3', event: 'stage_stalled',   action: 'create_task',           target: 'Committee Review',  enabled: true },
    ],
  },
];

// Default capability matrix by role (organizations refine this live).
const DEFAULT_CAPS = {
  recruiter:     ['view_evidence', 'edit_pipeline'],
  credentialing: ['view_evidence', 'view_pii', 'edit_pipeline', 'approve'],
  chair:         ['view_evidence', 'edit_pipeline', 'approve', 'configure_dash'],
  mso:           ['view_evidence', 'view_pii', 'edit_pipeline', 'approve', 'configure_wf'],
  cmo:           ['view_evidence', 'view_pii', 'approve', 'configure_wf', 'configure_dash', 'manage_automation', 'manage_roles'],
  program:       ['view_evidence', 'view_pii', 'edit_pipeline', 'approve', 'configure_dash'],
  coordinator:   ['view_evidence', 'edit_pipeline'],
  payer_ops:     ['view_evidence', 'edit_pipeline', 'approve', 'configure_dash'],
};

// representative roster names for cohort widgets / stage volumes
const SAMPLE_NAMES = ['Macie Miller','Dev Patel','Aria Chen','Luis Romero','Priya Nair','Tomás Vega','Hana Sato','Omar Haddad','Greta Lind','Ivy Brooks','Noah Frank','Zoe Park'];

window.ROLES = ROLES;
window.CAPABILITIES = CAPABILITIES;
window.WIDGETS = WIDGETS;
window.EVENTS = EVENTS;
window.ACTIONS = ACTIONS;
window.WORKSPACES = WORKSPACES;
window.DEFAULT_CAPS = DEFAULT_CAPS;
window.SAMPLE_NAMES = SAMPLE_NAMES;
