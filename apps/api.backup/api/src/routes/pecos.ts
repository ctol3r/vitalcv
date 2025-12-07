import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import ics from 'ics';
import fetch from 'node-fetch';

const prisma = new PrismaClient();
export const pecosRouter = Router();

// Get PECOS calendar as ICS
pecosRouter.get('/api/pecos/calendar.ics', async (req, res) => {
  try {
    const revalidations = await prisma.pecosRevalidation.findMany({
      where: { completed: false },
      orderBy: { dueDate: 'asc' },
      take: 50,
    });

    const events: any[] = revalidations.map((r) => {
      const due = r.dueDate;
      return {
        title: `PECOS Revalidation (${r.cycle}) - NPI ${r.npi}`,
        start: [due.getFullYear(), due.getMonth() + 1, due.getDate(), 9, 0],
        duration: { hours: 1 },
        description: `PECOS ${r.cycle} revalidation due for NPI ${r.npi}`,
      };
    });

    ics.createEvents(events as ics.EventAttributes[], (err, value) => {
      if (err) {
        return res.status(500).json({ ok: false, error: err.message });
      }
      res.setHeader('Content-Type', 'text/calendar');
      res.setHeader('Content-Disposition', 'attachment; filename=pecos.ics');
      res.send(value);
    });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Send Slack alerts for due revalidations
pecosRouter.post('/api/pecos/send-alerts', async (req, res) => {
  try {
    const now = new Date();
    const revalidations = await prisma.pecosRevalidation.findMany({
      where: { completed: false },
    });

    const alerts: any[] = [];
    const alertLevels = [90, 60, 30, 7];

    for (const r of revalidations) {
      const daysUntilDue = Math.ceil(
        (r.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      for (const days of alertLevels) {
        const label = `D-${days}`;
        if (
          daysUntilDue <= days &&
          daysUntilDue > days - 1 &&
          !r.slackAlerts.includes(label)
        ) {
          alerts.push({ npi: r.npi, cycle: r.cycle, daysUntilDue, label });

          // Mark alert as sent
          await prisma.pecosRevalidation.update({
            where: { id: r.id },
            data: {
              slackAlerts: [...r.slackAlerts, label],
            },
          });

          // Send to Slack if webhook configured
          if (process.env.SLACK_WEBHOOK) {
            const message = `⚠️ PECOS Revalidation Alert (${label})\nNPI: ${r.npi}\nCycle: ${r.cycle}\nDue: ${r.dueDate.toISOString().split('T')[0]}\nDays remaining: ${daysUntilDue}`;

            await fetch(process.env.SLACK_WEBHOOK, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ text: message }),
            });
          }
        }
      }
    }

    res.json({ ok: true, alerts, sent: alerts.length });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Create PECOS revalidation record
pecosRouter.post('/api/pecos/revalidation', async (req, res) => {
  try {
    const { npi, cycle, dueDate } = req.body;
    const record = await prisma.pecosRevalidation.create({
      data: {
        npi,
        cycle,
        dueDate: new Date(dueDate),
      },
    });
    res.json({ ok: true, record });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Mark revalidation as completed
pecosRouter.post('/api/pecos/complete/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const record = await prisma.pecosRevalidation.update({
      where: { id },
      data: {
        completed: true,
        completedAt: new Date(),
      },
    });
    res.json({ ok: true, record });
  } catch (err: any) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

