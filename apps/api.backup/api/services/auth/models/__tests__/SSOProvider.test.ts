import { PrismaClient, OrgMembershipRole } from '@prisma/client';
import {
  createSsoProvider,
  deleteSsoProvider,
  getSsoClientSecret,
  getSsoProviderByOrg,
  listSsoProviders,
  updateSsoProvider,
} from '../SSOProvider';

const prisma = new PrismaClient();
const orgId = `org-sso-${Date.now()}`;

describe('SSOProvider model', () => {
  beforeAll(async () => {
    await prisma.orgProfile.create({
      data: {
        orgId,
        name: 'SSO Demo Org',
        contactEmail: 'admin@example.com',
      },
    });
  });

  afterAll(async () => {
    await prisma.ssoProvider.deleteMany({ where: { orgId } });
    await prisma.orgProfile.delete({ where: { orgId } });
    await prisma.$disconnect();
  });

  it('creates provider and stores secret via vault client fallback', async () => {
    const provider = await createSsoProvider({
      orgId,
      issuer: 'https://login.example.com',
      clientId: 'client-123',
      clientSecret: 'super-secret',
      redirectUri: 'https://app.example.com/auth/callback',
      domainWhitelist: ['Example.com', 'Sub.Example.com '],
      autoProvisionRole: OrgMembershipRole.REVIEWER,
    });

    expect(provider.clientSecretKey).toContain(`auth/sso/providers/${orgId}`);
    expect(provider.domainWhitelist).toEqual(['example.com', 'sub.example.com']);

    const storedSecret = await getSsoClientSecret(provider);
    expect(storedSecret).toBe('super-secret');
  });

  it('updates provider metadata and rotates secret when provided', async () => {
    const provider = await getSsoProviderByOrg(orgId);
    expect(provider).toBeTruthy();
    const updated = await updateSsoProvider(provider!.id, {
      redirectUri: 'https://app.example.com/new-callback',
      clientSecret: 'rotated-secret',
      autoProvisionRole: OrgMembershipRole.ADMIN,
    });

    expect(updated.redirectUri).toBe('https://app.example.com/new-callback');
    expect(updated.autoProvisionRole).toBe(OrgMembershipRole.ADMIN);
    const storedSecret = await getSsoClientSecret(updated);
    expect(storedSecret).toBe('rotated-secret');
  });

  it('lists and deletes providers', async () => {
    const providers = await listSsoProviders(orgId);
    expect(providers.length).toBeGreaterThan(0);

    await deleteSsoProvider(providers[0].id);
    const afterDelete = await getSsoProviderByOrg(orgId);
    expect(afterDelete).toBeNull();
  });
});
