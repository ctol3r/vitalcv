import * as cron from 'node-cron';
import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import { graphCascader } from '../intelligence/graphCascader';
import { auditAnchor } from './auditAnchor';

export class Watcher {
  private cronJob: cron.ScheduledTask | null = null;

  start() {
    // Run weekly at midnight on Sunday
    this.cronJob = cron.schedule('0 0 * * 0', async () => {
      log('info', '[Watcher] Initiating continuous monitoring cycle...');
      await this.pollExclusionLists();
    });
    log('info', '[Watcher] Continuous monitoring daemon started on schedule: 0 0 * * 0');
  }

  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      log('info', '[Watcher] Continuous monitoring daemon stopped.');
    }
  }

  /**
   * Polls OIG/SAM stubs for active clinician NPIs
   */
  async pollExclusionLists() {
    try {
      // Find active clinicians to monitor.
      const providers = await prisma.provider.findMany({
        take: 1000, // Batch limit for scaling
      });

      log('info', `[Watcher] Polling exclusions for ${providers.length} clinicians...`);

      for (const provider of providers) {
        const { npi } = provider;

        // 1. Mock OIG Stub Call
        const oigResult = await this.checkOigStub(npi);
        if (oigResult.excluded) {
          await this.handleRevocation(npi, 'OIG', oigResult.rawResponse);
          continue; // Move to next provider
        }

        // 2. Mock SAM.gov Stub Call
        const samResult = await this.checkSamStub(npi);
        if (samResult.excluded) {
          await this.handleRevocation(npi, 'SAM.gov', samResult.rawResponse);
        }
      }

      log('info', '[Watcher] Continuous monitoring cycle complete.');
    } catch (error) {
      log('error', '[Watcher] Error during continuous monitoring cycle', { error });
    }
  }

  private async handleRevocation(npi: string, source: string, rawResponse: any) {
    log('warn', `[Watcher] Exclusion detected for NPI: ${npi} in ${source}`);

    // 1. Audit Anchor - Immutable Proof
    const reason = rawResponse?.reason || 'Exclusion list match';
    await auditAnchor.logRevocation(npi, source, rawResponse, reason);

    // 2. Graph Cascader - Instant Revocation of Edges
    await graphCascader.revokeClinician(npi, source);
  }

  // --- MOCK STUBS ---

  private async checkOigStub(npi: string): Promise<{ excluded: boolean; rawResponse: any }> {
    // In a real system, this would make an exact HTTP request to the OIG LEIE API
    // We mock a tiny chance of exclusion for testing
    const isExcluded = npi.endsWith('9999'); // Deterministic mock
    return {
      excluded: isExcluded,
      rawResponse: isExcluded ? {
        match: true,
        npi,
        exclusionDate: new Date().toISOString(),
        reason: 'OIG LEIE Violation',
        database: 'OIG'
      } : { match: false, npi }
    };
  }

  private async checkSamStub(npi: string): Promise<{ excluded: boolean; rawResponse: any }> {
    // Mock SAM.gov exclusion
    const isExcluded = npi.endsWith('8888');
    return {
      excluded: isExcluded,
      rawResponse: isExcluded ? {
        match: true,
        npi,
        exclusionDate: new Date().toISOString(),
        reason: 'SAM.gov Debarment',
        database: 'SAM'
      } : { match: false, npi }
    };
  }
}

export const watcher = new Watcher();
