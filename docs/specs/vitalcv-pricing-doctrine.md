# VitalCV Pricing Doctrine

**MISSION:** Keep pricing aligned to the launch wedge, not to abstract platform ambition.

## Core Doctrine

VitalCV monetizes organizational workflow execution, not the creation of truth.

- Clinicians are free.
- Issuers are free.
- Organizations pay only when VitalCV performs work that removes operational credentialing effort.
- The same piece of truth must not be sold twice inside the same freshness band.

## Who Pays

| Party | Pricing Rule | Why |
| --- | --- | --- |
| Clinician | Free | The clinician should never be taxed to claim, govern, or share their own readiness record. |
| Issuer / source participant | Free | VitalCV should not charge the parties creating or exposing source truth. |
| Organization buyer | Pays for workflow execution | The buyer is paying for verified pulls, monitoring, exports, and integration work that compresses start delay. |

## What Counts As Workflow Execution

| Billable unit | When it becomes billable | What it must never imply |
| --- | --- | --- |
| Verified pull | First organization access to a credential in a freshness band | That the organization is paying for clinician participation |
| Monitoring refresh | A contracted refresh cycle actually runs | That every source in the stack is live or decision-grade |
| Packet / export run | Operator or buyer generates a packet or reporting export | That the packet contains inferred facts or hidden coverage |
| Integration utility | Contracted API or workflow integration support is provided | That unsupported enterprise scope is already included |
| Government / registry fee | A source actually charges access cost | Any markup by VitalCV |

Employer decisions themselves are not a separate meter. The billable event is the executed workflow utility around the decision, not the click.

## Freshness-Band Pricing

VitalCV prices buyer access by freshness band because the operational value changes when the truth has to be refreshed.

| Freshness band | What the buyer is buying | When a new charge can occur |
| --- | --- | --- |
| `static` | A point-in-time verified pull and packet | First access to that credential in the static band |
| `monthly-monitoring` | Scheduled refreshes and a refreshed view over time | First access in the monthly-monitoring band, plus contracted refresh execution |
| `continuous-monitoring` | Highest-frequency monitoring the contracted source stack can support | First access in the continuous-monitoring band, plus contracted refresh execution |

Only contract-live sources participate in a band. A higher band must never be used to imply broader source coverage than the stack actually supports.

## No-Double-Pay Rule

Same credential + same organization + same freshness band = included repeat access.

- same credential + same organization + `static` twice = one billable pull, one included repeat view
- same credential + same organization + new freshness band = potentially new billable pull
- same credential + different organization = separate buyer utility, therefore separately billable

This rule must remain visible anywhere pricing is shown, quoted, or explained.

## Quote Structure

The sellable pilot package should quote line items in this order:

1. verified pulls for the scoped cohort
2. monitoring refreshes if contracted
3. packet / export utility
4. optional integration utility
5. pass-through government or registry fees at cost

Do not quote:

- seats
- clinician access
- issuer participation
- a separate fee for clicking an employer decision
- bundled enterprise scope that the wedge does not actually ship

## Self-Serve Motion

The motion is self-serve, but the launch truth must match the current operating state:

- Starter and Growth can be selected from the public billing surface.
- During pilot access mode, activation is routed through the current request-access flow rather than claiming live card checkout if card checkout is not yet enabled.
- Enterprise remains manual while launch gating and buyer ops are still being proven on the wedge.

Self-serve motion means a buyer can understand the plan, request the right one quickly, and enter the wedge without a heavy sales process. It does **not** authorize copy that claims public card checkout is already live when it is still gated.

## Buyer-Side Truth Requirements

- pricing must never imply broader source coverage than the actual source stack supports
- contract-gated sources remain visibly gated until legal access and connector readiness are both live
- government and registry fees remain pass-through at cost
- pricing copy must not imply nationwide launch coverage if the pilot is region-scoped
- pricing copy must not imply workflow automation beyond the single launch wedge

## Explicit Non-Promises

Do not use pricing to imply:

- live NPDB / DEA / ABMS coverage
- live Nursys / FSMB coverage unless contract and connector are active
- a full enterprise procurement motion for features outside the launch wedge
- guaranteed savings or ROI beyond the measured pilot KPI

## Launch Standard

Pricing is launch-safe only when `/billing`, the pilot brief, the launch gate, the KPI dashboard, and operator scripts all describe the exact same rules with no ambiguity.
