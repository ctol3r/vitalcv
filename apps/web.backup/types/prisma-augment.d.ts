declare module '@prisma/client' {
  /**
   * Light-weight augmentation so TypeScript is aware of the new delegates that
   * are introduced in this batch. The concrete delegate types will be generated
   * after running `prisma generate`, but we still want the compiler to accept
   * these properties inside this workspace before regeneration happens.
   */
  interface PrismaClient {
    credentialFabric: any;
    credentialFabricDiff: any;
    credentialFabricEvent: any;
    trustAnchor: any;
    observabilityGrid: any;
    roleUXConfig: any;
    supplyChainNode: any;
    walletInteropConfig: any;
  }
}

