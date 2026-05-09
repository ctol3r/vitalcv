#!/usr/bin/env tsx
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildEcosystemReport,
  type NetworkNode,
  type TrustEdge,
} from "../../packages/governance-runtime/src/registry.js";

interface NetworkFile { readonly nodes: readonly NetworkNode[]; readonly edges: readonly TrustEdge[]; }

function main(): void {
  const argv = process.argv.slice(2);
  const json = argv.includes("--json");
  let inputPath = resolve(process.cwd(), "scripts/governance/trust-network.json");
  let nowIso = new Date().toISOString();
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--input" && i + 1 < argv.length) inputPath = resolve(process.cwd(), argv[++i]);
    else if (argv[i] === "--now" && i + 1 < argv.length) nowIso = argv[++i];
  }
  if (!existsSync(inputPath)) {
    if (json) process.stdout.write(JSON.stringify({ note: `no network at ${inputPath}`, hasCiGatingCondition: false }, null, 2) + "\n");
    else console.log(`[check-ecosystem-network] No network at ${inputPath} — empty, exit 0.`);
    process.exit(0);
  }
  let net: NetworkFile;
  try {
    net = JSON.parse(readFileSync(inputPath, "utf8")) as NetworkFile;
  } catch (err) {
    console.error(`[check-ecosystem-network] ${(err as Error).message}`);
    process.exit(2);
  }
  const r = buildEcosystemReport(net.nodes, net.edges, nowIso);
  if (json) process.stdout.write(JSON.stringify(r, null, 2) + "\n");
  else {
    console.log(`[check-ecosystem-network] nodes=${r.propagated.length} findings=${r.findings.length}`);
    for (const f of r.findings) console.log(`  ${JSON.stringify(f)}`);
  }
  process.exit(r.hasCiGatingCondition ? 1 : 0);
}
main();
