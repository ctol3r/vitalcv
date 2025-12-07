import { PrismaClient } from '@prisma/client';
import { AutoTagger } from './autoTagger.js';
import { bus } from './bus.js';
import { ClinicianAgent } from './clinicianAgent.js';
import { IssuerAgent } from './issuerAgent.js';
import { Agent } from './types.js';
import { VerifierAgent } from './verifierAgent.js';

const prisma = new PrismaClient();

const AGENTS: Agent[] = [AutoTagger, ClinicianAgent, VerifierAgent, IssuerAgent];

async function runAgent(agent: Agent, npi: string) {
  const run = await prisma.agentRun.create({
    data: {
      agentName: agent.name,
      npi,
      status: 'running',
      input: { npi },
    },
  });

  try {
    const out = await agent.run({ npi });
    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: 'ok',
        finishedAt: new Date(),
        output: out as any,
      },
    });
  } catch (e: any) {
    await prisma.agentRun.update({
      where: { id: run.id },
      data: {
        status: 'error',
        finishedAt: new Date(),
        error: String(e?.message || e),
      },
    });
  }
}

export function mountOrchestrator() {
  const kick = (npi: string) => {
    for (const a of AGENTS) {
      runAgent(a, npi).catch((err) => {
        console.error(`Agent ${a.name} failed for NPI ${npi}:`, err);
      });
    }
  };

  bus.on('CLAIM_START', (e: any) => kick(e.npi));
  bus.on('CLAIM_VERIFY_PIN', (e: any) => kick(e.npi));
  bus.on('CLAIM_DOC_UPLOAD', (e: any) => kick(e.npi));
  bus.on('ATTEST_REQUESTED', (e: any) => kick(e.npi));
  bus.on('ATTEST_APPROVE', (e: any) => kick(e.npi));
  bus.on('NPLOOKUP_VIEW', (e: any) => kick(e.npi));
}
