export type PrivilegeCategory =
  | 'baseline'
  | 'core'
  | 'sedation'
  | 'imaging'
  | 'cardiology'
  | 'structural'
  | 'robotics'
  | 'pediatric';

export interface RemediationAction {
  label: string;
  href: string;
  intent: 'evidence' | 'training' | 'policy' | 'request';
}

export interface PrivilegeNode {
  code: string;
  name: string;
  description: string;
  category: PrivilegeCategory;
  level: number;
  lane: number;
  risk: 'low' | 'moderate' | 'high';
  prerequisites: string[];
  remediationActions: RemediationAction[];
}

export interface PrivilegeConflict {
  id: string;
  privileges: [string, string];
  reason: string;
  source: string;
  severity: 'warning' | 'critical';
}

export interface RenewalTimelineEntry {
  date: string;
  label: string;
  type: 'milestone' | 'task' | 'deadline';
}

export interface PrivilegeRenewalImpact {
  id: string;
  privilegeCode: string;
  expiresOn: string;
  risk: 'low' | 'moderate' | 'high';
  status: 'scheduled' | 'pending' | 'overdue';
  impactedCodes: string[];
  summary: string;
  overlayNotes: string;
  timeline: RenewalTimelineEntry[];
}

export interface ClinicianPrivilegeProfile {
  clinicianName: string;
  granted: string[];
  expiringSoon: string[];
  trainingInProgress: string[];
  conflictAssignments: string[];
}

export const PRIVILEGE_NODES: PrivilegeNode[] = [
  {
    code: 'BASE-001',
    name: 'Primary Source Verification',
    description: 'Baseline PSV packet with identity, licensure, and malpractice coverage on file.',
    category: 'baseline',
    level: 0,
    lane: 0,
    risk: 'low',
    prerequisites: [],
    remediationActions: [
      {
        label: 'Upload PSV evidence',
        href: '/demo/clinician/passport',
        intent: 'evidence',
      },
      {
        label: 'Request credentialing ops review',
        href: '/org/support',
        intent: 'request',
      },
    ],
  },
  {
    code: 'CORE-100',
    name: 'Inpatient Core Privileges',
    description: 'Admit, manage, and discharge general medicine cases on med-surg and step-down units.',
    category: 'core',
    level: 1,
    lane: 0,
    risk: 'moderate',
    prerequisites: ['BASE-001'],
    remediationActions: [
      {
        label: 'Upload inpatient case logs',
        href: '/demo/clinician/revalidation',
        intent: 'evidence',
      },
    ],
  },
  {
    code: 'CORE-150',
    name: 'Moderate Sedation',
    description: 'Administer moderate sedation following ASA guidelines for invasive procedures.',
    category: 'sedation',
    level: 1,
    lane: 1,
    risk: 'moderate',
    prerequisites: ['BASE-001'],
    remediationActions: [
      {
        label: 'Document sedation competencies',
        href: '/demo/clinician/fppe/demo',
        intent: 'evidence',
      },
      {
        label: 'Schedule sedation simulation',
        href: '/demo/org/fppe',
        intent: 'training',
      },
    ],
  },
  {
    code: 'IMAGING-050',
    name: 'Fluoroscopy Supervision',
    description: 'Operate fluoroscopy equipment with current physicist review and badge monitoring.',
    category: 'imaging',
    level: 1,
    lane: 2,
    risk: 'moderate',
    prerequisites: ['BASE-001'],
    remediationActions: [
      {
        label: 'Upload badge dosimetry',
        href: '/demo/clinician/passport',
        intent: 'evidence',
      },
      {
        label: 'Request physicist audit',
        href: '/demo/org/committee/clinician-42',
        intent: 'request',
      },
    ],
  },
  {
    code: 'CARD-220',
    name: 'Cath Lab Diagnostic',
    description: 'Perform diagnostic cardiac catheterizations with hemodynamic interpretation.',
    category: 'cardiology',
    level: 2,
    lane: 0,
    risk: 'moderate',
    prerequisites: ['CORE-100', 'IMAGING-050'],
    remediationActions: [
      {
        label: 'Submit cath procedure logs',
        href: '/demo/org/oppe',
        intent: 'evidence',
      },
    ],
  },
  {
    code: 'CARD-320',
    name: 'Percutaneous Coronary Intervention',
    description: 'Perform PCI with stent deployment and manage periprocedural complications.',
    category: 'cardiology',
    level: 3,
    lane: 0,
    risk: 'high',
    prerequisites: ['CARD-220', 'CORE-150'],
    remediationActions: [
      {
        label: 'Complete proctor attestations',
        href: '/demo/org/committee/clinician-42',
        intent: 'evidence',
      },
      {
        label: 'Enroll in cath outcomes review',
        href: '/demo/org/oppe/dashboard',
        intent: 'training',
      },
    ],
  },
  {
    code: 'DEVICE-610',
    name: 'Robotic Console Credential',
    description: 'Operate vascular robotics console with manufacturer credentialing on file.',
    category: 'robotics',
    level: 3,
    lane: 1,
    risk: 'moderate',
    prerequisites: ['CORE-150'],
    remediationActions: [
      {
        label: 'Attach vendor sign-off',
        href: '/demo/clinician/passport',
        intent: 'evidence',
      },
      {
        label: 'Book simulator lab',
        href: '/demo/org/fppe',
        intent: 'training',
      },
    ],
  },
  {
    code: 'PED-260',
    name: 'Pediatric Cath Leadership',
    description: 'Serve as attending of record for pediatric diagnostic and interventional caths.',
    category: 'pediatric',
    level: 3,
    lane: 2,
    risk: 'high',
    prerequisites: ['CARD-220'],
    remediationActions: [
      {
        label: 'Upload pediatric outcomes review',
        href: '/demo/clinician/oppe',
        intent: 'evidence',
      },
      {
        label: 'Document children’s hospital affiliation',
        href: '/demo/org/clinicians/demo/payer-network',
        intent: 'policy',
      },
    ],
  },
  {
    code: 'ROBOT-500',
    name: 'Robotic PCI',
    description: 'Perform remote robotic PCI with independent troubleshooting of console alarms.',
    category: 'robotics',
    level: 4,
    lane: 1,
    risk: 'high',
    prerequisites: ['CARD-320', 'DEVICE-610'],
    remediationActions: [
      {
        label: 'Upload robotic case video',
        href: '/demo/clinician/oppe',
        intent: 'evidence',
      },
      {
        label: 'Request vendor field visit',
        href: '/demo/org/support',
        intent: 'request',
      },
    ],
  },
  {
    code: 'STRUCT-410',
    name: 'Structural Heart Interventions',
    description: 'Perform TAVR, left atrial appendage closure, and septal defect interventions.',
    category: 'structural',
    level: 4,
    lane: 0,
    risk: 'high',
    prerequisites: ['CARD-320', 'IMAGING-050'],
    remediationActions: [
      {
        label: 'Submit structural case bundle',
        href: '/demo/clinician/revalidation',
        intent: 'evidence',
      },
      {
        label: 'Schedule hybrid OR simulation',
        href: '/demo/org/fppe',
        intent: 'training',
      },
    ],
  },
  {
    code: 'HYBRID-720',
    name: 'Hybrid Structural & Robotic Suite',
    description: 'Lead combined robotic coronary and structural heart cases during hybrid room blocks.',
    category: 'structural',
    level: 5,
    lane: 0,
    risk: 'high',
    prerequisites: ['STRUCT-410', 'ROBOT-500'],
    remediationActions: [
      {
        label: 'Upload hybrid OR readiness plan',
        href: '/demo/org/privileges/matrix',
        intent: 'policy',
      },
      {
        label: 'File multidisciplinary competency log',
        href: '/demo/org/committee/clinician-42/submit',
        intent: 'evidence',
      },
    ],
  },
];

export const PRIVILEGE_NODE_MAP = new Map(PRIVILEGE_NODES.map((node) => [node.code, node]));

export function getPrivilegeByCode(code: string) {
  return PRIVILEGE_NODE_MAP.get(code.toUpperCase());
}

export function getPrerequisiteEdges(nodes: PrivilegeNode[] = PRIVILEGE_NODES) {
  return nodes.flatMap((node) =>
    node.prerequisites.map((source) => ({
      id: `${source}->${node.code}`,
      source,
      target: node.code,
    })),
  );
}

export function getDownstreamPrivileges(code: string, nodes: PrivilegeNode[] = PRIVILEGE_NODES) {
  const adjacency = new Map<string, string[]>();
  getPrerequisiteEdges(nodes).forEach((edge) => {
    const existing = adjacency.get(edge.source) ?? [];
    existing.push(edge.target);
    adjacency.set(edge.source, existing);
  });

  const seen = new Set<string>();
  const stack = [code];
  while (stack.length) {
    const current = stack.pop();
    if (!current || seen.has(current)) continue;
    seen.add(current);
    const next = adjacency.get(current) ?? [];
    next.forEach((child) => stack.push(child));
  }
  seen.delete(code);
  return Array.from(seen);
}

export function getAllPrerequisites(code: string, nodes: PrivilegeNode[] = PRIVILEGE_NODES) {
  const map = new Map(nodes.map((node) => [node.code, node.prerequisites]));
  const visited = new Set<string>();
  const result = new Set<string>();
  const stack = [...(map.get(code) ?? [])];

  while (stack.length) {
    const current = stack.pop();
    if (!current || visited.has(current)) continue;
    visited.add(current);
    result.add(current);
    (map.get(current) ?? []).forEach((next) => stack.push(next));
  }

  return Array.from(result);
}

export const PRIVILEGE_CONFLICTS: PrivilegeConflict[] = [
  {
    id: 'conflict-robotic-peds',
    privileges: ['ROBOT-500', 'PED-260'],
    reason:
      'Bylaws 7.4 require exclusive call teams for robotic PCI and pediatric cath leadership within the same 7-day block.',
    source: 'Medical Staff Policy 7.4',
    severity: 'critical',
  },
  {
    id: 'conflict-structural-coverage',
    privileges: ['STRUCT-410', 'PED-260'],
    reason: 'Structural heart block coverage cannot overlap with pediatric cath leadership per scheduling directive.',
    source: 'Service Line Directive 22-09',
    severity: 'warning',
  },
];

export const PRIVILEGE_RENEWALS: PrivilegeRenewalImpact[] = [
  {
    id: 'renewal-card-320',
    privilegeCode: 'CARD-320',
    expiresOn: '2025-12-01',
    risk: 'high',
    status: 'pending',
    impactedCodes: ['STRUCT-410', 'ROBOT-500', 'HYBRID-720'],
    summary: 'PCI volume fell below bylaws threshold; remediation plan required before December credentials meeting.',
    overlayNotes: 'Downstream structural and robotic privileges pause if PCI renewal lapses.',
    timeline: [
      { date: '2025-09-15', label: 'Volume audit issued', type: 'milestone' },
      { date: '2025-10-05', label: 'Proctor observations scheduled', type: 'task' },
      { date: '2025-11-10', label: 'Committee pre-read due', type: 'task' },
      { date: '2025-12-01', label: 'Renewal decision', type: 'deadline' },
    ],
  },
  {
    id: 'renewal-imaging-050',
    privilegeCode: 'IMAGING-050',
    expiresOn: '2025-08-15',
    risk: 'moderate',
    status: 'scheduled',
    impactedCodes: ['CARD-220', 'CARD-320', 'STRUCT-410'],
    summary: 'Badge dosimetry expiring; physics audit scheduled with radiation safety committee.',
    overlayNotes: 'Any lapse cascades into cath lab diagnostics and structural cases.',
    timeline: [
      { date: '2025-07-01', label: 'Badge exchange', type: 'task' },
      { date: '2025-07-18', label: 'Physics report upload', type: 'milestone' },
      { date: '2025-08-15', label: 'Dosimetry expiration', type: 'deadline' },
    ],
  },
  {
    id: 'renewal-device-610',
    privilegeCode: 'DEVICE-610',
    expiresOn: '2025-06-30',
    risk: 'high',
    status: 'overdue',
    impactedCodes: ['ROBOT-500', 'HYBRID-720'],
    summary: 'Vendor credential expired during console upgrade; robotic cases are throttled until retraining logs arrive.',
    overlayNotes: 'Robotic procedures forced to manual mode without this prerequisite.',
    timeline: [
      { date: '2025-05-10', label: 'Upgrade notice issued', type: 'milestone' },
      { date: '2025-06-05', label: 'Simulator slot assigned', type: 'task' },
      { date: '2025-06-30', label: 'Credential expiration', type: 'deadline' },
      { date: '2025-07-12', label: 'Remediation hearing', type: 'milestone' },
    ],
  },
];

export const CLINICIAN_PRIVILEGE_PROFILE: ClinicianPrivilegeProfile = {
  clinicianName: 'Dr. Nia Rivers',
  granted: ['BASE-001', 'CORE-100', 'CORE-150', 'IMAGING-050', 'CARD-220'],
  expiringSoon: ['CORE-150', 'IMAGING-050'],
  trainingInProgress: ['DEVICE-610'],
  conflictAssignments: ['PED-260'],
};


