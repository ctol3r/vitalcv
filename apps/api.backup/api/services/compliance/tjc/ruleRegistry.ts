import { differenceInCalendarDays } from 'date-fns';
import type { TJCRuleEvaluation, TJCSignalSnapshot, TJCStandard } from '../models/TJCComplianceRecord.js';
import { TJCComplianceStatuses, TJCRuleEvaluationSchema } from '../models/TJCComplianceRecord.js';

interface TJCRuleDefinition {
  id: string;
  name: string;
  standard: TJCStandard;
  references: string[];
  signal: keyof TJCSignalSnapshot | 'composite';
  weight?: number;
  evaluate(signals: TJCSignalSnapshot): TJCRuleEvaluation;
}

function baseResult(
  definition: TJCRuleDefinition,
  status: (typeof TJCComplianceStatuses)[number],
  summary: string,
  detail?: string,
  evidence?: Record<string, unknown>,
  remediation?: string
): TJCRuleEvaluation {
  return TJCRuleEvaluationSchema.parse({
    ruleId: definition.id,
    name: definition.name,
    standard: definition.standard,
    status,
    summary,
    detail,
    references: definition.references,
    signal: definition.signal,
    weight: definition.weight ?? 1,
    remediation,
    evidence,
  });
}

function missingSignal(definition: TJCRuleDefinition, signalName: string): TJCRuleEvaluation {
  return baseResult(
    definition,
    'PENDING',
    `Awaiting ${signalName} evidence`,
    `No recent ${signalName} metrics were available for this clinician.`
  );
}

function daysSince(dateIso?: string): number | undefined {
  if (!dateIso) {
    return undefined;
  }
  const parsed = new Date(dateIso);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return differenceInCalendarDays(new Date(), parsed);
}

const RULES: TJCRuleDefinition[] = [
  {
    id: 'fppe.coverage',
    name: 'FPPE coverage',
    standard: 'MS01',
    signal: 'fppe',
    references: ['Policy:MS01.FPPE', 'Playbook:FPPE.InitialPrivileges'],
    evaluate(signals) {
      const fppe = signals.fppe;
      if (!fppe) {
        return missingSignal(this, 'FPPE');
      }
      if ((fppe.overdueCount ?? 0) > 0) {
        return baseResult(
          this,
          'FAIL',
          'FPPE cases overdue',
          `Detected ${fppe.overdueCount} overdue FPPE case(s).`,
          { overdueCount: fppe.overdueCount },
          'Close or restart overdue FPPE cases before granting additional privileges.'
        );
      }
      if ((fppe.completedCount ?? 0) === 0) {
        return baseResult(
          this,
          'WARN',
          'FPPE has not been completed',
          'No completed FPPE cases were found for current privileges.',
          undefined,
          'Complete FPPE for newly granted privileges and upload the evaluation summary.'
        );
      }
      return baseResult(this, 'PASS', 'FPPE completed for current privileges');
    },
  },
  {
    id: 'oppe.cycle',
    name: 'OPPE cadence',
    standard: 'MS03',
    signal: 'oppe',
    references: ['Policy:MS03.OPPE', 'Playbook:OPPE.Monitoring'],
    evaluate(signals) {
      const oppe = signals.oppe;
      if (!oppe) {
        return missingSignal(this, 'OPPE');
      }
      if ((oppe.overdueCases ?? 0) > 0) {
        return baseResult(
          this,
          'FAIL',
          'OPPE cycle overdue',
          `Found ${oppe.overdueCases} OPPE case(s) past due.`,
          { overdueCases: oppe.overdueCases },
          'Assign reviewers to overdue OPPE cases and document findings.'
        );
      }
      const days = daysSince(oppe.lastReviewAt);
      if (days !== undefined && days > 180) {
        return baseResult(
          this,
          'WARN',
          'OPPE review is stale',
          `Last OPPE review occurred ${days} days ago.`,
          { lastReviewDays: days },
          'Schedule OPPE review within 30 days to maintain MS.03 compliance.'
        );
      }
      return baseResult(this, 'PASS', 'OPPE cadence on track');
    },
  },
  {
    id: 'oppe.metrics',
    name: 'OPPE quality metrics',
    standard: 'MS03',
    signal: 'oppe',
    weight: 1.2,
    references: ['Policy:MS03.OPPE.Metrics'],
    evaluate(signals) {
      const oppe = signals.oppe;
      if (!oppe?.metrics) {
        return missingSignal(this, 'OPPE quality');
      }
      const metrics = oppe.metrics;
      const complications = metrics.complications ?? 0;
      const issues = metrics.issuesFlagged ?? 0;
      if (complications >= 2 || issues >= 4) {
        return baseResult(
          this,
          'FAIL',
          'OPPE metrics exceed thresholds',
          'Complications or peer review issues exceeded acceptable thresholds.',
          { complications, issues },
          'Escalate to the quality committee and initiate targeted competency review.'
        );
      }
      if (complications > 0 || issues > 0) {
        return baseResult(
          this,
          'WARN',
          'OPPE metrics require review',
          'Recent OPPE metrics include complications or flagged issues.',
          { complications, issues },
          'Review flagged OPPE cases with the service line leader.'
        );
      }
      return baseResult(this, 'PASS', 'OPPE metrics within tolerance');
    },
  },
  {
    id: 'privilege.prereqs',
    name: 'Privilege prerequisites',
    standard: 'MS05',
    signal: 'composite',
    references: ['Policy:MS05.PrivilegePrereqs'],
    evaluate(signals) {
      const privileges = signals.privileges;
      const licenses = signals.licenses;
      if (!privileges || !licenses) {
        return missingSignal(this, 'privilege + license');
      }
      if ((licenses.expired ?? 0) > 0) {
        return baseResult(
          this,
          'FAIL',
          'Expired license detected',
          `${licenses.expired} license(s) are expired.`,
          { expiredLicenses: licenses.expired },
          'Suspend affected privileges until license renewal is verified.'
        );
      }
      const activePrivileges = privileges.active ?? 0;
      const activeLicenses = licenses.active ?? 0;
      if (activePrivileges > 0 && activeLicenses === 0) {
        return baseResult(
          this,
          'WARN',
          'Active privileges lack verified licenses',
          'No active licenses were mapped to current privileges.',
          { activePrivileges },
          'Verify state licenses for each privileged service line.'
        );
      }
      if (activePrivileges > activeLicenses && activeLicenses > 0) {
        return baseResult(
          this,
          'WARN',
          'Active privileges exceed verified licenses',
          'More active privileges than active licenses were detected.',
          {
            activePrivileges,
            activeLicenses,
          },
          'Confirm license coverage for each privilege set.'
        );
      }
      if ((licenses.expiringSoon ?? 0) > 0 || (privileges.expiringSoon ?? 0) > 0) {
        return baseResult(
          this,
          'WARN',
          'License or privilege expiring soon',
          'At least one license/privilege is within 30 days of expiry.',
          {
            licensesExpiring: licenses.expiringSoon,
            privilegesExpiring: privileges.expiringSoon,
          },
          'Queue renewals before expiration to maintain continuous coverage.'
        );
      }
      return baseResult(this, 'PASS', 'Privilege prerequisites satisfied');
    },
  },
  {
    id: 'psv.freshness',
    name: 'PSV freshness',
    standard: 'MS06',
    signal: 'psv',
    references: ['Policy:MS06.PSV', 'NCQA.CR1'],
    evaluate(signals) {
      const psv = signals.psv;
      if (!psv) {
        return missingSignal(this, 'PSV');
      }
      if (!psv.isFresh) {
        const daysRemaining = psv.daysRemaining ?? -999;
        const status = daysRemaining < 0 ? 'FAIL' : 'WARN';
        return baseResult(
          this,
          status,
          daysRemaining < 0 ? 'PSV expired' : 'PSV expiring soon',
          `Latest PSV result expires in ${daysRemaining} day(s).`,
          {
            checkedAt: psv.checkedAt,
            freshUntil: psv.freshUntil,
            daysRemaining,
          },
          'Trigger PSV re-verification to keep results within 120-day window.'
        );
      }
      const staleness = daysSince(psv.checkedAt);
      if (staleness !== undefined && staleness > 90) {
        return baseResult(
          this,
          'WARN',
          'PSV check approaching freshness limit',
          `Last PSV check was ${staleness} days ago.`,
          { daysSinceCheck: staleness },
          'Schedule PSV re-check to maintain MS.06 compliance.'
        );
      }
      return baseResult(this, 'PASS', 'PSV evidence is fresh');
    },
  },
  {
    id: 'npdb.clean',
    name: 'NPDB monitoring',
    standard: 'MS06',
    signal: 'npdb',
    references: ['Policy:MS06.NPDB', 'NCQA.CR3'],
    evaluate(signals) {
      const npdb = signals.npdb;
      if (!npdb) {
        return missingSignal(this, 'NPDB');
      }
      if ((npdb.status ?? '').toUpperCase() === 'ADVERSE_ACTION') {
        return baseResult(
          this,
          'FAIL',
          'NPDB adverse action detected',
          'An adverse NPDB hit was reported.',
          npdb,
          'Escalate to the medical executive committee and consider privilege hold.'
        );
      }
      const staleness = daysSince(npdb.lastCheckedAt);
      if (staleness !== undefined && staleness > 30) {
        return baseResult(
          this,
          'WARN',
          'NPDB check older than 30 days',
          `Last NPDB query was ${staleness} days ago.`,
          { daysSinceCheck: staleness },
          'Queue NPDB query to maintain monthly monitoring.'
        );
      }
      return baseResult(this, 'PASS', 'NPDB monitoring up to date');
    },
  },
  {
    id: 'sanctions.monitoring',
    name: 'Sanction/OIG monitoring',
    standard: 'MS06',
    signal: 'sanctions',
    references: ['Policy:MS06.Sanctions', 'OIG.LEIE.Monitoring'],
    evaluate(signals) {
      const sanctions = signals.sanctions;
      if (!sanctions) {
        return missingSignal(this, 'sanctions');
      }
      if ((sanctions.adverseActionCount ?? 0) > 0) {
        return baseResult(
          this,
          'FAIL',
          'Sanction list hit detected',
          'An exclusion or sanction record was reported.',
          sanctions,
          'Place privileges on hold until the sanction is adjudicated.'
        );
      }
      const staleness = daysSince(sanctions.lastCheckedAt);
      if (staleness !== undefined && staleness > 30) {
        return baseResult(
          this,
          'WARN',
          'Sanction monitoring stale',
          `Last sanction check was ${staleness} days ago.`,
          { daysSinceCheck: staleness },
          'Run OIG/LEIE checks at least monthly and document the results.'
        );
      }
      return baseResult(this, 'PASS', 'Sanction monitoring current');
    },
  },
  {
    id: 'competency.verification',
    name: 'Competency verification',
    standard: 'MS08',
    signal: 'composite',
    references: ['Policy:MS08.Competency', 'Committee:Credentials'],
    evaluate(signals) {
      const competency = signals.competency;
      const oppe = signals.oppe;
      if (!competency && !oppe) {
        return missingSignal(this, 'competency');
      }
      const outstanding = competency?.outstandingActions ?? 0;
      const failedCases = oppe?.failedCases ?? 0;
      if (
        (competency?.oppeStatus?.toUpperCase() === 'FAILED') ||
        outstanding >= 2 ||
        failedCases > 0
      ) {
        return baseResult(
          this,
          'FAIL',
          'Competency review failed',
          'OPPE/FPPE data indicates competency concerns.',
          {
            outstanding,
            failedCases,
            competencyStatus: competency?.oppeStatus ?? competency?.fppeStatus,
          },
          'Escalate to credentials committee for immediate remediation.'
        );
      }
      if (outstanding === 1 || (oppe?.activeCases ?? 0) === 0) {
        return baseResult(
          this,
          'WARN',
          'Competency verification pending',
          'Competency review actions remain outstanding or no OPPE activity is recorded.',
          {
            outstanding,
            activeCases: oppe?.activeCases,
          },
          'Complete competency checklist and document the committee decision.'
        );
      }
      return baseResult(this, 'PASS', 'Competency verification current');
    },
  },
];

export function evaluateTjcRules(signals: TJCSignalSnapshot): TJCRuleEvaluation[] {
  return RULES.map((rule) => rule.evaluate(signals));
}
