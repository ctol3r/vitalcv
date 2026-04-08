sed -i '' -e '251,294d' apps/api/backend/src/services/entity/__tests__/employerPacket.test.ts
sed -i '' -e '/decisionPosture: {/,/freshness: passport.trustPosture.freshness,/d' apps/api/backend/src/services/entity/__tests__/employerPacket.test.ts
sed -i '' -e 's/    });/    expect(packet.decisionPosture.status).toEqual('\''PARTIAL'\'');/' apps/api/backend/src/services/entity/__tests__/employerPacket.test.ts
