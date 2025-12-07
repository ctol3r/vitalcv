import { upsertMcp } from '../src/agent/store';

async function main() {
  console.log('Seeding domain packs...');

  // Physician domain pack
  await upsertMcp({
    name: 'verify_physician_license_us',
    description: 'US physician license verify via OCR+state board',
    inputs: [
      { name: 'licensePdfId', type: 'string', required: true },
      { name: 'state', type: 'string', required: true }
    ],
    outputs: [
      { name: 'verificationStatus', type: 'boolean' }
    ],
    steps: [
      { tool: 'ocr', params: { fileId: '{{licensePdfId}}' } },
      { tool: 'verifyLicense', params: { state: '{{state}}' } }
    ],
    scope: 'domain:physician',
    tags: ['verification', 'physician']
  });

  console.log('✓ Physician domain pack seeded');

  // Nursing domain pack
  await upsertMcp({
    name: 'verify_nursing_license_us',
    description: 'US nursing license verify',
    inputs: [
      { name: 'licensePdfId', type: 'string', required: true },
      { name: 'state', type: 'string', required: true }
    ],
    outputs: [
      { name: 'verificationStatus', type: 'boolean' }
    ],
    steps: [
      { tool: 'ocr', params: { fileId: '{{licensePdfId}}' } },
      { tool: 'verifyLicense', params: { state: '{{state}}' } }
    ],
    scope: 'domain:nursing',
    tags: ['verification', 'nursing']
  });

  console.log('✓ Nursing domain pack seeded');
}

main()
  .then(() => {
    console.log('\n✓ All domain packs seeded');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error seeding domain packs:', err);
    process.exit(1);
  });

