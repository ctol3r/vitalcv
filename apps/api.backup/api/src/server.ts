/**
 * Main Express Server
 * Wires all Batch 37 routes and middleware
 */

import cors from 'cors';
import express from 'express';
import http from 'http';
// Core middleware
import { requestIdMiddleware } from './middleware/requestId';
import { useHelmet } from './middleware/helmet';
// OpenAPI documentation
import openApiRoutes from './openapi/routes';
// Health check routes
import healthzRouter, { readyzRouter } from './routes/healthz';
// import '../../services/events/subscribers/analyticsEventSubscriber';
// import '../../services/timeline/normalizer';
// import '../../services/timeline/realtimeIntegration';
import { adminExams } from './routes/admin_exams';
import { alitagRouter } from './routes/alitag';
// import { alitagSmoke } from './routes/alitag_smoke'; // TODO: Create this route file
import { aprnRouter } from './routes/aprn';
import { compacts as compactsRouter } from './routes/compacts';
import { devChecklist } from './routes/dev_checklist';
import { devCi } from './routes/dev_ci';
import { devCiStatus } from './routes/dev_ci_status';
import { devEnv } from './routes/dev_env';
import { devMigrations } from './routes/dev_migrations';
import { devMigrateApply } from './routes/dev_migrations_apply';
import { devRoutes } from './routes/dev_routes';
import { devStatus } from './routes/dev_status';
// import { digests } from './routes/digests'; // TODO: Create this route file
// import { last } from './routes/digests_last'; // TODO: Create this route file
import { etlRouter } from './routes/etl';
import { examState } from './routes/exams_state';
import { flags } from './routes/flags';
import { nlcRouter } from './routes/nlc';
// import { anchorCanary } from './routes/ops_anchor_canary'; // TODO: Create this route file
import { pecosRouter } from './routes/pecos';
import { pharmacistRouter } from './routes/pharmacist';
import { playbook } from './routes/playbook';
import { pexp } from './routes/playbook_export';
import { privilegesRouter } from './routes/privileges';
// import { psy } from './routes/psych_psypact'; // TODO: Create this route file
// import { psychSmoke } from './routes/psych_psypact_smoke'; // TODO: Create this route file
import { psypactRouter } from './routes/psypact';
import { statusRouter } from './routes/status';
import { telehealthRouter } from './routes/telehealth';
// Batch 54 Routes
import { agentsHealth } from './routes/agents_health';
import { auditSurvey } from './routes/audit_survey_export';
import { behavioral } from './routes/behavioral_eligibility';
import { eudiProfiles } from './routes/eudi_profiles';
import { verifyEvents } from './routes/verify_events';
// Batch 56 Routes
import { surveyPacket } from './routes/audit_survey_packet';
import { eudiTrust } from './routes/eudi_trust_status';
// Batch 57 Routes
import { behHeader } from './routes/behavioral_header';
import { verifyRecent } from './routes/verify_recent';
// Batch 58 Routes
import { compactHeader } from './routes/compact_header';
import { verifySSE } from './routes/verify_sse';
// Batch 59 Routes
// import { runbookOps } from './routes/runbook_ops'; // TODO: Create this route file
// import { createWSS } from '../../src/realtime/ws'; // TODO: Create the realtime/ws module
import { demoReset } from './routes/demo_reset';
import { heatmap } from './routes/digests_heatmap';
import { eudiCSV } from './routes/eudi_noncompliance';
// Batch 61 Routes
import { share } from './routes/dev_share';
import { diff } from './routes/digests_diff';
// Batch 62 Routes
import { sharePdf } from './routes/dev_share_pdf';
import { devMe } from './routes/dev_me';
import { seedHistory } from './routes/dev_seed_history';
// Batch 63 Routes
import { complianceSnap } from './routes/compliance_snapshot';
import { compCoverage } from './routes/compacts_coverage';
import { execBrief } from './routes/exec_brief';
import { demoMode } from './routes/dev_demo_mode';
// Batch 64 Routes
import { execBriefT } from './routes/exec_brief_tenant';
import { demoSc } from './routes/dev_demo_scenarios';
// Batch 65 Routes
import { rec } from './routes/dev_demo_recorder';
import { execDiff } from './routes/exec_brief_diff';
// Batch 66 Routes
import { demoRunner } from './routes/dev_demo_runner';
import { runs } from './routes/dev_demo_runs';
// Batch 67 Routes
import { junit } from './routes/dev_demo_junit';
// Batch 68 Routes
import { eudiProv } from './routes/eudi_providers';
import { src } from './routes/verify_sources';
import { hashVerify } from './routes/audit_hash_verify';
import { bhVC } from './routes/behavioral_vc_preview';
// Batch 69 Routes
import { verifyLicense } from './routes/verify_license';
import { licenseRefresh } from './routes/verify_license_refresh';
// Batch 70 Routes
import { boardReg } from './routes/board_registry';
import { licCache } from './routes/verify_license_cache';
// Batch 71 Routes (NCQA Windows, Source Modes, Mock Board, Board/DEA PSV)
import { win } from './routes/compliance_windows';
import { sourceModes as modes } from './routes/verify_source_modes';
import { mockBoard } from './routes/mock_board';
import { verifyBoardDea as vbd } from './routes/verify_board_dea';
// Batch 72 Routes (NPDB/OIG Cache + Runners, PSV Score, CA/FL Board Mocks)
import { npdboig } from './routes/verify_npdb_oig';
import { psvScore } from './routes/compliance_psv_score';
import { mockStates } from './routes/mock_board_state';
// Batch 73 Routes (Weighted PSV, Leaderboard, Alerts)
import { weight } from './routes/compliance_psv_weights';
import { wscore } from './routes/compliance_psv_weighted';
import { ldr } from './routes/compliance_leaderboard';
import { alertSet } from './routes/compliance_psv_alerts';
// Batch 75 Routes (Per-source Config, Credentialing Ops Console)
import { srcCfg } from './routes/compliance_source_config';
// Batch 74 Routes (Weekly Alerts, Leaderboard Drill-down)
import { alerts } from './routes/compliance_alerts';
import { ldrNpi } from './routes/compliance_leaderboard_drill';
// Batch 77 Routes (Pilot Health Widget, Wallet Stats)
import { health as pilotHealth } from './routes/pilot_health';
import { walletStats } from './routes/wallet_stats';
import { aiGovernanceRouter } from './routes/ai_governance';
// Batch 78 Routes (Pilot WS, Alerts SSE, TEFCA Sync)
import { createPilotWSS } from './realtime/pilot_ws';
import { alertsSSE } from './routes/alerts_sse';
import { tefca } from './routes/tefca_sync';
// Batch 79 Routes (Slack Alerts, Ops Escalation, TEFCA Delta)
import { escalate } from './routes/ops_escalate';
import { delta } from './routes/tefca_delta';
// S72-D3 Routes (Pilot Smoke Test)
import pilotSmokeRouter from './routes/demo/pilot/smoke';
import pilotStatusRouter from './routes/demo/pilot/status';
import pilotOrgRouter from './routes/demo/pilot/org';
import { createGraphQLServer } from './graphql/server';

// Task 56.1 & 56.4
import { hl7Router } from './hl7/ingest';
import { startRetryWorker } from './hl7/retryWorker';

// Batch 201 - Substrate Chain Integration
import { initializeChainServices, shutdownChainServices } from './chain';
import chainHealthRouter from './routes/chain_health';
import chainCredentialRouter from './routes/chain_credential';
import chainIssuersRouter from './routes/chain_issuers';
import {
  initChainHealthRoute,
  initChainCredentialRoutes,
  initChainIssuersRoute
} from './chain/routeInit';

// CRYPTO-003: VC Verification Route
import vcVerifyRouter from './routes/vc-verify';

// OIDC-VCI-001, OIDC-VCI-002: OIDC4VCI Routes
import oidcVciRouter from './routes/oidc-vci';

// OIDC-VP-010: OIDC4VP Routes
import oidcVpRouter from './routes/oidc-vp';

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware (must be first)
useHelmet(app);

// Request ID middleware (for tracing)
app.use(requestIdMiddleware());

// Core middleware
app.use(cors());
app.use(express.json());

// Health check endpoints (K8s probes)
app.use('/healthz', healthzRouter);
app.use('/readyz', readyzRouter);

// OpenAPI documentation
app.use(openApiRoutes);

// Legacy health check (backwards compatibility)
app.get('/health', (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString(), requestId: req.requestId });
});

// Batch 37 Routes
app.use(nlcRouter);
app.use(aprnRouter);
app.use(psypactRouter);
app.use(pecosRouter);
app.use(telehealthRouter);
app.use(privilegesRouter);
app.use(pharmacistRouter);
app.use(compactsRouter);
app.use(etlRouter);
app.use(alitagRouter);
app.use(statusRouter);
// app.use(anchorCanary); // TODO: Uncomment when ops_anchor_canary route is created
// app.use(psychSmoke); // TODO: Uncomment when psych_psypact_smoke route is created
// app.use(alitagSmoke); // TODO: Uncomment when alitag_smoke route is created
app.use(examState);
app.use(playbook);
app.use(adminExams);
// app.use(psy); // TODO: Uncomment when psych_psypact route is created
app.use(pexp);
// app.use(digests); // TODO: Uncomment when digests route is created
// app.use(last); // TODO: Uncomment when digests_last route is created
app.use(devStatus);
app.use(devChecklist);
app.use(devRoutes);
app.use(devMigrations);
app.use(devCi);
app.use(devMigrateApply);
app.use(flags);
app.use(devEnv);
app.use(devCiStatus);
// Batch 54 Routes
app.use(eudiProfiles);
app.use(verifyEvents);
app.use(auditSurvey);
app.use(behavioral);
app.use(agentsHealth);
// Batch 56 Routes
app.use(eudiTrust);
app.use(surveyPacket);
// Batch 57 Routes
app.use(verifyRecent);
app.use(behHeader);
// Batch 58 Routes
app.use(verifySSE);
app.use(compactHeader);
// Batch 60 Routes (heatmap, demoReset, eudiCSV)
app.use(heatmap);
app.use(demoReset);
app.use(eudiCSV);
// Batch 61 Routes (state diff, share preview)
app.use(diff);
app.use(share);
// Batch 62 Routes (PDF export, seed history, admin guards)
app.use(sharePdf);
app.use(devMe);
app.use(seedHistory);
// Batch 63 Routes (Exec Brief, Demo Mode, Compliance Snapshot)
app.use(complianceSnap);
app.use(compCoverage);
app.use(execBrief);
app.use(demoMode);
// Batch 64 Routes (Tenant Exec Brief, Demo Scenarios)
app.use(execBriefT);
app.use(demoSc);
// Batch 65 Routes (Demo Recorder, Exec Brief Diff)
app.use(rec);
app.use(execDiff);
// Batch 66 Routes (Demo Runner, Demo Runs)
app.use(demoRunner);
app.use(runs);
// Batch 67 Routes (JUnit XML Export)
app.use(junit);
// Batch 68 Routes (EUDI Providers, PSV Sources, Hash Verify, Behavioral VC)
app.use(eudiProv);
app.use(src);
app.use(hashVerify);
app.use(bhVC);
// Batch 69 Routes (License Board Adapter with Cache)
app.use(verifyLicense);
app.use(licenseRefresh);
// Batch 70 Routes (Board Registry, License Cache Search/Purge)
app.use(boardReg);
app.use(licCache);
// Batch 71 Routes (NCQA Windows, Source Modes, Mock Board, Board/DEA PSV)
app.use(win);
app.use(modes);
app.use(mockBoard);
app.use(vbd);
// Batch 72 Routes (NPDB/OIG Cache + Runners, PSV Score, CA/FL Board Mocks)
app.use(npdboig);
app.use(psvScore);
app.use(mockStates);
// Batch 73 Routes (Weighted PSV, Leaderboard, Alerts)
app.use(weight);
app.use(wscore);
app.use(ldr);
app.use(alertSet);
// Batch 74 Routes (Weekly Alerts, Leaderboard Drill-down)
app.use(alerts);
app.use(ldrNpi);
// Batch 75 Routes (Per-source Config, Credentialing Ops Console)
app.use(srcCfg);
// Batch 77 Routes (Pilot Health Widget, Wallet Stats, AI Governance)
app.use(pilotHealth);
app.use(walletStats);
app.use(aiGovernanceRouter);
// Batch 78 Routes (Pilot WS, Alerts SSE, TEFCA Sync)
app.use(alertsSSE);
app.use(tefca);
// Batch 79 Routes (Ops Escalation, TEFCA Delta)
app.use(escalate);
app.use(delta);
// S72-D3 Routes (Pilot Smoke Test)
app.use('/demo/pilot', pilotSmokeRouter);
app.use('/demo/pilot', pilotStatusRouter);
app.use('/demo/pilot', pilotOrgRouter);
// Task 56.1
app.use('/api/hl7', hl7Router);
// Batch 201 Routes (Chain Integration)
app.use(chainHealthRouter);
app.use(chainCredentialRouter);
app.use(chainIssuersRouter);

// CRYPTO-003: VC Verification
app.use('/vc', vcVerifyRouter);

// OIDC-VCI-001, OIDC-VCI-002: OIDC4VCI Routes
app.use('/.well-known', oidcVciRouter);
app.use('/oidc', oidcVciRouter);

// OIDC-VP-010: OIDC4VP Routes
app.use('/oidc/presentation', oidcVpRouter);

// Credential Revocation (with blockchain audit)
import credentialRevokeRouter from './routes/credential-revoke';
app.use('/credential', credentialRevokeRouter);

// Blockchain Audit Status
import blockchainAuditStatusRouter from './routes/blockchain-audit-status';
app.use('/blockchain/audit', blockchainAuditStatusRouter);
// Batch 59 Routes
// app.use(runbookOps); // TODO: Uncomment when runbook_ops route is created

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ ok: false, error: err.message || 'Internal server error' });
});

// Create HTTP server and integrate WebSocket server
const httpServer = http.createServer(app);
createPilotWSS(httpServer); // Batch 78: Pilot Health WebSocket

// Task 56.4: Start HL7 retry worker
startRetryWorker();

// Task 201.5: Initialize Substrate chain services
initializeChainServices().then(() => {
  console.log('✅ Chain services ready');
}).catch((error) => {
  console.error('⚠️  Chain services failed to initialize:', error);
});

// Initialize Apollo GraphQL Server
createGraphQLServer(httpServer).then((graphqlMiddleware) => {
  app.use('/graphql', cors(), express.json(), graphqlMiddleware);

  httpServer.listen(PORT, () => {
    console.log(`🚀 VitalCV Platform running on port ${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/health`);
    console.log(`   GraphQL: http://localhost:${PORT}/graphql`);
    console.log(`   Batch 54: EUDI Wallet, NCQA PSV, Behavioral Compacts, Multi-Agent`);
  console.log(`   • /api/eudi/issuer/profiles`);
  console.log(`   • /api/verify/events`);
  console.log(`   • /api/behavioral/eligibility`);
  console.log(`   • /api/agents/health`);
  console.log(`   Batch 56: ETSI Trust Lists, Kafka Workers, Survey Packets`);
  console.log(`   • /api/eudi/trusted-list/status`);
  console.log(`   • /api/audit/survey-packet.pdf`);
  console.log(`   Batch 57: Verify Stream, EUDI Enforcement, Behavioral Headers`);
  console.log(`   • /api/verify/recent`);
  console.log(`   • /api/clinician/behavioral-header`);
  console.log(`   Batch 58: SSE Verify Stream, IMLC/APRN Compact Headers, Survey Packets`);
  console.log(`   • /api/verify/stream (SSE)`);
  console.log(`   • /api/clinician/compact-header`);
  console.log(`   Batch 59: WebSocket Verify Stream, Ops Runbook, Compact Map Legend`);
  console.log(`   • ws://localhost:${PORT} (WebSocket verify stream)`);
  console.log(`   • /api/runbook/ops`);
  console.log(`   Batch 60: State-Change Heatmap, Demo Reset+Reseed, EUDI CSV`);
  console.log(`   • /api/digests/heatmap`);
  console.log(`   • /ops/demo-reset?reseed=1`);
  console.log(`   • /api/eudi/trusted-list/noncompliance.csv`);
  console.log(`   Batch 77: Pilot Health Widget, Wallet Stats, Weekly Summary`);
  console.log(`   • /api/pilot/health`);
    console.log(`   • /api/verify/wallet/stats`);
    console.log(`   • /api/ai/governance`);
    console.log(`   • POST /api/pilot/summary/send`);
    console.log(`   Batch 201: Substrate PoA Chain Integration`);
    console.log(`   • /api/chain/health`);
    console.log(`   • /api/chain/credential/:id/status`);
    console.log(`   • /api/chain/credential/:id/debug`);
    console.log(`   • /api/chain/issuers`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('📛 SIGTERM received, shutting down gracefully...');
  await shutdownChainServices();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('📛 SIGINT received, shutting down gracefully...');
  await shutdownChainServices();
  process.exit(0);
});

export default app;
export { app };
