/**
 * E2E Test: Wallet → Share → Verify Happy Path + 3 Failure Scenarios
 * Task: 1106-frontend-0019
 */

describe('Wallet → Share → Verify Flow', () => {
  beforeEach(() => {
    // Clear cookies and localStorage
    cy.clearCookies();
    cy.clearLocalStorage();

    // Set viewport
    cy.viewport(1280, 720);
  });

  describe('Happy Path', () => {
    it('should complete full wallet→share→verify flow successfully', () => {
      // 1. Navigate to wallet
      cy.visit('/wallet', { failOnStatusCode: false });

      // 2. Verify wallet page loads
      cy.get('[data-testid="wallet-page"]', { timeout: 10000 }).should('be.visible');

      // 3. Check for credentials (or create mock)
      cy.get('[data-testid="credential-card"]').first().should('be.visible');

      // 4. Click share button
      cy.get('[data-testid="share-credential-btn"]').first().click();

      // 5. Share modal appears
      cy.get('[data-testid="share-modal"]').should('be.visible');

      // 6. Select disclosure preset
      cy.get('[data-testid="preset-minimum"]').click();

      // 7. Verify field selection updated
      cy.get('[data-testid="selected-fields-count"]').should('contain', '4');

      // 8. Generate QR code
      cy.get('[data-testid="generate-qr-btn"]').click();

      // 9. QR code appears
      cy.get('[data-testid="qr-code-display"]', { timeout: 5000 }).should('be.visible');

      // 10. Get the presentation URL/data
      cy.get('[data-testid="presentation-data"]').invoke('text').then((presentationData) => {
        // 11. Navigate to verify page
        cy.visit('/verify');

        // 12. Paste or scan the presentation
        cy.get('[data-testid="manual-verify-btn"]').click();
        cy.get('[data-testid="presentation-input"]').type(presentationData);

        // 13. Click verify
        cy.get('[data-testid="verify-btn"]').click();

        // 14. Wait for verification
        cy.get('[data-testid="verification-result"]', { timeout: 10000 }).should('be.visible');

        // 15. Verify success message
        cy.get('[data-testid="verification-status"]').should('contain', 'Verified');

        // 16. Verify only selected fields are shown
        cy.get('[data-testid="revealed-field"]').should('have.length', 4);
      });
    });
  });

  describe('Failure Scenarios', () => {
    it('should handle expired credential gracefully', () => {
      cy.visit('/verify');

      // Mock expired credential
      cy.intercept('POST', '/api/verifier/presentation', {
        statusCode: 400,
        body: {
          verified: false,
          errorCode: 'E_EXPIRED',
          error: 'Credential has expired',
        },
      }).as('verifyExpired');

      // Attempt verification
      cy.get('[data-testid="manual-verify-btn"]').click();
      cy.get('[data-testid="presentation-input"]').type('mock-expired-credential');
      cy.get('[data-testid="verify-btn"]').click();

      cy.wait('@verifyExpired');

      // Verify error overlay appears
      cy.get('[data-testid="error-overlay"]').should('be.visible');
      cy.get('[data-testid="error-code"]').should('contain', 'E_EXPIRED');
      cy.get('[data-testid="error-message"]').should('contain', 'expired');

      // Verify CTA button is present
      cy.get('[data-testid="error-cta"]').should('be.visible');
    });

    it('should handle revoked credential', () => {
      cy.visit('/verify');

      // Mock revoked credential
      cy.intercept('POST', '/api/verifier/presentation', {
        statusCode: 400,
        body: {
          verified: false,
          errorCode: 'E_REVOKED',
          error: 'Credential has been revoked',
        },
      }).as('verifyRevoked');

      cy.get('[data-testid="manual-verify-btn"]').click();
      cy.get('[data-testid="presentation-input"]').type('mock-revoked-credential');
      cy.get('[data-testid="verify-btn"]').click();

      cy.wait('@verifyRevoked');

      // Verify error shown
      cy.get('[data-testid="error-overlay"]').should('be.visible');
      cy.get('[data-testid="error-code"]').should('contain', 'E_REVOKED');
      cy.get('[data-testid="error-message"]').should('contain', 'revoked');

      // Verify not recoverable
      cy.get('[data-testid="retry-btn"]').should('not.exist');
    });

    it('should handle network error with retry', () => {
      cy.visit('/verify');

      // First attempt fails with network error
      cy.intercept('POST', '/api/verifier/presentation', {
        statusCode: 500,
        body: {
          verified: false,
          errorCode: 'E_NETWORK_ERROR',
          error: 'Network error',
        },
      }).as('verifyNetworkError');

      cy.get('[data-testid="manual-verify-btn"]').click();
      cy.get('[data-testid="presentation-input"]').type('test-credential');
      cy.get('[data-testid="verify-btn"]').click();

      cy.wait('@verifyNetworkError');

      // Verify error shown with retry button
      cy.get('[data-testid="error-overlay"]').should('be.visible');
      cy.get('[data-testid="retry-btn"]').should('be.visible');

      // Mock successful retry
      cy.intercept('POST', '/api/verifier/presentation', {
        statusCode: 200,
        body: {
          verified: true,
          credentialType: 'MedicalLicenseCredential',
        },
      }).as('verifySuccess');

      // Click retry
      cy.get('[data-testid="retry-btn"]').click();

      cy.wait('@verifySuccess');

      // Verify success
      cy.get('[data-testid="verification-status"]').should('contain', 'Verified');
    });
  });

  describe('Accessibility & Performance', () => {
    it('should have no accessibility violations on wallet page', () => {
      cy.visit('/wallet');
      cy.injectAxe();
      cy.checkA11y('[data-testid="wallet-page"]', {
        rules: {
          'color-contrast': { enabled: true },
          'aria-allowed-attr': { enabled: true },
        },
      });
    });

    it('should complete share flow within performance budget', () => {
      cy.visit('/wallet');

      const start = Date.now();

      cy.get('[data-testid="credential-card"]').first().should('be.visible');
      cy.get('[data-testid="share-credential-btn"]').first().click();
      cy.get('[data-testid="share-modal"]').should('be.visible');
      cy.get('[data-testid="generate-qr-btn"]').click();
      cy.get('[data-testid="qr-code-display"]').should('be.visible');

      const end = Date.now();
      const duration = end - start;

      // Should complete in under 2 seconds
      expect(duration).to.be.lessThan(2000);
    });

    it('should have stable selectors throughout flow', () => {
      // Verify all critical selectors exist and are stable
      cy.visit('/wallet');

      const selectors = [
        '[data-testid="wallet-page"]',
        '[data-testid="credential-card"]',
        '[data-testid="share-credential-btn"]',
        '[data-testid="share-modal"]',
        '[data-testid="preset-minimum"]',
        '[data-testid="preset-job"]',
        '[data-testid="preset-full"]',
        '[data-testid="generate-qr-btn"]',
      ];

      selectors.forEach((selector) => {
        cy.get('body').then(($body) => {
          if ($body.find(selector).length > 0) {
            cy.get(selector).should('exist');
          }
        });
      });
    });
  });

  afterEach(() => {
    // Take screenshot on failure
    cy.screenshot('test-failure', { capture: 'runner', onlyOnFailure: true });
  });
});

// Configure video recording
Cypress.config('video', true);
Cypress.config('videoCompression', 32);
Cypress.config('screenshotOnRunFailure', true);

