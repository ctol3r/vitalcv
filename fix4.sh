sed -i '' -e '254,289d' apps/api/backend/src/services/entity/__tests__/employerPacket.test.ts
sed -i '' -e 's/headline: '\''Partial decision posture'\'',/headline: '\''Some decision-grade checks are still missing, gated, stale, or under review.'\'',/' apps/api/backend/src/services/entity/__tests__/employerPacket.test.ts
sed -i '' -e 's/nextAction: '\''Request a source-backed state licensure check before start.'\'',/nextAction: '\''Request refresh or route to review before relying on missing lanes.'\'',/' apps/api/backend/src/services/entity/__tests__/employerPacket.test.ts
