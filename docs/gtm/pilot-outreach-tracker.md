# Pilot Outreach Tracker

A lightweight tracking framework for managing pilot conversations. Do not overbuild a CRM; use this as a simple markdown table or port to a basic spreadsheet.

Owner legend: `CT` = Chris Toler, `PO` = Pilot Ops, `SE` = Solutions Engineer, `CS` = Customer Success.

| Account / Org | Buyer Type | Contact | Problem Hypothesis | Intro Source | Outreach Date | Response | Discovery Scheduled | Fit Score | Blockers | Next Step | Owner | Last Touched | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| *Example: Acme Health* | *Medical group (250 providers)* | *Jane Doe, VP Talent (jane@acme.example)* | *Losing locums revenue to 40-day credentialing delays* | *Cold email* | *2026-04-26* | *Replied — interested* | *2026-04-29 15:00 ET* | *12 / 15* | *None yet* | *Hold discovery call; collect baseline* | *CT* | *2026-04-26* | *Confirmed 25 NPIs available for pilot; asked about state-board scope* |
|  |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |  |  |  |  |  |  |

## Response / Status Definitions
* **Outreach Sent** — initial message delivered.
* **Follow-up 1 / 2** — subsequent messages delivered.
* **Replied — Interested** — buyer responded positively.
* **Replied — Not Now** — buyer responded, timeline is not right.
* **Discovery Scheduled** — call is on the calendar.
* **Pilot Proposed** — scope document sent, waiting on NPIs.
* **Pilot Active** — NPIs received, measurement window running.
* **Closed — Won** — pilot succeeded, moving to commercial terms.
* **Closed — Lost / Disqualified** — not a fit for the current wedge.

## Fit Score
Use the 3-axis buyer-qualification rubric (Urgency + Data Readiness + Pilot Feasibility, each 1–5). See `buyer-qualification-checklist.md` for the mapping.

## Owner
Whichever VitalCV team member is on the hook for the next action. Keep it one person; never `CT / PO` joint ownership — that leads to dropped follow-ups.

## Last Touched
ISO-8601 date (YYYY-MM-DD) of the most recent VitalCV-side action on this row. Sort descending when reviewing the pipeline so stale rows surface.

## Notes
Short, factual lines. Use this column for anything that would be lost in the status alone — e.g., "Refused CAQH requirement", "Asked about SOC 2 timeline", "Competitive mention: Symplr". Do not paste full email threads; link them from shared storage if needed.

## Cadence
* Review the full tracker once a week.
* Any row with `Last Touched` older than 10 days and `Next Step != closed` gets a nudge or gets closed out.
* Retire disqualified rows to a separate archive file each quarter so the active tracker stays short.
