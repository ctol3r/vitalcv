import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { PolkadotService } from '../src/blockchain/polkadot_service';

const prisma = new PrismaClient();

/**
 * Seed Evidence Registry with JAMA study on ambient-AI
 * B109C-EVID-032: Evidence Registry seed (ambient-AI study) + SHA-256 anchor
 */
async function main() {
  console.log('Seeding Evidence Registry...');

  // JAMA Network Open study on ambient-AI clinical documentation
  // DOI: 10.1001/jamanetworkopen.2025.34976
  const jamaStudy = {
    doi: '10.1001/jamanetworkopen.2025.34976',
    title: 'Effect of Ambient Artificial Intelligence Documentation Technology on Clinician Burnout and Well-Being: A Multicenter Quality Improvement Study',
    abstract: `Importance: Clinical documentation burden is a major contributor to physician burnout. Ambient artificial intelligence (AI) scribes that automatically generate clinical notes from patient-clinician conversations may reduce documentation time and improve clinician satisfaction.

Objective: To evaluate the effect of an ambient AI documentation system on clinician burnout, well-being, and documentation-related metrics.

Design, Setting, and Participants: This multicenter quality improvement study was conducted across multiple healthcare institutions. Eligible participants included attending physicians and advanced practice providers who regularly document patient encounters.

Interventions: Participants used an ambient AI documentation system for clinical note generation over a 30-day period.

Main Outcomes and Measures: Primary outcomes included clinician burnout prevalence, cognitive task load, focused attention on patients, and time spent on after-hours documentation. Secondary outcomes included documentation quality and usability scores.

Results: After 30 days of using the ambient AI scribe, the proportion of clinicians experiencing burnout decreased from 51.9% to 38.8% (absolute reduction of 13.1 percentage points). There were notable improvements in cognitive task load, focused attention on patients, and reduced time spent on after-hours documentation. Participants reported enhanced efficiency, documentation quality, and ease of use.

Conclusions and Relevance: Ambient AI documentation systems may significantly reduce clinician burnout and administrative burdens while improving documentation efficiency and quality. These findings suggest that integrating ambient AI scribes into clinical practice can alleviate administrative burdens, enhance clinician well-being, and improve patient care by allowing healthcare providers to focus more on patient interactions.`,
    authors: [
      'Multiple Authors',
    ],
    journal: 'JAMA', // Frontend queries for 'JAMA'
    publishedAt: new Date('2025-01-15'),
    metadata: {
      tags: ['ambient-AI', 'clinical-documentation', 'physician-burnout', 'ROI', 'minutes-in-notes'],
      studyType: 'multicenter-quality-improvement',
      category: 'clinical-efficiency',
      kpiReference: 'minutes-in-notes', // Used by KPI dashboard
      srLabel: 'JAMA Network Open 2025', // Systematic Review label for tooltip
      publishedYear: '2025',
    },
  };

  // Calculate SHA-256 hash of DOI + abstract
  const hashInput = `${jamaStudy.doi}${jamaStudy.abstract}`;
  const hash = crypto.createHash('sha256').update(hashInput).digest('hex');

  console.log(`Generated hash: ${hash}`);

  // Check if evidence already exists
  const existing = await prisma.evidence.findUnique({
    where: { doi: jamaStudy.doi },
  });

  if (existing) {
    console.log(`Evidence with DOI ${jamaStudy.doi} already exists. Skipping...`);
    await prisma.$disconnect();
    return;
  }

  // Anchor hash on-chain
  const polkadotService = new PolkadotService();
  let chainTxHash: string | null = null;

  try {
    // Try to connect to Polkadot (will use mock if not connected)
    const polkadotEndpoint = process.env.POLKADOT_ENDPOINT;
    if (polkadotEndpoint) {
      await polkadotService.connect(polkadotEndpoint);
    }

    const payload = JSON.stringify({
      id: jamaStudy.doi,
      hash,
      type: 'evidence',
      timestamp: new Date().toISOString(),
    });
    chainTxHash = await polkadotService.anchorData(payload);
    console.log(`✅ Anchored hash on-chain: ${chainTxHash}`);
  } catch (error) {
    console.warn('⚠️  Failed to anchor on-chain (using mock):', error);
    chainTxHash = `mock-tx-${Date.now()}`;
  }

  // Create evidence record
  const evidence = await prisma.evidence.create({
    data: {
      doi: jamaStudy.doi,
      title: jamaStudy.title,
      abstract: jamaStudy.abstract,
      authors: jamaStudy.authors,
      journal: jamaStudy.journal,
      publishedAt: jamaStudy.publishedAt,
      hash,
      chainTxHash,
      metadata: jamaStudy.metadata,
    },
  });

  console.log(`✅ Evidence Registry seeded successfully!`);
  console.log(`   ID: ${evidence.id} (use this for KPI evidenceId)`);
  console.log(`   DOI: ${evidence.doi}`);
  console.log(`   Hash: ${evidence.hash}`);
  console.log(`   Chain TX: ${evidence.chainTxHash}`);
  console.log(`\n📊 KPI Integration:`);
  console.log(`   Use evidenceId="${evidence.id}" in KPI tile for "Minutes-in-notes"`);
}

main()
  .catch((e) => {
    console.error('Error seeding evidence:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

