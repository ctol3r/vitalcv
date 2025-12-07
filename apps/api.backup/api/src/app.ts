import express, { Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { body } from 'express-validator';
import commandController from 'controllers/commandController';
import { validateRequest } from './middleware/validateRequest';
import { errorHandler } from './middleware/errorHandler';
import { agentRouter } from './routes/agent';
import { adminAgentRouter } from './routes/admin_agent';
import { mcpAdminRouter } from './routes/mcp_admin';
import { feedbackRouter } from './routes/feedback';
import { debugRouter } from './routes/debug';
import { agentLimiter, adminLimiter, feedbackLimiter } from './middleware/rateLimit';
import { tenantGuard } from './middleware/tenantGuard';
import { securityHeaders } from './middleware/headers';
import { withObs } from './middleware/obs';
import { healthRouter } from './routes/health';
import { initSentry, Sentry } from './obs/sentry';
import { pubsRouter } from './routes/publications';
import { linkedinRouter } from './routes/oauth_linkedin';
import { sdjwtRouter } from './routes/crypto_sdjwt';
import { bbsRouter } from './routes/crypto_bbs';
import { auditChainRouter } from './routes/audit_chain';
import { metricsRouter } from './routes/metrics';
import { useHelmet } from './middleware/helmet';
import { authOpt } from './middleware/auth';
import { errors } from './middleware/errors';
import { statusAdminRouter } from './routes/status_admin';
import { verifierRouter } from './routes/verifier';
import { preflightRouter } from './routes/preflight';
import { webhooksRouter } from './routes/webhooks';
import { statusRouter } from './routes/status';
import { issuerTenantRouter } from './routes/issuer_tenant';
import { pilotGuard } from './middleware/pilot';
import { demoOverlay } from './routes/demo_overlay';
import { cisoRouter } from './routes/ciso_explain';
import { rollbackRouter } from './routes/rollback';
import { samlRouter } from './routes/saml';
import { docsStatic } from './routes/docs_static';
import { privacyRouter } from '../../src/routes/privacy';
import { rcGate } from '../../src/routes/rc_gate';
import { statusListRouter } from '../../src/routes/statuslist';
import { observability } from '../../src/middleware/obs';
import { slowRequestDetection } from './middleware/slow';
import { locale } from '../../src/middleware/locale';
import { artifactsRouter } from './routes/artifacts';
import { evidenceRouter } from './routes/evidence';
import { demoRouter } from './routes/demo_script';
import { goliveRouter } from './routes/golive';
import { rateHeaders } from './middleware/ratelimit-headers';
import { cspRouter } from './routes/csp';
import { v1 } from './routes/v1_router';
import { statuspageRouter } from './routes/statuspage';
import { harden } from './middleware/harden';
import { withNonce } from './middleware/cspNonce';
import { chaosGate } from './routes/chaos_gate';
import { blockDanger, normalizePath } from './middleware/methods';
import { cdnHints } from './middleware/cdn';
import { freezeRouter } from './routes/config_freeze';
import { pmRouter } from './routes/postmortems';
import { oidcRouter } from './routes/oidc4vci';
import { issuerAdminRouter } from './routes/admin_issuer';
import { revokeRouter } from './routes/revocation';
import { scim } from './routes/scim';
import { oidcEnt } from './routes/oidc_enterprise';
import { billing } from './routes/billing';
import { auditExport } from './routes/audit_export';
import { consent } from './routes/consent';
import { orgAdmin } from './routes/org_admin';
import { residencyGuard, dlpGuard } from './middleware/residency_dlp';
import { geoHints } from './middleware/geo';
import { traffic } from './routes/traffic';
import { upgrade } from './routes/billing_upgrade';
import { invoicePdf } from './routes/invoice_pdf';
import { surgeGate } from './middleware/surge';
import { ops } from './routes/ops_acceptance';
import { orgVat } from '../../src/routes/org_vat';
import { billingHosted } from '../../src/routes/billing_hosted';
import { opsReceipt } from '../../src/routes/ops_receipt';
import { billingCenter } from './routes/billing_center';
import { stripeHook } from './routes/stripe_webhook';
import { rbac } from './routes/rbac_matrix';
import { openapi } from './routes/openapi';
import { demoReset } from './routes/demo_reset';
import { meta } from './routes/meta_tags';
import { cli } from '../../src/routes/cli_installer';
import { staticPub } from '../../src/routes/static_public';
import { newsletter } from './routes/newsletter';
import { flags } from './routes/flags';
import { changelog } from './routes/changelog';
import { landing } from './routes/landing_variant';
import { programs } from '../../src/routes/programs';
import { compacts } from '../../src/routes/compacts';
import { tele } from '../../src/routes/telehealth_authz';
import { anchorCanary } from '../../src/routes/ops_anchor_canary';
import { exams } from '../../src/routes/exams_adoption';
import { pecosCal } from '../../src/routes/pecos_calendar';
import { alitagEval } from '../../src/routes/alitag_eval';
import { anchorVerify } from '../../src/routes/anchor_verify';
import { examState } from '../../src/routes/exams_state';
import { devStatus } from './routes/dev_status';
import { devChecklist } from './routes/dev_checklist';
import { fhirIssue } from './routes/fhirIssue';
import { wallet } from './routes/verify_wallet';
import { dshGate } from './middleware/dshGate';
import { startAIGovernanceMonitor } from './ai/qaMonitor';
import { aiGovernanceRouter } from './routes/ai_governance';
import { health } from './routes/pilot_health';
import { walletStats } from './routes/wallet_stats';
import { pilotSummary } from './routes/pilot_summary';
import { settingsRouter } from './routes/settings';
import { career } from './routes/career';
import { intlRouter } from './routes/intl';
import identityRouter from './routes/identity';


import { hl7Router } from './hl7/ingest';
import { eidasRouter } from './routes/eidas';

const app = express();

// Initialize Sentry (optional)
initSentry();

// Round 20: Security hardening (HSTS, hide powered-by)
harden(app);

// Round 21: Pen-test remediations (block TRACE/TRACK, path normalization)
app.use(blockDanger);
app.use(normalizePath);

// Helmet security headers (before everything)
useHelmet(app);

// Security headers (before everything)
app.use(securityHeaders);

// Round 20: CSP nonce middleware
app.use(withNonce);

// CORS and observability middleware (before routes)
app.use(cors({ origin: true, methods: ['GET', 'POST', 'OPTIONS'] }));
app.use(withObs);
app.use(observability);
app.use(slowRequestDetection);
app.use(locale);

// Round 22: Data residency guard
app.use(residencyGuard);
app.use((req, res, next) => {
  Sentry.addBreadcrumb({ category: 'http', message: req.method + ' ' + req.originalUrl });
  next();
});

// Round 20: Tighter body size limit for security
app.use(express.json({ limit: '1mb' }));

// Round 24: Cookie parser and geo hints
app.use(cookieParser());
app.use(geoHints);

// Round 22: DLP guard for API routes
app.use('/api', dlpGuard);

// Optional JWT authentication
app.use(authOpt);

// Pilot Mode guard (Round 15)
app.use(pilotGuard);

app.post(
  '/credentials',
  body('name').isString().withMessage('name must be a string'),
  body('issuer').isString().withMessage('issuer must be a string'),
  validateRequest,
  (req: Request, res: Response) => {
    // Placeholder for credential creation logic
    res.json({ message: 'Credential created' });
  }
);

app.use('/commands', commandController);

// Round 19: Rate limit headers, CSP reporting, API versioning
app.use('/api', rateHeaders);
app.use('/', cspRouter);
app.use('/api/v1', v1);
app.use('/', statuspageRouter);

// Round 21: CDN cache controls, config freeze, postmortems
app.use('/api', cdnHints);
app.use('/api', freezeRouter);
app.use('/', pmRouter);

// Agent routes with rate limiting and tenant guard
app.use('/api/agent', tenantGuard, agentLimiter, healthRouter);
app.use('/api/agent/solve', surgeGate);
app.use('/api/agent', tenantGuard, agentLimiter, agentRouter);
app.use('/api/agent/admin', adminLimiter, adminAgentRouter);
app.use('/api/agent/mcp-admin', adminLimiter, mcpAdminRouter);
app.use('/api/agent/feedback', feedbackLimiter, feedbackRouter);

// Debug routes (no rate limiting for internal use)
app.use('/_debug', debugRouter);

// Publications and OAuth routes
app.use('/api/publications', pubsRouter);
app.use('/auth', linkedinRouter);

// Crypto routes (SD-JWT, BBS+)
app.use('/api/crypto/sdjwt', sdjwtRouter);
app.use('/api/crypto/bbs', bbsRouter);

// Audit chain routes
app.use('/api/audit-chain', auditChainRouter);

// Metrics
app.use('/metrics', metricsRouter);

// Round 12: Status admin, verifier, preflight, webhooks
app.use('/api/status-admin', statusAdminRouter);
app.use('/api/verifier', verifierRouter);
app.use('/api/preflight', preflightRouter);
app.use('/api/webhooks', webhooksRouter);
app.use('/status', statusRouter);

// Round 13: Issuer tenant config
app.use('/api/issuer-tenant', issuerTenantRouter);

// Round 15: Demo overlay and stakeholder features
app.use('/api/demo-overlay', demoOverlay);
app.use('/api/ciso', cisoRouter);
app.use('/api/rollback', rollbackRouter);

// Round 17: SAML SSO & Docs
app.use('/sso/saml', samlRouter);
app.use('/', docsStatic);

// Round 22: Enterprise onboarding (SCIM, OIDC, Billing, Audit Export, Consent, Org Admin)
app.use('/', scim);
app.use('/', oidcEnt);
app.use('/', billing);
app.use('/', auditExport);
app.use('/', consent);
app.use('/', orgAdmin);

// Round 16: Privacy, RC Gate, StatusList persistence
app.use('/api/privacy', privacyRouter);
app.use('/api/rc', rcGate);
app.use('/status', statusListRouter);

// Round 10: OIDC4VCI, Issuer Admin, Revocation
app.use('/api/oidc4vci', oidcRouter);
app.use('/.well-known', oidcRouter);
app.use('/api/admin/issuer', issuerAdminRouter);
app.use('/api/revocation', revokeRouter);

// Round 20: Chaos SLO gate
app.use('/api', chaosGate);

// Round 14: Artifacts, Evidence, Demo, Go-Live
app.use('/api/artifacts', artifactsRouter);
app.use('/api/evidence', evidenceRouter);
app.use('/api/demo', demoRouter);
app.use('/api/golive', goliveRouter);

// Round 24: Active-Active Traffic & Billing
app.use('/', traffic);
app.use('/', upgrade);
app.use('/', invoicePdf);

// Round 27: Billing Center with RBAC
const { requireOrgRole } = require('../../src/middleware/rbac');
const { billingCenter } = require('../../src/routes/billing_center');
app.use(['/billing/invoice/generate','/billing/invoice/pay','/billing/invoices'], requireOrgRole('admin'));
app.use('/', billingCenter);

// Round 25: Ops acceptance endpoint
app.use('/', ops);

// Round 26: Billing Center, Stripe Webhook, RBAC Matrix, Public Docs
app.use('/', billingCenter);
app.use('/', stripeHook);
app.use('/', rbac);
app.use('/', openapi);

// Round 28: Org VAT, Hosted Invoices, Receipt Smoke
app.use('/', orgVat);
app.use('/', billingHosted);
app.use('/', opsReceipt);

// Round 32: CLI Installer & Static Public Assets
app.use('/', cli);
app.use('/', staticPub);

// Round 33: Demo Reset & Meta Tags
app.use('/', demoReset);
app.use('/', meta);

// Round 34: Newsletter, Runtime Flags, Changelog, Landing Variant
app.use('/', newsletter);
app.use('/admin', flags);
app.use('/', changelog);
app.use('/', landing);

// Batch 39: Education Programs, Compacts, Telehealth AuthZ, Asset Hub Canary
app.use('/', programs);
app.use('/', compacts);
app.use('/', tele);
app.use('/', anchorCanary);

// Batch 40: Exam Adoption, PECOS Calendar, ALITA-G Eval
app.use('/', exams);
app.use('/', pecosCal);
app.use('/', alitagEval);

// Batch 41: Anchor Verify, Exam State
app.use('/', anchorVerify);
app.use('/', examState);

// Batch 51: Dev Observability
app.use('/', devStatus);
app.use('/', devChecklist);

// Batch 76: FHIR $issue, EUDI Wallet, DSH Gate, AI Governance
app.use('/', fhirIssue);
app.use('/', wallet);
app.use('/', aiGovernanceRouter);

// Batch 77: Pilot Health Widget & Wallet Stats
app.use('/', health);
app.use('/', walletStats);
app.use('/', pilotSummary);

// B102C-EUDI-048: Settings API for EUDI wallet configuration
app.use('/api/settings', settingsRouter);
app.use('/api/config', settingsRouter);

// B233B-CAREER: Career Analytics API
app.use('/', career);

// Task 69.2: International Verification Routes
app.use('/api/intl', intlRouter);
// Task 71.2: Face Match Endpoint
app.use('/api/identity', identityRouter);


// Task 56.1: HL7 Ingestion
app.use('/api/hl7', hl7Router);

// Task 68.3: EU Wallet presentation
app.use('/api/eidas', eidasRouter);

// Batch 76: Start AI Governance Monitor
startAIGovernanceMonitor();

// Unified error handler (must be last)
app.use(errorHandler);
app.use(errors);

export default app;
