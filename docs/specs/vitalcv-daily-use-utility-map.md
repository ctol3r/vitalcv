# VitalCV Daily Use Utility Map

This document tracks **existing, grounded** mechanics that justify a clinician opening VitalCV daily, without expanding into new product domains (e.g., no social networks, no generic wallets, no generic job boards).

## 1. Freshness & Expiry Monitoring
*   **Current State:** Passport displays freshness state (e.g., `Current attached checks`, `Stale`).
*   **Daily Hook:** State boards and DEA registrations have explicit expiry dates. As a credential nears expiry, the readiness score decays. Returning daily/weekly gives visibility into impending compliance cliffs before they block a shift.

## 2. Readiness Score Recalculation
*   **Current State:** The score (`0-100`) is tied directly to primary source resolution (NPPES, OIG LEIE, PECOS, State Boards).
*   **Daily Hook:** If a clinician uploads a CV today and a state board sync runs overnight, their score will jump the next morning. Returning to check the score provides a dopamine hit of "unlocked readiness".

## 3. Employer Refresh Requests
*   **Current State:** Employers can trigger a "refresh requested" state on a shared packet.
*   **Daily Hook:** Clinicians receive an alert (via the UI) that an employer needs fresh data (e.g., "1 employer has requested updated credentials."). The clinician must return, run an NPI check, and re-share.

## 4. Source Health & Data Rotation
*   **Current State:** OIG/LEIE updates monthly, PECOS updates bi-weekly.
*   **Daily Hook:** The platform can highlight "New OIG exclusions published today - your status remains CLEAR." This builds persistent ambient trust in the platform's vigilance.
