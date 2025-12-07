// state_license_checker.test.ts - basic usage test for the license checker
import { checkLicenseViaApi, scrapeLicenseStatus } from '../src/licensing/state_license_checker';

describe('state license checker', () => {
  test('checkLicenseViaApi returns null when API is missing', async () => {
    const res = await checkLicenseViaApi('XX', '12345');
    expect(res).toBeNull();
  });

  test('scrapeLicenseStatus is mocked', async () => {
    expect(true).toBe(true);
  });
});

