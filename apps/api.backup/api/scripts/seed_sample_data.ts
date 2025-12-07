/**
 * Seed Sample Data for Testing
 * Populates database with realistic test data
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedSampleData() {
  console.log('🌱 Seeding sample data...\n');

  try {
    // Sample NLC residency move
    console.log('Creating sample NLC residency move...');
    const move = await prisma.nlcResidencyMove.create({
      data: {
        npi: '1234567890',
        fromState: 'TX',
        toState: 'FL',
        moveDate: new Date('2025-10-01'),
        breachDate: new Date('2025-11-30'),
        status: 'pending',
        alertsSent: [],
      },
    });
    console.log(`✓ Created move: ${move.fromState} → ${move.toState}`);

    // Sample PSYPACT credential
    console.log('\nCreating sample PSYPACT credential...');
    const psypact = await prisma.psypactCredential.create({
      data: {
        npi: '9876543210',
        epassport: 'EPASSPORT-DEMO-001',
        apitValid: true,
        tapValid: false,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        lastChecked: new Date(),
      },
    });
    console.log(`✓ Created PSYPACT credential: ${psypact.epassport}`);

    // Sample PECOS revalidations
    console.log('\nCreating sample PECOS revalidations...');
    const pecos1 = await prisma.pecosRevalidation.create({
      data: {
        npi: '1111111111',
        cycle: '5year',
        dueDate: new Date('2026-03-15'),
        completed: false,
        slackAlerts: [],
      },
    });
    const pecos2 = await prisma.pecosRevalidation.create({
      data: {
        npi: '2222222222',
        cycle: '3year',
        dueDate: new Date('2026-06-20'),
        completed: false,
        slackAlerts: [],
      },
    });
    console.log(`✓ Created 2 PECOS revalidations`);

    // Sample temporary privilege
    console.log('\nCreating sample temporary privilege...');
    const priv = await prisma.temporaryPrivilege.create({
      data: {
        npi: '3333333333',
        facility: 'City Hospital',
        startDate: new Date('2025-11-01'),
        endDate: new Date('2025-12-30'),
        daysGranted: 60,
        status: 'active',
      },
    });
    console.log(`✓ Created temp privilege: ${priv.daysGranted} days`);

    // Sample pharmacist exam record
    console.log('\nCreating sample pharmacist exam...');
    const exam = await prisma.pharmacistExam.create({
      data: {
        npi: '4444444444',
        naplexVer: 'new_outline',
        mpjeMode: 'state',
        examDate: new Date('2025-06-15'),
        evidenceUrls: {
          naplex_outline: 'https://nabp.pharmacy/programs/naplex/',
          mpje_state_law: 'https://nabp.pharmacy/programs/mpje/',
        },
      },
    });
    console.log(`✓ Created exam record: ${exam.naplexVer}, ${exam.mpjeMode}`);

    // Sample residency program
    console.log('\nCreating sample residency program...');
    const program = await prisma.program.create({
      data: {
        programId: 'SAMPLE-001',
        name: 'Internal Medicine Residency',
        institution: 'University Hospital',
        country: 'US',
        accreditor: 'ACGME',
        specialty: 'Internal Medicine',
        level: 'residency',
        url: 'https://example.org/residency',
        lastVerified: new Date(),
      },
    });
    console.log(`✓ Created program: ${program.name}`);

    // Sample ALITA-G logs
    console.log('\nCreating sample ALITA-G logs...');
    await prisma.agentLog.create({
      data: {
        domain: 'compliance',
        signal: 'telehealth_authz_pass',
        payload: {
          npi: '1234567890',
          patientState: 'TX',
          profession: 'nurse',
          tags: ['domain:compliance', 'signal:telehealth_authz_pass'],
        },
      },
    });
    await prisma.agentLog.create({
      data: {
        domain: 'compliance',
        signal: 'pecos_revalidation_success',
        payload: {
          npi: '1111111111',
          cycle: '5year',
          tags: ['domain:compliance', 'signal:pecos_revalidation_success'],
        },
      },
    });
    console.log(`✓ Created 2 ALITA-G compliance logs`);

    console.log('\n✅ Sample data seeded successfully!');
    console.log('\nYou can now test with these NPIs:');
    console.log('  - NLC Move:        1234567890');
    console.log('  - PSYPACT:         9876543210');
    console.log('  - PECOS:           1111111111, 2222222222');
    console.log('  - Temp Privilege:  3333333333');
    console.log('  - Pharmacist:      4444444444');
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedSampleData();

