import { PrismaClient } from '@prisma/client';
import { NCQAEngine } from './ncqaEngine';
import { NpdbOigService } from '../privileging/npdbIntegration';

const prisma = new PrismaClient();

export class NCQARunner {
  /**
   * Run NCQA compliance checks for a specific credential
   */
  static async runForCredential(credentialId: string) {
    const credential = await prisma.credential.findUnique({
      where: { id: credentialId },
      include: {
        user: true, // Need user to get DID
      },
    });

    if (!credential) {
      throw new Error(`Credential not found: ${credentialId}`);
    }

    // Determine Sanctions Check Date
    let lastSanctionsCheck: Date | undefined;
    const user = credential.user;

    // Sanctions are checked against the user (clinician), not just the credential
    if (user && user.did) {
      try {
        const sanctionsStatus = await NpdbOigService.getLatestStatus(user.did);
        if (sanctionsStatus) {
          const checks: Date[] = [];
          if (sanctionsStatus.npdb?.checkDate) checks.push(new Date(sanctionsStatus.npdb.checkDate));
          if (sanctionsStatus.oig?.checkDate) checks.push(new Date(sanctionsStatus.oig.checkDate));

          if (checks.length > 0) {
            // We want the oldest of the latest checks.
            // If NPDB was checked yesterday but OIG 40 days ago, the set is not fully fresh.
            lastSanctionsCheck = new Date(Math.min(...checks.map((d) => d.getTime())));
          }
        }
      } catch (error) {
        console.error('Error fetching sanctions status:', error);
        // Continue without sanctions date -> will fail CR2
      }
    }

    // Run Engine
    const results = NCQAEngine.evaluateAll(credential, lastSanctionsCheck);

    // Save Records
    // We map the loop to create promises
    const recordPromises = results.map((res) =>
      // @ts-ignore - NCQARecord model added but client might not be regenerated yet
      prisma.nCQARecord.create({
        data: {
          credentialId: credential.id,
          ruleName: res.ruleName,
          status: res.status,
          detail: res.detail,
        },
      })
    );

    const savedRecords = await Promise.all(recordPromises);
    return savedRecords;
  }
}














