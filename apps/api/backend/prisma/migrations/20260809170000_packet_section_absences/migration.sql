-- Explicit per-section absences on the sealed application packet.
--
-- `selected_sections` could name a section that contributed ZERO fields, and
-- the packet carried no record of that. An employer reading "licensure" in the
-- selection with no licensure field present infers licensure was checked and
-- came back clean, when the truth is that nothing was found — absence of
-- evidence rendered as evidence of absence.
--
-- Additive and nullable, which is what keeps every already-sealed packet
-- verifying: NULL reconstructs as `undefined`, canonicalize OMITS the key, and
-- the original packet_hash still replays. New packets always write a value
-- (`[]` when every selected section contributed), so "nothing was absent" is a
-- positive claim rather than the same silence one layer up.

ALTER TABLE "application_packets"
  ADD COLUMN IF NOT EXISTS "section_absences" JSONB;
