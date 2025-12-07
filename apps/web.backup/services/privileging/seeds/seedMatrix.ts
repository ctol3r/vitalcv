/**
 * B170A-PRIV-002: Seed initial privilege matrix
 *
 * Seeds 5 specialties with realistic privilege definitions that the
 * PrivilegeSetV2 builder and demo UI rely on.
 */

import { Prisma, PrismaClient } from '@prisma/client';
import { buildPrivilegeMatrixEntry } from '../models/PrivilegeMatrix';

const prisma = new PrismaClient();

const matrixSeed = [
  {
    specialty: 'Cardiology',
    privileges: [
      {
        privilegeCode: 'CARD-CATH-ADULT',
        name: 'Adult Diagnostic Cardiac Catheterization',
        description: 'Performs diagnostic left and right heart catheterization procedures.',
        prerequisites: [
          {
            type: 'BOARD_CERT',
            boards: ['ABIM'],
            specialties: ['Cardiovascular Disease'],
            expirationBufferMonths: 6,
          },
          {
            type: 'PROCEDURE_VOLUME',
            procedureName: 'Cardiac Catheterization',
            minProcedures: 50,
            lookbackMonths: 24,
          },
        ],
      },
      {
        privilegeCode: 'CARD-PCI',
        name: 'Percutaneous Coronary Intervention',
        description: 'Performs balloon angioplasty and coronary stent placement.',
        prerequisites: [
          {
            type: 'BOARD_CERT',
            boards: ['ABIM'],
            specialties: ['Interventional Cardiology'],
          },
          {
            type: 'PROCEDURE_VOLUME',
            procedureName: 'Percutaneous Coronary Intervention',
            minProcedures: 100,
            lookbackMonths: 24,
          },
        ],
      },
      {
        privilegeCode: 'CARD-EP-ABL',
        name: 'Electrophysiology Ablation',
        description: 'Performs catheter-based ablation for atrial and ventricular arrhythmias.',
        prerequisites: [
          {
            type: 'BOARD_CERT',
            boards: ['ABIM'],
            specialties: ['Clinical Cardiac Electrophysiology'],
          },
          {
            type: 'PROCEDURE_VOLUME',
            procedureName: 'Cardiac Ablation',
            minProcedures: 30,
            lookbackMonths: 12,
          },
        ],
      },
      {
        privilegeCode: 'CARD-TTE',
        name: 'Comprehensive Transthoracic Echocardiography',
        description: 'Performs and interprets transthoracic echocardiograms.',
        prerequisites: [
          {
            type: 'BOARD_CERT',
            boards: ['ABIM'],
            specialties: ['Cardiovascular Disease'],
          },
        ],
      },
      {
        privilegeCode: 'CARD-TAVR',
        name: 'Transcatheter Aortic Valve Replacement',
        description: 'Performs percutaneous aortic valve replacement as primary operator.',
        prerequisites: [
          {
            type: 'BOARD_CERT',
            boards: ['ABIM'],
            specialties: ['Interventional Cardiology'],
          },
          {
            type: 'PROCEDURE_VOLUME',
            procedureName: 'TAVR',
            minProcedures: 20,
            lookbackMonths: 24,
          },
        ],
      },
    ],
  },
  {
    specialty: 'Orthopedic Surgery',
    privileges: [
      {
        privilegeCode: 'ORTHO-ARTHRO',
        name: 'Total Joint Arthroplasty',
        description: 'Performs primary and revision hip and knee replacements.',
        prerequisites: [
          {
            type: 'BOARD_CERT',
            boards: ['ABOS'],
            specialties: ['Orthopaedic Surgery'],
          },
          {
            type: 'PROCEDURE_VOLUME',
            procedureName: 'Joint Arthroplasty',
            minProcedures: 40,
            lookbackMonths: 12,
          },
        ],
      },
      {
        privilegeCode: 'ORTHO-SPINE',
        name: 'Adult Spinal Instrumentation',
        description: 'Performs complex spinal fusion and instrumentation procedures.',
        prerequisites: [
          {
            type: 'BOARD_CERT',
            boards: ['ABOS'],
            specialties: ['Orthopaedic Surgery'],
          },
          {
            type: 'SPECIALTY_MATCH',
            allowedSpecialties: ['Orthopedic Surgery', 'Neurological Surgery'],
          },
        ],
      },
      {
        privilegeCode: 'ORTHO-TRAUMA',
        name: 'Orthopedic Trauma Call',
        description: 'Takes call for high-energy orthopedic trauma cases.',
        prerequisites: [
          {
            type: 'LICENSE_STATUS',
            states: [],
            status: 'ACTIVE',
          },
        ],
      },
      {
        privilegeCode: 'ORTHO-SPORTS-ARTHROSCOPY',
        name: 'Advanced Sports Arthroscopy',
        description: 'Performs arthroscopic ligament reconstruction and cartilage restoration.',
        prerequisites: [
          {
            type: 'PROCEDURE_VOLUME',
            procedureName: 'Sports Arthroscopy',
            minProcedures: 60,
            lookbackMonths: 18,
          },
        ],
      },
    ],
  },
  {
    specialty: 'Internal Medicine',
    privileges: [
      {
        privilegeCode: 'IM-HOSPITALIST-CORE',
        name: 'Hospitalist Core Privileges',
        description: 'Admits, manages, and discharges adult inpatients with internal medicine diagnoses.',
        prerequisites: [
          {
            type: 'BOARD_CERT',
            boards: ['ABIM'],
            specialties: ['Internal Medicine'],
          },
          {
            type: 'LICENSE_STATUS',
            states: [],
            status: 'ACTIVE',
          },
        ],
      },
      {
        privilegeCode: 'IM-ICU',
        name: 'Medical ICU Coverage',
        description: 'Provides critical care management for medical ICU patients.',
        prerequisites: [
          {
            type: 'BOARD_CERT',
            boards: ['ABIM'],
            specialties: ['Pulmonary Disease', 'Critical Care Medicine'],
          },
        ],
      },
      {
        privilegeCode: 'IM-ENDO-INSULIN',
        name: 'Inpatient Insulin Pump Management',
        description: 'Adjusts insulin pump therapy for hospitalized patients.',
        prerequisites: [
          {
            type: 'SPECIALTY_MATCH',
            allowedSpecialties: ['Endocrinology', 'Internal Medicine'],
          },
        ],
      },
      {
        privilegeCode: 'IM-PICC',
        name: 'Peripherally Inserted Central Catheters',
        description: 'Places and manages PICC lines with ultrasound guidance.',
        prerequisites: [
          {
            type: 'PROCEDURE_VOLUME',
            procedureName: 'PICC Placement',
            minProcedures: 25,
            lookbackMonths: 12,
          },
        ],
      },
      {
        privilegeCode: 'IM-LP',
        name: 'Lumbar Puncture',
        description: 'Performs diagnostic and therapeutic lumbar punctures.',
        prerequisites: [
          {
            type: 'PROCEDURE_VOLUME',
            procedureName: 'Lumbar Puncture',
            minProcedures: 15,
            lookbackMonths: 12,
          },
        ],
      },
    ],
  },
  {
    specialty: 'Family Medicine',
    privileges: [
      {
        privilegeCode: 'FM-OB-DELIVERY',
        name: 'Low-Risk Obstetric Deliveries',
        description: 'Manages and delivers low-risk obstetrical patients.',
        prerequisites: [
          {
            type: 'BOARD_CERT',
            boards: ['ABFM'],
            specialties: ['Family Medicine'],
          },
          {
            type: 'PROCEDURE_VOLUME',
            procedureName: 'Vaginal Delivery',
            minProcedures: 25,
            lookbackMonths: 24,
          },
        ],
      },
      {
        privilegeCode: 'FM-NEWBORN',
        name: 'Newborn Nursery Coverage',
        description: 'Performs newborn assessments, stabilization, and discharge planning.',
        prerequisites: [
          {
            type: 'SPECIALTY_MATCH',
            allowedSpecialties: ['Family Medicine', 'Pediatrics'],
          },
        ],
      },
      {
        privilegeCode: 'FM-PROCEDURES-DERM',
        name: 'Office Dermatologic Procedures',
        description: 'Performs punch biopsies, excisions, and cryotherapy in clinic.',
        prerequisites: [],
      },
      {
        privilegeCode: 'FM-SPORTS-MSK',
        name: 'Sports & Musculoskeletal Ultrasound',
        description: 'Performs diagnostic ultrasound and ultrasound-guided joint injections.',
        prerequisites: [
          {
            type: 'PROCEDURE_VOLUME',
            procedureName: 'MSK Ultrasound',
            minProcedures: 30,
            lookbackMonths: 12,
          },
        ],
      },
      {
        privilegeCode: 'FM-DEA',
        name: 'Chronic Pain Management',
        description: 'Prescribes long-term opioid therapy under clinic policy.',
        prerequisites: [
          {
            type: 'DEA_REGISTRATION',
            schedules: ['II', 'III', 'IV'],
          },
        ],
      },
    ],
  },
  {
    specialty: 'Psychiatry',
    privileges: [
      {
        privilegeCode: 'PSY-INPATIENT',
        name: 'Inpatient Psychiatry Admitting',
        description: 'Admits and manages adult inpatient psychiatric patients.',
        prerequisites: [
          {
            type: 'BOARD_CERT',
            boards: ['ABPN'],
            specialties: ['Psychiatry'],
          },
        ],
      },
      {
        privilegeCode: 'PSY-ECT',
        name: 'Electroconvulsive Therapy',
        description: 'Performs ECT with anesthesia support.',
        prerequisites: [
          {
            type: 'PROCEDURE_VOLUME',
            procedureName: 'ECT',
            minProcedures: 20,
            lookbackMonths: 24,
          },
          {
            type: 'LICENSE_STATUS',
            states: [],
            status: 'ACTIVE',
          },
        ],
      },
      {
        privilegeCode: 'PSY-KETAMINE',
        name: 'Ketamine Infusion Therapy',
        description: 'Provides IV ketamine infusions for treatment-resistant depression.',
        prerequisites: [
          {
            type: 'DEA_REGISTRATION',
            schedules: ['III'],
          },
        ],
      },
      {
        privilegeCode: 'PSY-TMS',
        name: 'Transcranial Magnetic Stimulation',
        description: 'Performs and supervises TMS therapy sessions.',
        prerequisites: [],
      },
      {
        privilegeCode: 'PSY-CHILD',
        name: 'Child & Adolescent Psychiatry',
        description: 'Evaluates and manages psychiatric conditions in patients under 18.',
        prerequisites: [
          {
            type: 'SPECIALTY_MATCH',
            allowedSpecialties: ['Child Psychiatry', 'Psychiatry'],
          },
        ],
      },
    ],
  },
];

export async function seedPrivilegeMatrix() {
  for (const specialty of matrixSeed) {
    for (const privilege of specialty.privileges) {
      const entry = buildPrivilegeMatrixEntry({
        ...privilege,
        specialty: specialty.specialty,
      });

      await prisma.privilegeMatrix.upsert({
        where: { privilegeCode: entry.privilegeCode },
        update: {
          name: entry.name,
          description: entry.description,
          specialty: entry.specialty,
          prerequisites: entry.prerequisites as unknown as Prisma.InputJsonValue,
          tags: entry.tags,
          isActive: entry.isActive,
        },
        create: {
          privilegeCode: entry.privilegeCode,
          name: entry.name,
          description: entry.description,
          specialty: entry.specialty,
          prerequisites: entry.prerequisites as unknown as Prisma.InputJsonValue,
          tags: entry.tags,
          isActive: entry.isActive,
        },
      });
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedPrivilegeMatrix()
    .then(() => {
      console.log('✅ Privilege matrix seeded');
      return prisma.$disconnect();
    })
    .catch(async (error) => {
      console.error('❌ Failed to seed privilege matrix', error);
      await prisma.$disconnect();
      process.exit(1);
    });
}


