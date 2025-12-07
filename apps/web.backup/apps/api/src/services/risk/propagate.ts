import { PrismaClient } from '@prisma/client';
import { RiskGraphBuilder } from './graph';

const prisma = new PrismaClient();
const builder = new RiskGraphBuilder(prisma);

export interface PropagateRiskInput {
  clinicianId: string;
  signal: string;
  severity: number;
}

export async function propagateRiskSignal(input: PropagateRiskInput) {
  const baseGraph = await builder.generate(input.clinicianId, { anchor: false });
  const emergingEdges = baseGraph.edges.filter((edge) => edge.fromSignal === input.signal);
  if (!emergingEdges.length) {
    return builder.generate(input.clinicianId, { anchor: true });
  }

  const updates = emergingEdges.map((edge) => ({
    signal: edge.toSignal,
    severity: Number(Math.min(1, input.severity * edge.weight).toFixed(4)),
    weight: edge.weight,
  }));

  await prisma.$transaction(
    updates.map((update) =>
      prisma.riskEvent.create({
        data: {
          clinicianId: input.clinicianId,
          type: `propagation:${update.signal}`,
          severity: update.severity,
          metadata: {
            propagatedFrom: input.signal,
            weight: update.weight,
          },
        },
      }),
    ),
  );

  const activeEdges = new Set(
    emergingEdges.map((edge) => `${edge.fromSignal}->${edge.toSignal}`),
  );

  const snapshot = await builder.generate(input.clinicianId, {
    anchor: true,
    focusSignal: input.signal,
    activeEdges,
  });

  return {
    ...snapshot,
    propagation: {
      source: input.signal,
      severity: input.severity,
      updates,
    },
  };
}










