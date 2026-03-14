import '@prisma/client';

declare module '@prisma/client' {
  namespace Prisma {
    type MiddlewareParams = {
      model?: string;
      action: string;
      args?: unknown;
      dataPath: string[];
      runInTransaction: boolean;
    };

    type Middleware = (
      params: MiddlewareParams,
      next: (params: MiddlewareParams) => Promise<unknown>,
    ) => Promise<unknown>;
  }

  interface PrismaClient {
    $use(middleware: Prisma.Middleware): void;
  }
}
