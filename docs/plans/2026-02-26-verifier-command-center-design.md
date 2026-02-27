# Verifier Command Center Design

## Overview
The goal is to build an "Employer Dashboard" at `apps/web/app/verifier/page.tsx` that feels like an enterprise-grade cryptographic terminal. This will be the Command Center for Verifiers (Employers), utilizing a split-pane architecture.

## Data Layer
- **`createSafeFallbackState`**: We will implement this in `lib/api.ts`. It acts as a robust mock provider, returning an inbound verification queue of candidates.
- Data structures will map to existing concepts: `VerificationLevel` ('L0', 'L1', 'L2', 'L3') and `ReadinessBand` ('Not Ready', 'Conditionally Ready', 'Ready').

## Architecture & Layout

### Approach
We are using a "Clean Slate" approach by building a new `<CommandCenterPortal />` instead of mutating the existing `<VerifierPortal />`.

### The Layout
- **Container**: `flex flex-row h-[calc(100vh-80px)]` to account for the fixed top Navbar built in Wave 1.
- **Left Pane (Inbound Queue)**: `w-1/3` column.
  - Searchable list of mock candidates.
  - Displays Name, NPI, and L0-L3 Status.
  - Selecting a candidate loads them into the right pane.
- **Right Pane (Golden Record & Crypto Terminal)**: `w-2/3` column.
  - **Candidate Details**: Displays the selected candidate's information.
  - **Instant Approve Button**: A massive call-to-action. **Crucially**, it is visually disabled and unclickable UNLESS the candidate's trust state is L3.
  - **Cryptographic Audit Terminal**: A dark-mode terminal window (`bg-gray-900 text-blue-400 font-mono text-sm`) at the bottom.
  - **Animated Timeline**: Simulates Zero-Knowledge Proof validation.
  - **Timestamped Logs**: Prints mock logs dynamically (e.g., `[08:42:11.15] Checking ES256 cryptographic signatures...`).
