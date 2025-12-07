/**
 * Seeds privilege dependency trees for core specialties.
 *
 * Includes anesthesia, cardiology, gastroenterology, orthopedics, and general surgery.
 * Validates each tree as a DAG before persisting nodes and edges.
 */

import { PrismaClient } from '@prisma/client';
import { getServiceLogger } from '../../logging/serviceLogger';
import { PrivilegeGraphBuilder } from '../buildGraph';
import {
  buildPrivilegeNode,
  type CreatePrivilegeNodeInput,
  type PrivilegeNode,
} from '../models/PrivilegeNode';
import {
  buildPrivilegeDependency,
  type CreatePrivilegeDependencyInput,
  type PrivilegeDependency,
} from '../models/PrivilegeDependency';

const log = getServiceLogger('privyDep/seeds/seedTrees');
const prisma = new PrismaClient();

type PrivilegeTreeSeed = {
  specialty: string;
  nodes: CreatePrivilegeNodeInput[];
  dependencies: CreatePrivilegeDependencyInput[];
};

const SPECIALTY_TREES: PrivilegeTreeSeed[] = [
  {
    specialty: 'Anesthesiology',
    nodes: [
      {
        privilegeCode: 'BASIC SEDATION',
        name: 'Basic Sedation',
        category: 'procedural',
        description: 'Performs moderate sedation with continuous physiologic monitoring.',
        specialty: 'Anesthesiology',
        tags: ['sedation', 'core'],
      },
      {
        privilegeCode: 'Airway Management',
        name: 'Advanced Airway Management',
        category: 'procedural',
        description: 'Manages anticipated and unanticipated difficult airways with advanced adjuncts.',
        specialty: 'Anesthesiology',
        tags: ['airway'],
      },
      {
        privilegeCode: 'Arterial Line Placement',
        name: 'Arterial Line Placement',
        category: 'diagnostic',
        description: 'Places radial, femoral, or axillary arterial catheters for invasive monitoring.',
        specialty: 'Anesthesiology',
        tags: ['vascular', 'monitoring'],
      },
      {
        privilegeCode: 'Central Line',
        name: 'Central Venous Catheterization',
        category: 'procedural',
        description: 'Places internal jugular, subclavian, or femoral central venous catheters.',
        specialty: 'Anesthesiology',
        tags: ['vascular'],
      },
      {
        privilegeCode: 'Vascular Access Advanced',
        name: 'Advanced Vascular Access',
        category: 'surgical',
        description: 'Performs tunneled, dialysis, and advanced vascular access procedures.',
        specialty: 'Anesthesiology',
        tags: ['vascular', 'advanced'],
      },
    ],
    dependencies: [
      {
        parentPrivilegeCode: 'basic sedation',
        childPrivilegeCode: 'airway management',
        dependencyType: 'REQUIRES',
        rationale: 'Sedation competency is required before advanced airway management.',
      },
      {
        parentPrivilegeCode: 'basic sedation',
        childPrivilegeCode: 'arterial line placement',
        dependencyType: 'REQUIRES',
        rationale: 'Sedation skills required for invasive monitoring.',
      },
      {
        parentPrivilegeCode: 'airway management',
        childPrivilegeCode: 'arterial line placement',
        dependencyType: 'REQUIRES',
        rationale: 'Advanced airway rescue competency required for invasive line placement.',
      },
      {
        parentPrivilegeCode: 'arterial line placement',
        childPrivilegeCode: 'central line',
        dependencyType: 'REQUIRES',
      },
      {
        parentPrivilegeCode: 'central line',
        childPrivilegeCode: 'vascular access advanced',
        dependencyType: 'REQUIRES',
      },
      {
        parentPrivilegeCode: 'central line',
        childPrivilegeCode: 'airway management',
        dependencyType: 'ENHANCES',
        rationale: 'Central-line credentialing refreshes airway equipment competencies.',
      },
    ],
  },
  {
    specialty: 'Cardiology',
    nodes: [
      {
        privilegeCode: 'Cardiology Core Privileges',
        name: 'Cardiology Core Privileges',
        category: 'diagnostic',
        description: 'Cardiology inpatient consults, echo interpretation, and stress testing.',
        specialty: 'Cardiology',
        tags: ['core'],
      },
      {
        privilegeCode: 'Cardiac Cath Adult',
        name: 'Adult Cardiac Catheterization',
        category: 'diagnostic',
        description: 'Performs diagnostic left and right heart catheterizations.',
        specialty: 'Cardiology',
        tags: ['cath-lab'],
      },
      {
        privilegeCode: 'Structural Heart',
        name: 'Structural Heart Interventions',
        category: 'procedural',
        description: 'Performs ASD/PFO closures and valvuloplasties.',
        specialty: 'Cardiology',
        tags: ['structural'],
      },
      {
        privilegeCode: 'EP Study',
        name: 'Electrophysiology Study',
        category: 'diagnostic',
        description: 'Invasive EP studies with mapping and ablation.',
        specialty: 'Cardiology',
        tags: ['ep'],
      },
      {
        privilegeCode: 'Pacemaker Implant',
        name: 'Pacemaker and ICD Implantation',
        category: 'procedural',
        description: 'Implants dual-chamber pacemakers and defibrillators.',
        specialty: 'Cardiology',
        tags: ['device'],
      },
      {
        privilegeCode: 'TAVR Program',
        name: 'Transcatheter Aortic Valve Replacement',
        category: 'surgical',
        description: 'Performs TAVR as part of heart team program.',
        specialty: 'Cardiology',
        tags: ['structural', 'advanced'],
      },
    ],
    dependencies: [
      {
        parentPrivilegeCode: 'Cardiology Core Privileges',
        childPrivilegeCode: 'cardiac cath adult',
        dependencyType: 'REQUIRES',
      },
      {
        parentPrivilegeCode: 'cardiac cath adult',
        childPrivilegeCode: 'structural heart',
        dependencyType: 'REQUIRES',
      },
      {
        parentPrivilegeCode: 'cardiac cath adult',
        childPrivilegeCode: 'ep study',
        dependencyType: 'ENHANCES',
      },
      {
        parentPrivilegeCode: 'ep study',
        childPrivilegeCode: 'pacemaker implant',
        dependencyType: 'REQUIRES',
      },
      {
        parentPrivilegeCode: 'structural heart',
        childPrivilegeCode: 'tavr program',
        dependencyType: 'REQUIRES',
      },
      {
        parentPrivilegeCode: 'pacemaker implant',
        childPrivilegeCode: 'tavr program',
        dependencyType: 'ENHANCES',
        rationale: 'Device management competency enhances TAVR credentialing.',
      },
    ],
  },
  {
    specialty: 'Gastroenterology',
    nodes: [
      {
        privilegeCode: 'GI Core Privileges',
        name: 'Gastroenterology Core',
        category: 'diagnostic',
        description: 'Clinic, inpatient consults, moderate sedation, and capsule endoscopy.',
        specialty: 'Gastroenterology',
        tags: ['core'],
      },
      {
        privilegeCode: 'Upper Endoscopy',
        name: 'Upper Endoscopy',
        category: 'diagnostic',
        description: 'Performs EGD with biopsy and limited therapy.',
        specialty: 'Gastroenterology',
        tags: ['egd'],
      },
      {
        privilegeCode: 'Colonoscopy',
        name: 'Colonoscopy',
        category: 'diagnostic',
        description: 'Performs colonoscopy with polypectomy and advanced hemostasis.',
        specialty: 'Gastroenterology',
        tags: ['colonoscopy'],
      },
      {
        privilegeCode: 'ERCP Advanced',
        name: 'Advanced ERCP',
        category: 'procedural',
        description: 'Performs ERCP with sphincterotomy, stenting, and lithotripsy.',
        specialty: 'Gastroenterology',
        tags: ['advanced'],
      },
      {
        privilegeCode: 'EUS Advanced',
        name: 'Advanced EUS',
        category: 'procedural',
        description: 'Performs diagnostic and therapeutic endoscopic ultrasound.',
        specialty: 'Gastroenterology',
        tags: ['advanced'],
      },
    ],
    dependencies: [
      {
        parentPrivilegeCode: 'gi core privileges',
        childPrivilegeCode: 'upper endoscopy',
        dependencyType: 'REQUIRES',
      },
      {
        parentPrivilegeCode: 'gi core privileges',
        childPrivilegeCode: 'colonoscopy',
        dependencyType: 'REQUIRES',
      },
      {
        parentPrivilegeCode: 'upper endoscopy',
        childPrivilegeCode: 'eus advanced',
        dependencyType: 'REQUIRES',
      },
      {
        parentPrivilegeCode: 'colonoscopy',
        childPrivilegeCode: 'ercp advanced',
        dependencyType: 'REQUIRES',
      },
      {
        parentPrivilegeCode: 'ercp advanced',
        childPrivilegeCode: 'eus advanced',
        dependencyType: 'ENHANCES',
      },
    ],
  },
  {
    specialty: 'Orthopedics',
    nodes: [
      {
        privilegeCode: 'Ortho Core',
        name: 'Orthopedic Core',
        category: 'surgical',
        description: 'General orthopedic trauma, inpatient consults, and casting.',
        specialty: 'Orthopedics',
        tags: ['core'],
      },
      {
        privilegeCode: 'Arthroscopy Knee',
        name: 'Knee Arthroscopy',
        category: 'procedural',
        description: 'Performs diagnostic and therapeutic knee arthroscopy.',
        specialty: 'Orthopedics',
        tags: ['arthroscopy'],
      },
      {
        privilegeCode: 'Arthroscopy Shoulder',
        name: 'Shoulder Arthroscopy',
        category: 'procedural',
        description: 'Performs rotator cuff repair and instability procedures arthroscopically.',
        specialty: 'Orthopedics',
        tags: ['arthroscopy'],
      },
      {
        privilegeCode: 'Total Knee Arthroplasty',
        name: 'Total Knee Arthroplasty',
        category: 'surgical',
        description: 'Performs primary and revision total knee arthroplasty.',
        specialty: 'Orthopedics',
        tags: ['arthroplasty'],
      },
      {
        privilegeCode: 'Orthopedic Trauma Advanced',
        name: 'Advanced Orthopedic Trauma',
        category: 'surgical',
        description: 'Complex periarticular trauma and external fixation.',
        specialty: 'Orthopedics',
        tags: ['trauma'],
      },
      {
        privilegeCode: 'Spine Anterior',
        name: 'Anterior Spine Surgery',
        category: 'surgical',
        description: 'Performs cervical and lumbar anterior spine exposures.',
        specialty: 'Orthopedics',
        tags: ['spine'],
      },
    ],
    dependencies: [
      {
        parentPrivilegeCode: 'ortho core',
        childPrivilegeCode: 'arthroscopy knee',
        dependencyType: 'REQUIRES',
      },
      {
        parentPrivilegeCode: 'ortho core',
        childPrivilegeCode: 'arthroscopy shoulder',
        dependencyType: 'REQUIRES',
      },
      {
        parentPrivilegeCode: 'arthroscopy knee',
        childPrivilegeCode: 'total knee arthroplasty',
        dependencyType: 'REQUIRES',
      },
      {
        parentPrivilegeCode: 'orthopedic trauma advanced',
        childPrivilegeCode: 'spine anterior',
        dependencyType: 'ENHANCES',
      },
      {
        parentPrivilegeCode: 'ortho core',
        childPrivilegeCode: 'orthopedic trauma advanced',
        dependencyType: 'REQUIRES',
      },
      {
        parentPrivilegeCode: 'total knee arthroplasty',
        childPrivilegeCode: 'spine anterior',
        dependencyType: 'MUTUALLY_EXCLUSIVE',
        rationale: 'Programs allow either spine or arthroplasty track during the same cycle.',
      },
    ],
  },
  {
    specialty: 'General Surgery',
    nodes: [
      {
        privilegeCode: 'General Surgery Core',
        name: 'General Surgery Core',
        category: 'surgical',
        description: 'Bread-and-butter general surgery including appendectomy and hernia repair.',
        specialty: 'General Surgery',
        tags: ['core'],
      },
      {
        privilegeCode: 'Lap Appendectomy',
        name: 'Laparoscopic Appendectomy',
        category: 'surgical',
        description: 'Performs laparoscopic appendectomy for uncomplicated appendicitis.',
        specialty: 'General Surgery',
        tags: ['laparoscopic'],
      },
      {
        privilegeCode: 'Lap Chole',
        name: 'Laparoscopic Cholecystectomy',
        category: 'surgical',
        description: 'Performs elective and urgent laparoscopic cholecystectomy.',
        specialty: 'General Surgery',
        tags: ['laparoscopic'],
      },
      {
        privilegeCode: 'Complex Hernia',
        name: 'Complex Abdominal Wall Reconstruction',
        category: 'surgical',
        description: 'Performs component separation and mesh reconstruction for complex hernias.',
        specialty: 'General Surgery',
        tags: ['advanced'],
      },
      {
        privilegeCode: 'Hepatobiliary Advanced',
        name: 'Advanced Hepatobiliary Surgery',
        category: 'surgical',
        description: 'Performs liver resections and bile duct reconstruction.',
        specialty: 'General Surgery',
        tags: ['advanced'],
      },
      {
        privilegeCode: 'Damage Control Laparotomy',
        name: 'Damage Control Laparotomy',
        category: 'surgical',
        description: 'Performs trauma laparotomy with staged abdominal closure.',
        specialty: 'General Surgery',
        tags: ['trauma'],
      },
    ],
    dependencies: [
      {
        parentPrivilegeCode: 'general surgery core',
        childPrivilegeCode: 'lap appendectomy',
        dependencyType: 'REQUIRES',
      },
      {
        parentPrivilegeCode: 'general surgery core',
        childPrivilegeCode: 'lap chole',
        dependencyType: 'REQUIRES',
      },
      {
        parentPrivilegeCode: 'lap chole',
        childPrivilegeCode: 'hepatobiliary advanced',
        dependencyType: 'REQUIRES',
      },
      {
        parentPrivilegeCode: 'lap appendectomy',
        childPrivilegeCode: 'complex hernia',
        dependencyType: 'REQUIRES',
      },
      {
        parentPrivilegeCode: 'damage control laparotomy',
        childPrivilegeCode: 'hepatobiliary advanced',
        dependencyType: 'ENHANCES',
      },
      {
        parentPrivilegeCode: 'damage control laparotomy',
        childPrivilegeCode: 'complex hernia',
        dependencyType: 'CONFLICTS_WITH',
        rationale: 'Hospitals limit trauma exclusive pathways from concurrently holding elective complex hernia blocks.',
      },
      {
        parentPrivilegeCode: 'general surgery core',
        childPrivilegeCode: 'damage control laparotomy',
        dependencyType: 'REQUIRES',
      },
    ],
  },
];

async function seedTree(tree: PrivilegeTreeSeed) {
  const builtNodes = tree.nodes.map(buildPrivilegeNode);
  const builtDependencies = tree.dependencies.map(buildPrivilegeDependency);

  new PrivilegeGraphBuilder(builtNodes, builtDependencies).build();

  log.info(`🌱 Seeding ${tree.specialty} dependency tree (${builtNodes.length} nodes)...`);

  const nodeIdMap = new Map<string, string>();
  for (const node of builtNodes) {
    const record = await prisma.privilegeNode.upsert({
      where: { privilegeCode: node.privilegeCode },
      create: {
        privilegeCode: node.privilegeCode,
        name: node.name,
        category: node.category,
        description: node.description,
        specialty: node.specialty,
        tags: node.tags,
        metadata: node.metadata ?? null,
      },
      update: {
        name: node.name,
        category: node.category,
        description: node.description,
        specialty: node.specialty,
        tags: node.tags,
        metadata: node.metadata ?? null,
        updatedAt: new Date(),
      },
    });
    nodeIdMap.set(node.privilegeCode, record.id);
  }

  for (const dependency of builtDependencies) {
    const parentId = nodeIdMap.get(dependency.parentPrivilegeCode);
    const childId = nodeIdMap.get(dependency.childPrivilegeCode);
    if (!parentId || !childId) {
      throw new Error(
        `Unable to resolve node IDs for dependency ${dependency.parentPrivilegeCode} -> ${dependency.childPrivilegeCode}`,
      );
    }

    await prisma.privilegeDependency.upsert({
      where: {
        parentPrivilegeId_childPrivilegeId_dependencyType: {
          parentPrivilegeId: parentId,
          childPrivilegeId: childId,
          dependencyType: dependency.dependencyType,
        },
      },
      create: {
        parentPrivilegeId: parentId,
        childPrivilegeId: childId,
        dependencyType: dependency.dependencyType,
        rationale: dependency.rationale ?? null,
      },
      update: {
        rationale: dependency.rationale ?? null,
      },
    });
  }

  log.info(`✅ Finished ${tree.specialty}`);
}

async function main() {
  for (const tree of SPECIALTY_TREES) {
    await seedTree(tree);
  }
}

main()
  .catch((error) => {
    log.error('❌ Failed to seed privilege dependency trees', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

