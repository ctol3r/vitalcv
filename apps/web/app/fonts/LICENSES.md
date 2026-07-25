# Font licences

All faces shipped in this directory are self-hosted variable `woff2` files, loaded through
`next/font/local` from `apps/web/app/layout.tsx`. Nothing here is fetched from a CDN at build time
or at runtime — that is deliberate (see the comment in `layout.tsx`).

| File | Family | Licence | Upstream |
| --- | --- | --- | --- |
| `Fraunces-Variable.woff2` | Fraunces (roman) | SIL Open Font License 1.1 | https://github.com/undercasetype/Fraunces |
| `Fraunces-Variable-Italic.woff2` | Fraunces (italic) | SIL Open Font License 1.1 | https://github.com/undercasetype/Fraunces |
| `Fraunces-Variable-ext.woff2` | Fraunces (extended subset) | SIL Open Font License 1.1 | https://github.com/undercasetype/Fraunces |
| `Geist-Variable.woff2` | Geist Sans | SIL Open Font License 1.1 | https://github.com/vercel/geist-font |
| `GeistMono-Variable.woff2` | Geist Mono | SIL Open Font License 1.1 | https://github.com/vercel/geist-font |

Copyright 2020 The Fraunces Project Authors (https://github.com/undercasetype/Fraunces).
Copyright 2024 The Geist Project Authors (https://github.com/vercel/geist-font).

Both families are licensed under the SIL Open Font License, Version 1.1, which permits bundling and
redistribution with this application. Full licence text: https://openfontlicense.org

Roles are fixed by the creative direction (`docs/design/VITALCV_CREATIVE_DIRECTION.md` §CD-7):
Fraunces carries the argument, Geist Sans carries prose and controls, Geist Mono carries every fact
the system retrieved. Do not add a fourth family without amending that document.
