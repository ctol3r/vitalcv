// Cypress E2E support file
// This file runs before every test file

// Disable uncaught exception handling for API requests
Cypress.on('uncaught:exception', (err, runnable) => {
  // Returning false here prevents Cypress from failing the test
  // This is useful when dealing with third-party libraries that throw errors
  if (err.message.includes('ResizeObserver loop limit exceeded')) {
    return false;
  }
  // Don't prevent failures on other errors
  return true;
});

// Custom commands can be added here
// Example:
// Cypress.Commands.add('login', (email, password) => { ... });
