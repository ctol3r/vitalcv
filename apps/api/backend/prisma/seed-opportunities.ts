/**
 * seed-opportunities.ts — Wave 228
 * Seeds realistic opportunities across specialties/states.
 * Run: pnpm --filter @vitalcv/api exec ts-node -P backend/tsconfig.seed.json backend/prisma/seed-opportunities.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ORGS = [
  { name: 'Bay Area Cardiac Group',       slug: 'bay-area-cardiac-group',       facilityType: 'practice',       specialties: ['Cardiology'],        states: ['CA'] },
  { name: 'MindBridge Health',            slug: 'mindbridge-health',             facilityType: 'telehealth',      specialties: ['Psychiatry'],         states: ['CA','TX','FL'] },
  { name: 'Sacramento Medical Center',    slug: 'sacramento-medical-center',     facilityType: 'hospital',        specialties: ['Critical Care','Internal Medicine'], states: ['CA'] },
  { name: 'Northwest Locums Alliance',    slug: 'northwest-locums-alliance',     facilityType: 'staffing_agency', specialties: ['Family Medicine'],     states: ['WA','OR'] },
  { name: 'Kaiser Permanente NorCal',     slug: 'kaiser-permanente-norcal',      facilityType: 'health_system',   specialties: ['Internal Medicine','Pediatrics'], states: ['CA'] },
  { name: 'Austin Regional Clinic',       slug: 'austin-regional-clinic',        facilityType: 'practice',        specialties: ['Internal Medicine'],   states: ['TX'] },
  { name: 'Miami Telehealth Group',       slug: 'miami-telehealth-group',        facilityType: 'telehealth',      specialties: ['Emergency Medicine'],  states: ['FL'] },
  { name: 'Chicago Pediatric Alliance',   slug: 'chicago-pediatric-alliance',    facilityType: 'practice',        specialties: ['Pediatrics'],          states: ['IL'] },
  { name: 'NorthShore Radiology',         slug: 'northshore-radiology',          facilityType: 'practice',        specialties: ['Radiology'],           states: ['IL'] },
  { name: 'Seattle General Health',       slug: 'seattle-general-health',        facilityType: 'hospital',        specialties: ['OB/GYN','Surgery'],    states: ['WA'] },
  { name: 'NYC Health + Hospitals',       slug: 'nyc-health-hospitals',          facilityType: 'health_system',   specialties: ['Surgery','Neurology'], states: ['NY'] },
  { name: 'Denver Ortho Group',           slug: 'denver-ortho-group',            facilityType: 'practice',        specialties: ['Orthopedics'],         states: ['CO'] },
] as const;

const SEED_OPPS = [
  { org: 'bay-area-cardiac-group',     title: 'Locums Interventional Cardiologist', specialty: 'Cardiology',        type: 'locums',    state: 'CA', pay: '$310–$380/hr',   level: 'L3', remote: false },
  { org: 'bay-area-cardiac-group',     title: 'Perm Electrophysiologist',            specialty: 'Cardiology',        type: 'perm',      state: 'CA', pay: '$420K–$500K',   level: 'L3', remote: false },
  { org: 'mindbridge-health',          title: 'Telehealth Psychiatrist — CA',        specialty: 'Psychiatry',        type: 'telehealth', state: 'CA', pay: '$200–$270/hr', level: 'L2', remote: true },
  { org: 'mindbridge-health',          title: 'Telepsychiatry — TX & FL',            specialty: 'Psychiatry',        type: 'telehealth', state: 'TX', pay: '$200–$270/hr', level: 'L2', remote: true },
  { org: 'sacramento-medical-center',  title: 'ICU / Critical Care NP',             specialty: 'Critical Care',     type: 'locums',    state: 'CA', pay: '$120–$145/hr',   level: 'L3', remote: false },
  { org: 'northwest-locums-alliance',  title: 'Family Medicine — Rural WA',          specialty: 'Family Medicine',   type: 'locums',    state: 'WA', pay: '$180–$220/hr',   level: 'L2', remote: false },
  { org: 'kaiser-permanente-norcal',   title: 'Staff Internist — Perm',             specialty: 'Internal Medicine', type: 'perm',      state: 'CA', pay: null,             level: 'L3', remote: false },
  { org: 'austin-regional-clinic',     title: 'Staff Hospitalist',                  specialty: 'Internal Medicine', type: 'perm',      state: 'TX', pay: '$280K–$320K',    level: 'L2', remote: false },
  { org: 'miami-telehealth-group',     title: 'Remote Urgent Care Physician',       specialty: 'Emergency Medicine', type: 'telehealth', state: 'FL', pay: '$150–$190/hr', level: 'L1', remote: true },
  { org: 'chicago-pediatric-alliance', title: 'Locums Pediatrician',               specialty: 'Pediatrics',        type: 'locums',    state: 'IL', pay: '$140–$170/hr',   level: 'L2', remote: false },
  { org: 'northshore-radiology',       title: 'Interventional Radiologist',         specialty: 'Radiology',         type: 'perm',      state: 'IL', pay: '$550K–$650K',    level: 'L3', remote: false },
  { org: 'seattle-general-health',     title: 'OB/GYN Hospitalist — Nights',       specialty: 'OB/GYN',           type: 'locums',    state: 'WA', pay: '$220–$260/hr',   level: 'L3', remote: false },
  { org: 'nyc-health-hospitals',       title: 'Trauma Surgeon — Level I Center',    specialty: 'Surgery',           type: 'perm',      state: 'NY', pay: '$400K–$480K',    level: 'L3', remote: false },
  { org: 'nyc-health-hospitals',       title: 'Stroke Neurologist',                specialty: 'Neurology',         type: 'perm',      state: 'NY', pay: '$350K–$420K',    level: 'L3', remote: false },
  { org: 'denver-ortho-group',         title: 'Orthopedic Surgeon — Spine',         specialty: 'Orthopedics',       type: 'perm',      state: 'CO', pay: '$600K–$750K',    level: 'L3', remote: false },
  { org: 'kaiser-permanente-norcal',   title: 'Locums Pediatrician — Summer Cover', specialty: 'Pediatrics',        type: 'locums',    state: 'CA', pay: '$130–$155/hr',   level: 'L2', remote: false },
  { org: 'northwest-locums-alliance',  title: 'Locums EM Physician — OR Coast',     specialty: 'Emergency Medicine', type: 'locums',   state: 'OR', pay: '$250–$290/hr',   level: 'L2', remote: false },
  { org: 'sacramento-medical-center',  title: 'Staff Internist — Nocturnist',       specialty: 'Internal Medicine', type: 'perm',      state: 'CA', pay: '$290K–$340K',    level: 'L2', remote: false },
] as const;

async function main() {
  console.log('Seeding organizations and opportunities…');

  for (const org of ORGS) {
    const slug = `${org.slug}-seed`;
    const existing = await prisma.organization.findUnique({ where: { slug } });
    if (existing) {
      console.log(`  skip org: ${org.name}`);
      continue;
    }

    await prisma.organization.create({
      data: {
        name: org.name,
        slug,
        organizationProfile: {
          create: {
            facilityType: org.facilityType,
            specialties: [...org.specialties],
            statesCovered: [...org.states],
            hiringTypes: ['locums', 'perm', 'telehealth'],
            hiringStatus: 'ACTIVELY_HIRING',
            openRoles: 2,
          },
        },
      },
    });
    console.log(`  created org: ${org.name}`);
  }

  // Seed opportunities
  let seeded = 0;
  for (const opp of SEED_OPPS) {
    const orgSlug = `${opp.org}-seed`;
    const org = await prisma.organization.findUnique({ where: { slug: orgSlug } });
    if (!org) { console.log(`  skip opp (no org): ${opp.title}`); continue; }

    const existing = await prisma.opportunity.findFirst({
      where: { organizationId: org.id, title: opp.title },
    });
    if (existing) { console.log(`  skip opp (exists): ${opp.title}`); continue; }

    await prisma.opportunity.create({
      data: {
        organizationId: org.id,
        title: opp.title,
        specialty: opp.specialty,
        hiringType: opp.type,
        state: opp.state,
        payRange: opp.pay ?? null,
        requirementLevel: opp.level,
        remote: opp.remote,
        status: 'ACTIVE',
      },
    });
    seeded++;
    console.log(`  seeded: ${opp.title}`);
  }

  console.log(`Done. Seeded ${seeded} opportunities.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
