import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';

type SbomTarget = {
  name: string;
  dir: string;
  filename: string;
};

const targets: SbomTarget[] = [
  { name: 'backend-api', dir: 'backend', filename: 'backend-api.cdx.json' },
  { name: 'frontend-web', dir: 'apps/web', filename: 'frontend-web.cdx.json' },
];

const outputDir = resolve(process.cwd(), 'artifacts/sbom');
mkdirSync(outputDir, { recursive: true });

function runCycloneDx(target: SbomTarget): string {
  const outputPath = resolve(outputDir, target.filename);
  const args = [
    '--dir',
    target.dir,
    'exec',
    'cyclonedx-npm',
    '--output-format',
    'json',
    '--spec-version',
    '1.5',
    '--include-dev',
    '--output-file',
    outputPath,
  ];

  console.log(`🔐 Generating CycloneDX SBOM for ${target.name} → ${outputPath}`);
  const result = spawnSync('pnpm', args, { stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`CycloneDX generation failed for ${target.name}`);
  }

  return outputPath;
}

const generatedFiles = targets.map(runCycloneDx);

const aggregate = {
  bomFormat: 'CycloneDX',
  specVersion: '1.5',
  serialNumber: `urn:uuid:${randomUUID()}`,
  version: 1,
  metadata: {
    timestamp: new Date().toISOString(),
    tools: [
      {
        vendor: 'CycloneDX',
        name: 'cyclonedx-npm',
        version: 'cli',
      },
    ],
    component: {
      name: 'chai-vc-platform',
      type: 'application',
    },
  },
  components: [] as any[],
};

generatedFiles.forEach((filePath, index) => {
  const target = targets[index];
  const document = JSON.parse(readFileSync(filePath, 'utf8'));
  const components = document.components ?? [];
  components.forEach((component: any) => {
    const existingProps = component.properties ?? [];
    aggregate.components.push({
      ...component,
      properties: [
        ...existingProps,
        { name: 'vitalcv:sbom:source', value: target.name },
      ],
    });
  });
});

const aggregatePath = resolve(outputDir, 'sbom.json');
writeFileSync(aggregatePath, JSON.stringify(aggregate, null, 2));

console.log(`✅ SBOM artifacts written to ${outputDir}`);

