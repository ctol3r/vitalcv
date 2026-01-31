import { runPsvDemo } from '../apps/web/lib/psv-integrations';

const args = process.argv.slice(2);
const npiFlagIndex = args.findIndex((arg) => arg === '--npi');
const npiValue =
  npiFlagIndex >= 0
    ? args[npiFlagIndex + 1]
    : args.find((arg) => arg.startsWith('--npi='))?.split('=')[1];

if (!npiValue) {
  console.error('Usage: pnpm psv:demo --npi <10-digit-npi>');
  process.exit(1);
}

if (!/^\d{10}$/.test(npiValue)) {
  console.error('PSV demo requires a 10-digit NPI.');
  process.exit(1);
}

const report = runPsvDemo(npiValue);
console.log(JSON.stringify(report, null, 2));
