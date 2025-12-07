import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * NLC 60-Day Residency Enforcement
 * When nurse home state changes between NLC states, require new multistate license within 60 days
 */

export interface ResidencyMove {
  npi: string;
  fromState: string;
  toState: string;
  moveDate: Date;
}

export async function recordResidencyMove(move: ResidencyMove) {
  const breachDate = new Date(move.moveDate);
  breachDate.setDate(breachDate.getDate() + 60);

  const record = await prisma.nlcResidencyMove.create({
    data: {
      npi: move.npi,
      fromState: move.fromState,
      toState: move.toState,
      moveDate: move.moveDate,
      breachDate,
      status: 'pending',
    },
  });

  return record;
}

export async function checkBreachStatus(npi: string) {
  const now = new Date();
  const moves = await prisma.nlcResidencyMove.findMany({
    where: {
      npi,
      status: 'pending',
      breachDate: { lte: now },
    },
  });

  // Update breached moves
  for (const move of moves) {
    await prisma.nlcResidencyMove.update({
      where: { id: move.id },
      data: { status: 'breached' },
    });
  }

  return moves.length > 0;
}

export async function satisfyMove(npi: string, newLicenseNpi: string) {
  await prisma.nlcResidencyMove.updateMany({
    where: {
      npi,
      status: 'pending',
    },
    data: {
      status: 'satisfied',
      newLicenseNpi,
    },
  });
}

export async function getAlertsDue() {
  const now = new Date();
  const moves = await prisma.nlcResidencyMove.findMany({
    where: {
      status: 'pending',
    },
  });

  const alerts: Array<{ move: any; alertType: string }> = [];

  for (const move of moves) {
    const daysUntilBreach = Math.ceil(
      (move.breachDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    const alertLevels = [
      { days: 30, label: 'D-30' },
      { days: 14, label: 'D-14' },
      { days: 7, label: 'D-7' },
      { days: 0, label: 'D-0' },
    ];

    for (const level of alertLevels) {
      if (
        daysUntilBreach <= level.days &&
        !move.alertsSent.includes(level.label)
      ) {
        alerts.push({ move, alertType: level.label });
        // Mark alert as sent
        await prisma.nlcResidencyMove.update({
          where: { id: move.id },
          data: {
            alertsSent: [...move.alertsSent, level.label],
          },
        });
      }
    }
  }

  return alerts;
}

export async function authorizeRemoteStatePractice(
  npi: string,
  patientState: string
) {
  const breached = await checkBreachStatus(npi);
  if (breached) {
    return {
      authorized: false,
      reason: 'NLC residency move breach: 60-day window expired',
    };
  }
  return { authorized: true };
}

