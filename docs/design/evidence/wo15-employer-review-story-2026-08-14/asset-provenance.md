# WO-15 asset provenance

Both shipped assets are original image-generation commissions for VitalCV. The
user-supplied clinical reference images informed the broad human-clinical
direction only; no pixels from those files or from a competitor site were
copied into production.

## Employer review desk

- Production file: `apps/web/public/scenes/employer-review-desk.webp`
- Generation source:
  `/Users/christoler/.codex/generated_images/019ff2f6-abed-7e20-8449-eb4b00730869/exec-783453c3-6df1-49db-bbdc-19a934e51810.png`
- SHA-256:
  `3e057a6c71275c074f5b67fcd60deae12e96aa3dda6aa799edd9a96d614f081d`
- Production size: 36,984 bytes; 1536 by 961 pixels; WebP.
- Prompt direction: tactile paper folio moving through an explicit consent
  gate to an employer review desk with inspect, clarification, and institution
  review affordances.
- Truth review: the final edit removes checks, shields, approval seals, badges,
  and outcome symbols. It stops before a decision, credentialing action, hire,
  or start.

## Clinical operations team

- Production file: `apps/web/public/scenes/employers-care-team.webp`
- Generation source:
  `/Users/christoler/.codex/generated_images/019ff2f6-abed-7e20-8449-eb4b00730869/exec-a7c5bfb7-e660-4c1e-8c58-6077d36385a2.png`
- SHA-256:
  `d7022a65d259c02bfb8456ccfe0bc6292d98915ce299bb3c424d95ab66c6dff0`
- Production size: 30,998 bytes; 1600 by 900 pixels; WebP.
- Prompt direction: anonymous clinical and operations professionals reviewing a
  folder together in a quiet clinical setting, with no patient, readable
  screen, logo, badge, identifier, or result.
- Truth review: this is art-directed synthetic media. It does not depict a real
  clinician, employer, patient, customer, credential, packet, or outcome; that
  disclosure remains adjacent to the image in the rendered page.

The manifest records both assets as `VitalCV proprietary`, gives each an
origin, meaningful alt text, and a process transcript. Neither image contains
the evidence facts customers rely on; those remain server-visible text.
