import fs from "node:fs";
import path from "node:path";

type Scenario =
	| "regionOutage"
	| "dbCorruption"
	| "queueStall"
	| "microkernelFailure";

type Play = {
	title: string;
	steps: string[];
	owner: string;
	checks: string[];
};

function playFor(scenario: Scenario): Play {
	switch (scenario) {
		case "regionOutage":
			return {
				title: "Region outage",
				owner: "SRE",
				steps: [
					"Declare incident (SEV-1), page on-call.",
					"Activate cross-region failover via traffic manager/CDN.",
					"Promote secondary write region; confirm RPO/RTO targets.",
					"Scale up healthy region capacities (API, worker, DB replicas).",
					"Run smoke tests and validate SLO dashboards.",
				],
				checks: [
					"Error budget burn < threshold",
					"P99 latency within target",
					"Queue lag stable",
				],
			};
		case "dbCorruption":
			return {
				title: "Database corruption",
				owner: "DBA",
				steps: [
					"Isolate corrupted primary; stop writes.",
					"Promote replica or restore to last good snapshot.",
					"Repoint application to healthy primary.",
					"Run consistency verification and integrity checks.",
				],
				checks: ["Replica in sync", "No corruption on validation"],
			};
		case "queueStall":
			return {
				title: "Queue stall",
				owner: "Platform",
				steps: [
					"Identify stalled topics and consumer groups.",
					"Drain DLQ; requeue safe messages.",
					"Scale consumers; throttle producers if needed.",
					"Verify end-to-end processing resumes.",
				],
				checks: ["Lag decreasing", "No poison-pill loops"],
			};
		case "microkernelFailure":
			return {
				title: "Microkernel failure",
				owner: "Core",
				steps: [
					"Switch to standby microkernel instance.",
					"Invalidate caches and refresh module registry.",
					"Replay last consistent checkpoint.",
					"Run module health probes and scenario tests.",
				],
				checks: ["All modules healthy", "Checkpoint replay consistent"],
			};
	}
}

export function generateDRPlaybook(mdOutputPath?: string): string {
	const scenarios: Scenario[] = [
		"regionOutage",
		"dbCorruption",
		"queueStall",
		"microkernelFailure",
	];

	const lines: string[] = [];
	lines.push("# Disaster Recovery Runbook");
	lines.push("");
	lines.push("> Auto-generated. Owners must review quarterly.");
	lines.push("");

	for (const scenario of scenarios) {
		const p = playFor(scenario);
		lines.push(`## ${p.title}`);
		lines.push("");
		lines.push(`- Owner: ${p.owner}`);
		lines.push("");
		lines.push("### Steps");
		for (const s of p.steps) lines.push(`1. ${s}`);
		lines.push("");
		lines.push("### Validation Checks");
		for (const c of p.checks) lines.push(`- ${c}`);
		lines.push("");
	}

	const content = lines.join("\n");
	const outPath =
		mdOutputPath ??
		path.join(process.cwd(), "docs", "runbooks", "disaster-recovery.md");

	const dir = path.dirname(outPath);
	if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(outPath, content, "utf8");
	return outPath;
}

if (require.main === module) {
	const out = generateDRPlaybook();
	// eslint-disable-next-line no-console
	console.log(`DR playbook written to: ${out}`);
}


