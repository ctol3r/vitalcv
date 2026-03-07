export const TEST_PRIVATE_KEY_PEM = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgdKc5Lx849hqs9jN/
qufyuqL2OBVwPInslbWVQSIr0KahRANCAATpNED4w6g/mmYGXFh1Vj5b+XWVdrDO
tohWDcn/+1+NV+eK/UEGaNVFi731P6XSSn7NAHL5FHnrxaaJLD6esJVQ
-----END PRIVATE KEY-----`;

export const TEST_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE6TRA+MOoP5pmBlxYdVY+W/l1lXaw
zraIVg3J//tfjVfniv1BBmjVRYu99T+l0kp+zQBy+RR568WmiSw+nrCVUA==
-----END PUBLIC KEY-----`;

export const TEST_ORG_ID = '00000000-0000-0000-0000-000000000124';

export interface IssuerFixture {
  issuerId: string;
  issuerName: string;
  publicKey: string;
  privateKey: string;
  organizationId: string;
}

function normalizeSuffix(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function createIssuerFixture(suffix = String(Date.now())): IssuerFixture {
  const normalizedSuffix = normalizeSuffix(suffix);

  return {
    issuerId: `did:vitalcv:issuer:wave124-${normalizedSuffix}`,
    issuerName: `Wave 124 Issuer ${normalizedSuffix}`,
    publicKey: TEST_PUBLIC_KEY_PEM,
    privateKey: TEST_PRIVATE_KEY_PEM,
    organizationId: TEST_ORG_ID,
  };
}
