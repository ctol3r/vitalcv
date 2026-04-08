sed -i '' -e 's/proven: \[/blockers: \[\],/g' apps/api/backend/src/services/entity/__tests__/employerPacket.test.ts
sed -i '' -e '255,279d' apps/api/backend/src/services/entity/__tests__/employerPacket.test.ts
sed -i '' -e '280,289d' apps/api/backend/src/services/entity/__tests__/employerPacket.test.ts
sed -i '' -e '/missing: \[/,/],/d' apps/api/backend/src/services/entity/__tests__/employerPacket.test.ts
