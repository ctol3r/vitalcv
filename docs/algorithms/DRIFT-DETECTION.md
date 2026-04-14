# Drift Detection & Monitoring (The Entropy Layer)

State in VitalCV is not permanent. It degrades over time or is invalidated by external events. Drift Detection is the system that identifies when the objective `Recognition` state has diverged from the `Acceptance` or `Start` states.

## 1. Drift Sources
- **NPPES**: Deactivation of an NPI, changes in taxonomy, or endpoint unreachable.
- **OIG LEIE**: A new exclusion record matches the clinician.
- **PECOS / State Boards** *(Future)*: License expirations, sanctions, Medicare opt-outs.
- **Temporal Staleness**: The underlying recognition snapshot has not been verified within the required compliance window (e.g., 30 days).

## 2. Drift Types
Drift is classified by its severity and required remediation.

### HARD_DRIFT (Trust Broken)
- **Triggers**: OIG Exclusion detected, License Revoked, NPI Deactivated.
- **Impact**: Instantly invalidates `ACTIVE` Start states. Reverts status to `NOT_STARTABLE`.
- **Remediation**: Manual review required. Requires a new explicit `Acceptance` if cleared.

### SOFT_DRIFT (Trust Degraded)
- **Triggers**: Data freshness expires (e.g., OIG check > 30 days old), minor demographic mismatch.
- **Impact**: `ACTIVE` state may remain, but flags the profile. `READY_TO_START` may be paused.
- **Remediation**: Background refresh of `Recognition` data. If the refresh passes, the Soft Drift is cleared automatically.

## 3. Monitoring Plan
Every clinician in an `ACTIVE` or `READY_TO_START` state must have an associated Monitoring Plan.

```json
{
  "clinicianNpi": "1487664858",
  "sourcesToWatch": ["NPPES", "OIG_LEIE"],
  "refreshCadenceDays": 30,
  "riskLevel": "LOW"
}
```
- **Sources to Watch**: The specific registry hooks required for this clinician's role.
- **Refresh Cadence**: How often `SOFT_DRIFT` is triggered if no background refresh occurs.
## 4. Event Flow & Reactions

Drift detection is an active process. When drift is detected, it is immediately converted into an actionable system event.

**Flow:** `driftEngine` → `event` → `handler` → `system update`

### Event Types
- `DRIFT_DETECTED`: Initial observation of state divergence.
- `HARD_DRIFT_TRIGGERED`: Confirmed severe violation.
- `SOFT_DRIFT_TRIGGERED`: Confirmed staleness or minor drift.
- `ACTIVATION_INVALIDATED`: Emitted when a Start Activation is forcefully revoked due to Hard Drift.

### Reaction Map
- **HARD_DRIFT**:
  - Invalidate `ACTIVE` Start state (transitions to `NOT_STARTABLE`).
  - Flag clinician profile.
  - Require explicit re-verification and new Employer Acceptance.
- **SOFT_DRIFT**:
  - Mark data as stale.
  - Schedule background refresh of Recognition data.

## 5. Human-in-the-Loop Notifications & Actions
System events are meaningless if they do not reach a human when required. The translation of a drift event into a human notification is based on urgency.

### Event Classification
- `DRIFT_DETECTED`: **Log Only** (No user interruption).
- `SOFT_DRIFT_TRIGGERED`: **Low Urgency Notify** (Informational, background refresh pending).
- `HARD_DRIFT_TRIGGERED`: **High Urgency Notify** (Profile flagged, requires attention).
- `ACTIVATION_INVALIDATED`: **Critical Notify** (Immediate stop-work condition).

### Delivery Channels
- **In-App Alert**: Urgent toasts/banners within the Employer Dashboard.
- **UI Notification Panel**: Persistent inbox for Low/High urgency items.
- *(Note: External channels like SMS/Email are deferred pending pilot validation).*

### Human Actions
For every notification presented to a human, specific responses must be available:
1. **Acknowledge**: Clear the notification (applicable to soft drift or informational alerts).
2. **Re-run Verification**: Force an immediate Recognition refresh bypassing the background schedule.
3. **Review Profile**: Navigate directly to the clinician's Passport (`/p/[npi]`) to assess the anomaly and perform a new Acceptance decision.