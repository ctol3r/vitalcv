import { Request, Response, NextFunction } from 'express';
import { mtlsGate } from '../mtlsGate';

const CA_PEM = `-----BEGIN CERTIFICATE-----
MIIDAzCCAeugAwIBAgIUQVJIOUt6eBfvni7Pg8I7EJmP7jUwDQYJKoZIhvcNAQEL
BQAwETEPMA0GA1UEAwwGT3JnIENBMB4XDTI1MTExNDE1MTQxMloXDTI2MTExNDE1
MTQxMlowETEPMA0GA1UEAwwGT3JnIENBMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A
MIIBCgKCAQEA5KxT73qBbZ6ZWoLowkMaAw7C7qMKuVRGrhKiWwRVCmssa4/5ZPjB
p1C/+S/e06qKT0Lngq4a1oIspSiwdG2NypHuLPbPHS8H8kPkMYy0wQzt5DtbWn10
9GNn03Kxf510KvVwpv2ix/xp9prULooz4TEcxbcTGjMfzglI9cwMNanwrnSKvAIl
K6gEEEOdz2OW9hnrReo+4PmxJh79f0aozjkDRjJxAclugxinKaXM7D1gFNLMzD9l
MI3NFRIZuge431lazmbtuMGatXFizvT0tArKwihepaXuxDzCFD7yEvsZKFOGsnb3
+5n9hK35Jkm7uk9AUZ7S3NgNxx7SL8U0wwIDAQABo1MwUTAdBgNVHQ4EFgQUuOQe
8ObWaAcLZOyLHfm3KLRj05UwHwYDVR0jBBgwFoAUuOQe8ObWaAcLZOyLHfm3KLRj
05UwDwYDVR0TAQH/BAUwAwEB/zANBgkqhkiG9w0BAQsFAAOCAQEAsrtvPe8khhz7
gLcsdPC67PPx7HGin4WaqnNV6Ww2KI/RDj3kRS85fV1bHyta0PM8q86jqr6oT1ws
heOmmQgjMZV7P7lAzrGG/lqoXegRfEVM6joY6qDxKGypj71R7kd1+EsTX9qrRu4v
Qy+6EkD8lDIUC9cFr0krHXiQ50ZznfAFAQvvKlcwprMfQuj9NfDLHwfgGhCWeNKs
c2jSeuZ4Q43N18iAr9z6ZzTttJLXb+Xowe2T81vQDTWnrut7gXXya+HsWDQP0TNw
B5y5mpMzsXEQTnP1xp4RCvaHJQWHgmlDnWbwPV/dm1o8VDL/F5Tc0FMjM9n/zpP5
JBL/OqPxOg==
-----END CERTIFICATE-----`;

const CLIENT_PEM = `-----BEGIN CERTIFICATE-----
MIIC9jCCAd6gAwIBAgIUc3//ElqoqPDYXsfBDJJ4Mk7ZjacwDQYJKoZIhvcNAQEL
BQAwETEPMA0GA1UEAwwGT3JnIENBMB4XDTI1MTExNDE1MTQxMloXDTI2MDIxMjE1
MTQxMlowFTETMBEGA1UEAwwKT3JnIENsaWVudDCCASIwDQYJKoZIhvcNAQEBBQAD
ggEPADCCAQoCggEBAMfa94EBUFoIrZPehmVgM0T/BQ8Hr1hg6+4VXbei8YGMzoJ/
pW4IiLEpAb422L1ANrsxY/EPRvWqzS06p8adE7yHSPffTGui2ks4WAkofelV+7qh
EErz3Z1fwUfD1GUvNliWqW/OYzFHchS04EEj1iOMwknFyR1mQIZSp2nJPBtX9lri
P66EBajFfdixeNCVhmBpLMzX13onHFABAvwixc/QMSxZqx9FLroPco0a3p2iK7Tt
iISDHqq28mmF8j4VkLaFwQ3/zIloBlzWT4itTyrYun5hm7Icc5ZEFNPqQgmCkkel
xod/geGWKq5EVfjZ+WKgR9BzblLyTIeQAftbJY8CAwEAAaNCMEAwHQYDVR0OBBYE
FGif4eA5U6k6kiIWqEmF0zBPzjzHMB8GA1UdIwQYMBaAFLjkHvDm1mgHC2Tsix35
tyi0Y9OVMA0GCSqGSIb3DQEBCwUAA4IBAQB2OTlEJCNzZjNE1Z78+sqD9BWT1g1K
gx2WQOcYFbRsd0z+ESj+YEHMWiBdPW7bb4PLgjC36djouTmfk3poOzt7achs39iJ
I3M8a98SOGjoVnbUMotMx6pr1QZf+wetBKEVu8aVz0K2Y2fJ4LyHmbmzPfLYxgc7
K2KFHyHwLTbI9ZqfN/M2f+Iz+t5mTzddR/mgPlQMbfReoaNunM8kxtDaOYLls92B
iR0rv/HB0PNlpgWASNoqfBbt2G8OuY9dOo6aagkFXbIXbZmcqdgUezsMpta7D+7c
0vxO34+9cvTgcbQ7t7fvASYLNvL2RcKttIC4Sr65dBJpHX1/lVkZYkWD
-----END CERTIFICATE-----`;

describe('mtlsGate middleware', () => {
  const originalEnv = process.env;

  const createResponse = () => {
    const res: Partial<Response> = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res as Response;
  };

  const nextFn = () => jest.fn() as NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.ORG_MTLS_REQUIRED;
    delete process.env.ORG_MTLS_CA_JSON;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('allows requests when org is not marked as mTLS-required', () => {
    const req = {
      path: '/api/anything',
      headers: {},
    } as Partial<Request>;

    const res = createResponse();
    const next = nextFn();

    const middleware = mtlsGate();
    middleware(req as Request, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects when mTLS required but no client certificate provided', () => {
    process.env.ORG_MTLS_REQUIRED = 'org-enterprise';
    process.env.ORG_MTLS_CA_JSON = JSON.stringify({ 'org-enterprise': CA_PEM });

    const req = {
      path: '/api/secure',
      headers: { 'x-org-id': 'org-enterprise' },
    } as Partial<Request>;

    const res = createResponse();
    const next = nextFn();

    const middleware = mtlsGate();
    middleware(req as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects invalid certificates', () => {
    process.env.ORG_MTLS_REQUIRED = 'org-enterprise';
    process.env.ORG_MTLS_CA_JSON = JSON.stringify({ 'org-enterprise': CA_PEM });

    const req = {
      path: '/api/secure',
      headers: {
        'x-org-id': 'org-enterprise',
        'x-client-cert': encodeURIComponent('invalid-cert'),
      },
    } as Partial<Request>;

    const res = createResponse();
    const next = nextFn();

    const middleware = mtlsGate();
    middleware(req as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'invalid_client_certificate' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('allows valid certificates signed by org CA', () => {
    process.env.ORG_MTLS_REQUIRED = 'org-enterprise';
    process.env.ORG_MTLS_CA_JSON = JSON.stringify({ 'org-enterprise': CA_PEM });

    const req = {
      path: '/api/secure',
      headers: {
        'x-org-id': 'org-enterprise',
        'x-client-cert': encodeURIComponent(CLIENT_PEM),
      },
    } as Partial<Request>;

    const res = createResponse();
    const next = nextFn();

    const middleware = mtlsGate();
    middleware(req as Request, res, next);

    expect(next).toHaveBeenCalled();
    expect((req as any).mtlsClient).toBeDefined();
    expect((req as any).mtlsValidated).toBe(true);
  });
});

