# apps/lib — load-bearing single module, do not delete

**Status (2026-07-04, Wave 0 re-baseline):** not a workspace package (no `package.json`), but **not dead**.

`credentials/blePresentation.ts` is imported cross-app by
`apps/web/components/clinician/OfflineRadar.tsx` via the relative path
`../../../lib/credentials/blePresentation` (which resolves here, outside the web app root). `OfflineRadar` is currently unmounted, but the import is part of the web compile graph.

Deleting this directory without first removing that import breaks the web build. The right future disposition is relocating the module into `packages/` (or into `apps/web/lib/`) in a hygiene wave that also updates the importer.
