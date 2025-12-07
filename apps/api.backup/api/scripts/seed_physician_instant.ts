import { upsertMcp } from '../src/agent/store';
import { pinStable } from '../src/agent/versioning';

async function main() {
  const name = 'physician_instant_verify';
  
  await upsertMcp({
    name,
    description: 'One-click verify for US physicians (OCR→state board)',
    inputs: [
      { name: 'state', type: 'string', required: true },
      { name: 'licensePdfId', type: 'string', required: true }
    ],
    outputs: [
      { name: 'verificationStatus', type: 'boolean' },
      { name: 'licenseData', type: 'json' }
    ],
    steps: [
      { tool: 'ocr', params: { fileId: '{{licensePdfId}}' } },
      { tool: 'verifyLicense', params: { state: '{{state}}' } }
    ],
    scope: 'domain:physician',
    tags: ['verification', 'instant', 'stable']
  });
  
  await pinStable(name, 'stable');
}

main().then(() => process.exit(0));

