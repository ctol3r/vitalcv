// example.ts - Example usage of the CredentialStore service

import { CredentialStore } from './store';

// Example demonstrating the fixed setStatus method
function demonstrateFixedSetStatus() {
  const store = new CredentialStore();

  try {
    // This will now throw an error instead of creating incomplete records
    store.setStatus('non-existent-id', 'verified');
  } catch (error) {
    console.log('✅ Correctly throws error for non-existent credential:', (error as Error).message);
  }

  // Create a proper credential first
  const credential = store.createCredential('user-123', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', 'subject-456', 'pending');
  console.log('✅ Created credential:', credential);

  // Now setStatus works correctly
  const updatedCredential = store.setStatus('user-123', 'verified');
  console.log('✅ Updated credential status:', updatedCredential);
}

// Run the example
demonstrateFixedSetStatus();