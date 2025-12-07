import { PrismaClient } from '@prisma/client';
import { buildEHROrderableMapEntry } from '../models/EHROrderableMap';
import { getServiceLogger } from '../../logging/serviceLogger';

const log = getServiceLogger('ehr/seeds/seedOrderables');
const prisma = new PrismaClient();

type OrderableSeedVariant = {
  ehrSystem: 'EPIC' | 'CERNER' | 'MEDITECH';
  ehrCode: string;
  description: string;
  requiredRoles: string[];
  exampleOrderText: string;
};

type OrderableSeed = {
  privilegeCode: string;
  specialty: string;
  variants: OrderableSeedVariant[];
};

const ORDERABLE_SEED_DATA: OrderableSeed[] = [
  {
    privilegeCode: 'CARD-CATH-ADULT',
    specialty: 'Cardiology',
    variants: [
      {
        ehrSystem: 'EPIC',
        ehrCode: 'EPC.CARD.CATH.ADULT',
        description: 'Epic cath lab diagnostic + interventional adult orderable',
        requiredRoles: ['CARD.CATH.ORDER', 'CARD.CATH.READ'],
        exampleOrderText: 'Cardiac cath with hemodynamic monitoring (Adult)',
      },
      {
        ehrSystem: 'CERNER',
        ehrCode: 'CRN_CARD_CATH_DIAG_ADULT',
        description: 'Cerner adult diagnostic cardiac catheterization',
        requiredRoles: ['CARDIO_INVASIVE', 'CARDIO_LAB_VIEW'],
        exampleOrderText: 'Diagnostic left/right heart catheterization',
      },
    ],
  },
  {
    privilegeCode: 'CARD-PCI-PRIMARY',
    specialty: 'Cardiology',
    variants: [
      {
        ehrSystem: 'EPIC',
        ehrCode: 'EPC.CARD.PCI.PRIMARY',
        description: 'Epic emergent PCI STEMI pathway orderable',
        requiredRoles: ['CARD.PCI.ORDER', 'CARD.STEMI.ACTIVATE'],
        exampleOrderText: 'Primary PCI for STEMI (door-to-balloon)',
      },
      {
        ehrSystem: 'CERNER',
        ehrCode: 'CRN_CARD_PCI_ACTIVATION',
        description: 'Cerner cath team activation for PCI',
        requiredRoles: ['CARDIO_CALLTEAM', 'CARDIO_INVASIVE'],
        exampleOrderText: 'Activate PCI team for emergent case',
      },
    ],
  },
  {
    privilegeCode: 'CARD-EP-ABLATION',
    specialty: 'Electrophysiology',
    variants: [
      {
        ehrSystem: 'EPIC',
        ehrCode: 'EPC.EP.ABLATION.AFIB',
        description: 'Epic electrophysiology ablation (AFib) order set',
        requiredRoles: ['EP.OPERATOR', 'EP.LAB.ACCESS'],
        exampleOrderText: 'Atrial fibrillation pulmonary vein isolation',
      },
      {
        ehrSystem: 'CERNER',
        ehrCode: 'CRN_EP_ABLATION_AF',
        description: 'Cerner EP ablation mapping + RF energy orderable',
        requiredRoles: ['EP.OPERATOR', 'EP.MONITOR'],
        exampleOrderText: 'Comprehensive EP ablation with 3D mapping',
      },
    ],
  },
  {
    privilegeCode: 'ANES-GENERAL-ADULT',
    specialty: 'Anesthesiology',
    variants: [
      {
        ehrSystem: 'EPIC',
        ehrCode: 'EPC.ANES.GENERAL.CASE',
        description: 'Epic general anesthesia case authorizations',
        requiredRoles: ['ANES.CASE.OWNER'],
        exampleOrderText: 'General anesthesia - adult inpatient case',
      },
      {
        ehrSystem: 'CERNER',
        ehrCode: 'CRN_ANES_GENERAL',
        description: 'Cerner general anesthesia documentation + meds',
        requiredRoles: ['ANES.SUPERVISOR', 'ANES.PROVIDER'],
        exampleOrderText: 'Anesthesia start record (general)',
      },
    ],
  },
  {
    privilegeCode: 'ANES-OB-EPIDURAL',
    specialty: 'Anesthesiology',
    variants: [
      {
        ehrSystem: 'EPIC',
        ehrCode: 'EPC.ANES.OB.EPIDURAL',
        description: 'Epic obstetric epidural placement workflow',
        requiredRoles: ['ANES.LD', 'ANES.EPIDURAL'],
        exampleOrderText: 'Labor epidural start + analgesia maintenance',
      },
      {
        ehrSystem: 'CERNER',
        ehrCode: 'CRN_ANES_OB_EPIDURAL',
        description: 'Cerner OB epidural kit/documentation',
        requiredRoles: ['ANES.LD', 'ANES.MEDS'],
        exampleOrderText: 'Initiate labor epidural analgesia',
      },
    ],
  },
  {
    privilegeCode: 'RAD-IR-EMBOLIZATION',
    specialty: 'Interventional Radiology',
    variants: [
      {
        ehrSystem: 'EPIC',
        ehrCode: 'EPC.IR.EMBO.TACE',
        description: 'Epic IR embolization (TACE) procedural order',
        requiredRoles: ['IR.OPERATOR', 'IR.MED.ACCESS'],
        exampleOrderText: 'Transarterial chemoembolization',
      },
      {
        ehrSystem: 'CERNER',
        ehrCode: 'CRN_IR_EMBO',
        description: 'Cerner IR embolization w/ device tracking',
        requiredRoles: ['IR.OPERATOR', 'IR.DEVICE.RELEASE'],
        exampleOrderText: 'Embolization with microcatheter + coils',
      },
    ],
  },
];

async function seedOrderable(record: OrderableSeed, variant: OrderableSeedVariant): Promise<void> {
  const normalized = buildEHROrderableMapEntry({
    privilegeCode: record.privilegeCode,
    ehrSystem: variant.ehrSystem,
    ehrCode: variant.ehrCode,
    description: variant.description,
    requiredRoles: variant.requiredRoles,
    metadata: {
      seed: 'demo',
      specialty: record.specialty,
      exampleOrderText: variant.exampleOrderText,
    },
  });

  const matrixRecord = await prisma.privilegeMatrix.findUnique({
    where: { privilegeCode: normalized.privilegeCode },
    select: { id: true },
  });

  await prisma.eHROrderableMap.upsert({
    where: {
      privilegeCode_ehrSystem: {
        privilegeCode: normalized.privilegeCode,
        ehrSystem: normalized.ehrSystem,
      },
    },
    create: {
      privilegeCode: normalized.privilegeCode,
      ehrSystem: normalized.ehrSystem,
      ehrCode: normalized.ehrCode,
      description: normalized.description,
      requiredRoles: normalized.requiredRoles,
      metadata: normalized.metadata,
      privilegeMatrixId: matrixRecord?.id,
    },
    update: {
      ehrCode: normalized.ehrCode,
      description: normalized.description,
      requiredRoles: normalized.requiredRoles,
      metadata: normalized.metadata,
      privilegeMatrixId: matrixRecord?.id,
      lastUpdatedAt: new Date(),
    },
  });
}

async function main() {
  log.info('🌱 Seeding demo EHR orderable mappings for privileges...');

  for (const record of ORDERABLE_SEED_DATA) {
    for (const variant of record.variants) {
      await seedOrderable(record, variant);
      log.info(
        `  • ${record.privilegeCode} → ${variant.ehrSystem} (${variant.ehrCode}) [${variant.requiredRoles.join(', ')}]`
      );
    }
  }

  log.info('✅ EHROrderableMap seed complete');
}

main()
  .catch((error) => {
    log.error('❌ Failed to seed orderable mappings', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
