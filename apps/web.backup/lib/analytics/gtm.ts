/**
 * Google Tag Manager (GTM) Analytics Integration
 *
 * Tracks Apply-with-VitalCV widget events and conversions
 * for marketing attribution and funnel analysis.
 */

// GTM Data Layer structure
interface GTMDataLayer {
  event: string;
  [key: string]: any;
}

declare global {
  interface Window {
    dataLayer?: GTMDataLayer[];
  }
}

/**
 * Initialize GTM data layer
 * Call this once during app initialization
 */
export function initGTM() {
  if (typeof window === 'undefined') {
    return;
  }

  if (!window.dataLayer) {
    window.dataLayer = [];
  }

  console.log('[GTM] Data layer initialized');
}

/**
 * Push event to GTM data layer
 */
function pushToDataLayer(event: GTMDataLayer) {
  if (typeof window === 'undefined' || !window.dataLayer) {
    console.warn('[GTM] Data layer not available');
    return;
  }

  window.dataLayer.push(event);
  console.log('[GTM] Event pushed:', event.event, event);
}

/**
 * Track page view
 */
export function trackPageView(page: {
  path: string;
  title: string;
  referrer?: string;
}) {
  pushToDataLayer({
    event: 'page_view',
    page_path: page.path,
    page_title: page.title,
    page_referrer: page.referrer || document.referrer,
  });
}

/**
 * Track Apply-with-VitalCV button click
 */
export function trackApplyButtonClick(data: {
  jobId: string;
  jobTitle: string;
  partnerId: string;
  partnerName?: string;
  location?: string;
  specialty?: string;
}) {
  pushToDataLayer({
    event: 'apply_button_click',
    job_id: data.jobId,
    job_title: data.jobTitle,
    partner_id: data.partnerId,
    partner_name: data.partnerName,
    job_location: data.location,
    job_specialty: data.specialty,
    event_category: 'engagement',
    event_label: 'Apply with VitalCV',
  });
}

/**
 * Track widget modal/iframe open
 */
export function trackApplyModalOpen(data: {
  jobId: string;
  jobTitle: string;
  partnerId: string;
}) {
  pushToDataLayer({
    event: 'apply_modal_open',
    job_id: data.jobId,
    job_title: data.jobTitle,
    partner_id: data.partnerId,
    event_category: 'engagement',
    event_label: 'Widget Opened',
  });
}

/**
 * Track authentication initiation
 */
export function trackAuthenticationStart(data: {
  jobId: string;
  authMethod: 'login' | 'signup';
}) {
  pushToDataLayer({
    event: 'apply_auth_start',
    job_id: data.jobId,
    auth_method: data.authMethod,
    event_category: 'application_funnel',
    event_label: 'Authentication Started',
  });
}

/**
 * Track successful authentication
 */
export function trackAuthenticationSuccess(data: {
  jobId: string;
  candidateId: string;
  authMethod: 'login' | 'signup';
  isNewUser: boolean;
}) {
  pushToDataLayer({
    event: 'apply_auth_success',
    job_id: data.jobId,
    candidate_id: data.candidateId,
    auth_method: data.authMethod,
    is_new_user: data.isNewUser,
    event_category: 'application_funnel',
    event_label: 'Authentication Successful',
  });
}

/**
 * Track credential selection
 */
export function trackCredentialSelection(data: {
  jobId: string;
  candidateId: string;
  credentialTypes: string[];
  credentialCount: number;
}) {
  pushToDataLayer({
    event: 'apply_credentials_selected',
    job_id: data.jobId,
    candidate_id: data.candidateId,
    credential_types: data.credentialTypes,
    credential_count: data.credentialCount,
    event_category: 'application_funnel',
    event_label: 'Credentials Selected',
  });
}

/**
 * Track application submission (SUCCESS - primary conversion event)
 */
export function trackApplicationSubmitted(data: {
  jobId: string;
  jobTitle: string;
  partnerId: string;
  partnerName?: string;
  applicationId: string;
  candidateId: string;
  credentialTypes: string[];
  matchScore?: number;
  timeToComplete?: number; // milliseconds
  specialty?: string;
  location?: string;
}) {
  // Primary conversion event
  pushToDataLayer({
    event: 'apply_submission_success',
    job_id: data.jobId,
    job_title: data.jobTitle,
    partner_id: data.partnerId,
    partner_name: data.partnerName,
    application_id: data.applicationId,
    candidate_id: data.candidateId,
    credential_types: data.credentialTypes,
    match_score: data.matchScore,
    time_to_complete_ms: data.timeToComplete,
    job_specialty: data.specialty,
    job_location: data.location,
    event_category: 'conversion',
    event_label: 'Application Submitted',
    value: 1, // Conversion value
  });

  // Also track as enhanced ecommerce event (if needed for GA4)
  pushToDataLayer({
    event: 'purchase',
    ecommerce: {
      transaction_id: data.applicationId,
      value: 1,
      currency: 'USD',
      items: [
        {
          item_id: data.jobId,
          item_name: data.jobTitle,
          item_category: data.specialty,
          item_category2: data.location,
          price: 1,
          quantity: 1,
        },
      ],
    },
  });
}

/**
 * Track application error/failure
 */
export function trackApplicationError(data: {
  jobId: string;
  candidateId?: string;
  errorType: string;
  errorMessage: string;
  step: 'auth' | 'credentials' | 'submission';
}) {
  pushToDataLayer({
    event: 'apply_error',
    job_id: data.jobId,
    candidate_id: data.candidateId,
    error_type: data.errorType,
    error_message: data.errorMessage,
    error_step: data.step,
    event_category: 'error',
    event_label: `Application Error - ${data.step}`,
  });
}

/**
 * Track widget close/abandonment
 */
export function trackApplyModalClose(data: {
  jobId: string;
  candidateId?: string;
  stage: 'auth' | 'credentials' | 'review' | 'submitted';
  timeSpent?: number; // milliseconds
}) {
  pushToDataLayer({
    event: 'apply_modal_close',
    job_id: data.jobId,
    candidate_id: data.candidateId,
    abandon_stage: data.stage,
    time_spent_ms: data.timeSpent,
    event_category: 'engagement',
    event_label: 'Widget Closed',
  });
}

/**
 * Track job view (for funnel analysis)
 */
export function trackJobView(data: {
  jobId: string;
  jobTitle: string;
  partnerId: string;
  partnerName?: string;
  specialty?: string;
  location?: string;
  referrer?: string;
}) {
  pushToDataLayer({
    event: 'job_view',
    job_id: data.jobId,
    job_title: data.jobTitle,
    partner_id: data.partnerId,
    partner_name: data.partnerName,
    job_specialty: data.specialty,
    job_location: data.location,
    referrer: data.referrer || document.referrer,
    event_category: 'engagement',
    event_label: 'Job Viewed',
  });
}

/**
 * Track job search
 */
export function trackJobSearch(data: {
  searchQuery?: string;
  filters?: {
    specialty?: string;
    location?: string;
    modality?: string;
  };
  resultsCount: number;
}) {
  pushToDataLayer({
    event: 'job_search',
    search_query: data.searchQuery,
    search_filters: data.filters,
    search_results_count: data.resultsCount,
    event_category: 'engagement',
    event_label: 'Job Search',
  });
}

/**
 * Track hire notification (when partner marks candidate as hired)
 */
export function trackCandidateHired(data: {
  jobId: string;
  jobTitle: string;
  partnerId: string;
  applicationId: string;
  candidateId: string;
  timeToHire?: number; // days from application to hire
}) {
  pushToDataLayer({
    event: 'candidate_hired',
    job_id: data.jobId,
    job_title: data.jobTitle,
    partner_id: data.partnerId,
    application_id: data.applicationId,
    candidate_id: data.candidateId,
    time_to_hire_days: data.timeToHire,
    event_category: 'conversion',
    event_label: 'Candidate Hired',
    value: 100, // Higher value for successful hire
  });
}

/**
 * Track custom event
 */
export function trackCustomEvent(data: {
  event: string;
  category?: string;
  label?: string;
  value?: number;
  [key: string]: any;
}) {
  pushToDataLayer({
    event: data.event,
    event_category: data.category,
    event_label: data.label,
    event_value: data.value,
    ...data,
  });
}

/**
 * Enhanced measurement - scroll depth tracking
 */
export function trackScrollDepth(data: {
  page: string;
  depth: 25 | 50 | 75 | 90 | 100;
}) {
  pushToDataLayer({
    event: 'scroll',
    page_path: data.page,
    scroll_depth: data.depth,
    event_category: 'engagement',
    event_label: `Scroll ${data.depth}%`,
  });
}

/**
 * Track time on page (call on page unload)
 */
export function trackTimeOnPage(data: {
  page: string;
  timeSeconds: number;
}) {
  pushToDataLayer({
    event: 'time_on_page',
    page_path: data.page,
    time_on_page_seconds: data.timeSeconds,
    event_category: 'engagement',
    event_label: 'Time on Page',
  });
}

/**
 * Initialize GTM container
 * This should be called in _app.tsx or layout.tsx
 */
export function loadGTMContainer(gtmId: string) {
  if (typeof window === 'undefined') {
    return;
  }

  // Initialize data layer
  initGTM();

  // Load GTM script
  const script = document.createElement('script');
  script.innerHTML = `
    (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
    new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
    j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
    'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
    })(window,document,'script','dataLayer','${gtmId}');
  `;
  document.head.appendChild(script);

  // Add noscript iframe
  const noscript = document.createElement('noscript');
  noscript.innerHTML = `
    <iframe src="https://www.googletagmanager.com/ns.html?id=${gtmId}"
    height="0" width="0" style="display:none;visibility:hidden"></iframe>
  `;
  document.body.insertBefore(noscript, document.body.firstChild);

  console.log('[GTM] Container loaded:', gtmId);
}

/**
 * Example usage in widget integration:
 *
 * ```typescript
 * // On button click
 * trackApplyButtonClick({
 *   jobId: 'job-123',
 *   jobTitle: 'Family Medicine Physician',
 *   partnerId: 'partner-456',
 *   specialty: 'Family Medicine',
 *   location: 'San Francisco, CA'
 * });
 *
 * // On successful application
 * trackApplicationSubmitted({
 *   jobId: 'job-123',
 *   jobTitle: 'Family Medicine Physician',
 *   partnerId: 'partner-456',
 *   applicationId: 'app-789',
 *   candidateId: 'cand-321',
 *   credentialTypes: ['license', 'education'],
 *   matchScore: 92,
 *   timeToComplete: 45000 // 45 seconds
 * });
 * ```
 */

/**
 * Data Layer Structure Documentation
 *
 * The following events are pushed to the data layer and can be used
 * to create triggers and tags in Google Tag Manager:
 *
 * Event: apply_button_click
 * - Triggers when user clicks "Apply with VitalCV" button
 * - Use for: Tracking engagement, funnel step 1
 *
 * Event: apply_modal_open
 * - Triggers when widget modal/iframe opens
 * - Use for: Tracking widget load, funnel step 2
 *
 * Event: apply_auth_start
 * - Triggers when user initiates authentication
 * - Use for: Tracking auth funnel, funnel step 3
 *
 * Event: apply_auth_success
 * - Triggers after successful authentication
 * - Use for: Tracking auth conversions, funnel step 4
 *
 * Event: apply_credentials_selected
 * - Triggers when user selects credentials
 * - Use for: Tracking credential usage, funnel step 5
 *
 * Event: apply_submission_success
 * - Triggers after successful application submission
 * - Use for: PRIMARY CONVERSION EVENT, funnel step 6
 *
 * Event: candidate_hired
 * - Triggers when partner marks candidate as hired
 * - Use for: FINAL CONVERSION EVENT, revenue attribution
 *
 * Event: apply_error
 * - Triggers on any application error
 * - Use for: Error tracking, optimization opportunities
 *
 * Event: apply_modal_close
 * - Triggers when widget closes
 * - Use for: Abandonment tracking, drop-off analysis
 */

export default {
  init: initGTM,
  loadContainer: loadGTMContainer,
  trackPageView,
  trackJobView,
  trackJobSearch,
  trackApplyButtonClick,
  trackApplyModalOpen,
  trackAuthenticationStart,
  trackAuthenticationSuccess,
  trackCredentialSelection,
  trackApplicationSubmitted,
  trackApplicationError,
  trackApplyModalClose,
  trackCandidateHired,
  trackCustomEvent,
  trackScrollDepth,
  trackTimeOnPage,
};

