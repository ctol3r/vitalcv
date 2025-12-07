export const MAX_TEMP_DAYS = 120;

export function validateTempPriv(days: number) {
  return days <= MAX_TEMP_DAYS;
}

