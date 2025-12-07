/**
 * Normalization utilities for ETL adapters
 */

const countryMap: Record<string, string> = {
  'US': 'US',
  'USA': 'US',
  'United States': 'US',
  'UK': 'GB',
  'United Kingdom': 'GB',
  'Canada': 'CA',
  'Australia': 'AU',
  'Germany': 'DE',
  'France': 'FR',
  'India': 'IN',
  'China': 'CN',
  'Japan': 'JP',
  // Add more mappings as needed
};

export function isoCountry(input: string): string {
  return countryMap[input] || input.toUpperCase().slice(0, 2);
}

const specialtyMap: Record<string, string> = {
  'internal medicine': 'Internal Medicine',
  'family medicine': 'Family Medicine',
  'emergency medicine': 'Emergency Medicine',
  'pediatrics': 'Pediatrics',
  'psychiatry': 'Psychiatry',
  'surgery': 'General Surgery',
  'ob/gyn': 'Obstetrics & Gynecology',
  'global health': 'Global Health',
  // Add more mappings as needed
};

export function normSpec(input: string): string {
  const lower = input.toLowerCase().trim();
  return specialtyMap[lower] || input.trim();
}
