import { PrismaClient } from '@prisma/client';
import { physicianLifecycleOrchestrator } from '../orchestrators/physician-lifecycle.orchestrator';
import { auditLog } from '../controllers/audit';
import { BlockchainIntegration } from '../blockchain/blockchain_integration';
import DataLoader from 'dataloader';

// Initialize services
const blockchainService = new BlockchainIntegration();

type Context = {
  prisma: PrismaClient;
};

// DataLoaders
const userLoader = new DataLoader(async (ids: readonly string[]) => {
  // @ts-ignore
  const users = await prisma.user.findMany({
    where: { id: { in: ids as string[] } },
  });
  const userMap = new Map(users.map((u: any) => [u.id, u]));
  return ids.map((id) => userMap.get(id));
});

const orgLoader = new DataLoader(async (ids: readonly string[]) => {
  // @ts-ignore
  const orgs = await prisma.organization.findMany({
    where: { id: { in: ids as string[] } },
  });
  const orgMap = new Map(orgs.map((o: any) => [o.id, o]));
  return ids.map((id) => orgMap.get(id));
});

export const resolvers = {
  Query: {
    credential: async (_parent: unknown, args: { id: string }, context: Context) => {
      // @ts-ignore
      return context.prisma.credential.findUnique({ where: { id: args.id } });
    },
    credentialsByUser: async (_parent: unknown, args: { userId: string }, context: Context) => {
      // @ts-ignore
      return context.prisma.credential.findMany({ where: { userId: args.userId } });
    },
    lifecycle: async (_parent: unknown, args: { credentialId: string }, context: Context) => {
      // Get lifecycle data from orchestrator
      // Assuming credentialId maps to physicianId or we can look it up
      // For this example, we'll assume the credential has a holder/user ID we can use,
      // but here we only have credentialId. We might need to fetch the credential first.

      // @ts-ignore
      const credential = await context.prisma.credential.findUnique({ where: { id: args.credentialId } });
      if (!credential || !credential.userId) return null;

      // This is a simplification. The orchestrator takes physicianId (userId).
      const progress = await physicianLifecycleOrchestrator.getProgress(credential.userId);

      return {
        credentialId: args.credentialId,
        stage: progress.currentStage || 'completed',
        aggregatedStatus: progress.blockers ? 'blocked' : (progress.completed === progress.total ? 'completed' : 'in_progress'),
        history: [] // Populate with actual history if available
      };
    },
    org: async (_parent: unknown, args: { id: string }, context: Context) => {
      return orgLoader.load(args.id);
    },
    user: async (_parent: unknown, args: { id: string }, context: Context) => {
      return userLoader.load(args.id);
    },
  },
  Mutation: {
    verifyCredential: async (_parent: unknown, args: { id: string }, context: Context) => {
       // @ts-ignore
      const credential = await context.prisma.credential.findUnique({ where: { id: args.id } });
      if (!credential) {
        throw new Error('Credential not found');
      }

      // Audit the verification attempt
      await auditLog(credential.userId || 'system', 'VERIFY_CREDENTIAL_ATTEMPT', { credentialId: args.id });

      // Check on-chain status
      // We assume credential has a hash or ID relevant to blockchain
      const isValid = await blockchainService.validateCredential(args.id); // Placeholder usage

      return {
        success: isValid,
        message: isValid ? 'Credential is valid on-chain' : 'Credential validation failed',
        timestamp: new Date().toISOString()
      };
    }
  },
  Credential: {
    holder: (parent: any, _args: any, context: Context) => {
      if (parent.userId) return userLoader.load(parent.userId);
      return null;
    },
    lifecycle: async (parent: any) => {
       if (parent.userId) {
         const progress = await physicianLifecycleOrchestrator.getProgress(parent.userId);
         return {
            credentialId: parent.id,
            stage: progress.currentStage || 'completed',
            aggregatedStatus: progress.blockers ? 'blocked' : (progress.completed === progress.total ? 'completed' : 'in_progress'),
            history: []
         };
       }
       return null;
    }
  },
  User: {
    organization: (parent: any, _args: any, context: Context) => {
      if (parent.organizationId) return orgLoader.load(parent.organizationId);
      return null;
    },
    credentials: (parent: any, _args: any, context: Context) => {
      // @ts-ignore
      return context.prisma.credential.findMany({ where: { userId: parent.id } });
    }
  },
  Organization: {
    users: (parent: any, _args: any, context: Context) => {
      // @ts-ignore
      return context.prisma.user.findMany({ where: { organizationId: parent.id } });
    }
  }
};
