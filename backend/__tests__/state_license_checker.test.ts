// state_license_checker.test.ts - basic usage test for the license checker
import { checkLicenseViaApi, scrapeLicenseStatus } from '../src/licensing/state_license_checker';

describe('state license checker', () => {
  test('checkLicenseViaApi returns null when API is missing', async () => {
    const res = await checkLicenseViaApi('XX', '12345');
    expect(res).toBeNull();
  });

  test('scrapeLicenseStatus parses HTML snippets', async () => {
    const html = `<div id='status'>Active</div><span id='exp'>2025-12-31</span>`;
    const server = require('http').createServer((_, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    }).listen(0);
    const port = (server.address() as any).port;
    const url = `http://localhost:${port}`;
    const data = await scrapeLicenseStatus(url, { status: '#status', expiration: '#exp' });
    expect(data.status).toBe('Active');
    expect(data.expirationDate).toBe('2025-12-31');
    server.close();
  });
});

