import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Express } from 'express';

export interface SdkTestServer {
  baseUrl: string;
  close(): Promise<void>;
}

export async function startSdkTestServer(
  app: Express,
  organizationId: string,
): Promise<SdkTestServer> {
  const server = http.createServer((req, res) => {
    req.headers['x-org-id'] = organizationId;
    app(req, res);
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    },
  };
}
