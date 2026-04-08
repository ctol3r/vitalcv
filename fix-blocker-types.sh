sed -i '' -e "s/code: 'EXCLUSION_NOT_CLEAR',/code: 'EXCLUSION_NOT_CLEAR' as const,/" apps/api/backend/src/services/entity/employerPacket.ts
sed -i '' -e "s/severity: passport.standing.exclusionStatus === 'EXCLUDED' ? 'critical' : 'warning',/severity: passport.standing.exclusionStatus === 'EXCLUDED' ? 'critical' as const : 'warning' as const,/" apps/api/backend/src/services/entity/employerPacket.ts
sed -i '' -e "s/severity: 'warning',/severity: 'warning' as const,/" apps/api/backend/src/services/entity/employerPacket.ts
sed -i '' -e "s/severity: 'info',/severity: 'info' as const,/" apps/api/backend/src/services/entity/employerPacket.ts
