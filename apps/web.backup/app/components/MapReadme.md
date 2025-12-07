# Compact Map Component

## Features

- Uses /us.json TopoJSON (us-atlas).
- d3-geo for projection, d3-zoom for pan/zoom.
- Keyboard: focus state path, Enter opens side panel.
- Tooltip lists compacts & NLC 60-day rule.

## Notes

(NLC residency enforcement lives in AuthZ.)

Compacts overlay + NLC 60-day rule surfaced in tooltip; jurisdiction still computed by patient-state AuthZ.

